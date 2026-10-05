import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { tuning } from '../config/tuning';
import { neutralPose, type HeadPose, type HeadPoseSource } from './HeadPose';
import { OneEuroFilter } from './OneEuroFilter';

/**
 * Front-camera head tracking with MediaPipe Face Landmarker.
 *
 * Privacy: the camera stream only feeds a hidden <video> element that
 * MediaPipe reads locally. Frames are never drawn (unless the dev-only debug
 * preview is enabled), stored, recorded, or sent anywhere.
 *
 * Measurement model (per inference):
 *   - eye centers = midpoint of each eye's corners (iris is avoided because
 *     it moves with gaze, not with the head)
 *   - head point  = midpoint between the two eye centers ("cyclopean eye")
 *   - ipd         = 3D distance between eye centers, in pixels (the landmark
 *                   z makes it roughly invariant to head rotation)
 *   - offset      = head point's offset from the image center, measured in
 *                   inter-eye distances. This is ~physical displacement and
 *                   independent of camera FOV and resolution.
 *
 * Calibrated pose:
 *   x = -(offsetX - center.offsetX)  camera images are not mirrored, so the
 *                                    viewer moving right moves the face left
 *   y = -(offsetY - center.offsetY)  image y grows downward
 *   z = center.ipd / ipd - 1         0 at calibration, > 0 when farther
 */

export type CameraStatus = 'off' | 'starting' | 'active' | 'blocked' | 'unavailable' | 'error';
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';
export type CalibrationState = 'none' | 'sampling' | 'done' | 'failed';
export type Delegate = 'GPU' | 'CPU';

export interface TrackerStatus {
  camera: CameraStatus;
  model: ModelStatus;
  delegate: Delegate | null;
  faceDetected: boolean;
  calibration: CalibrationState;
  calibrationProgress: number;
  message: string | null;
}

export interface FaceMeasurement {
  /** Head point offset from image center, in inter-eye distances. */
  offsetX: number;
  offsetY: number;
  /** Inter-eye distance in pixels. */
  ipd: number;
}

const BASE = import.meta.env.BASE_URL;
const WASM_PATH = `${BASE}mediapipe/wasm`;
const MODEL_PATH = `${BASE}models/face_landmarker.task`;

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, max: 30 },
  },
};

const RIGHT_EYE_OUTER = 33;
const RIGHT_EYE_INNER = 133;
const LEFT_EYE_OUTER = 263;
const LEFT_EYE_INNER = 362;

/** Keep the last pose this long after the face disappears. */
const HOLD_SECONDS = 0.4;
/** Then ease back to neutral with this time constant. */
const RETURN_TAU = 0.6;
/** On reacquire, blend from the held pose to the tracked pose over this long. */
const REACQUIRE_SECONDS = 0.7;
const REACQUIRE_TAU = 0.25;

const CALIBRATION_SAMPLES = 24;
const CALIBRATION_TIMEOUT_MS = 6000;

export class FaceTracker implements HeadPoseSource {
  /** Final pose consumed by the camera (filtered, with hold / return / reacquire). */
  readonly pose: HeadPose = neutralPose();
  /** Calibrated but unfiltered pose from the latest inference. */
  readonly rawPose: HeadPose = neutralPose();
  /** One Euro filtered pose from the latest inference. */
  readonly filteredPose: HeadPose = neutralPose();
  /** Latest measurement and landmarks, for debug display. */
  readonly measurement: FaceMeasurement = { offsetX: 0, offsetY: 0, ipd: 0 };
  landmarks: NormalizedLandmark[] | null = null;
  center: FaceMeasurement | null = null;
  readonly stats = { trackingFps: 0, inferenceMs: 0, videoWidth: 0, videoHeight: 0 };

  private status: TrackerStatus = {
    camera: 'off',
    model: 'idle',
    delegate: null,
    faceDetected: false,
    calibration: 'none',
    calibrationProgress: 0,
    message: null,
  };
  private statusListeners = new Set<() => void>();
  private frameListeners = new Set<() => void>();

  private landmarker: FaceLandmarker | null = null;
  private landmarkerPromise: Promise<FaceLandmarker | null> | null = null;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private session = 0;
  private frameHandle = 0;
  private frameTimer = 0;
  private lastInferenceAt = 0;
  private lastTimestamp = 0;
  private lastFaceAt = -Infinity;
  private reacquire = 0;

  private readonly filters = {
    x: new OneEuroFilter(0.7, 1.8),
    y: new OneEuroFilter(0.7, 1.8),
    z: new OneEuroFilter(0.4, 1.5),
  };

  private calibrationSamples: FaceMeasurement[] = [];
  private calibrationTimer = 0;

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  // ---------------------------------------------------------------- status

  getStatus = (): TrackerStatus => this.status;

  subscribe = (listener: () => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  /** Called after every inference (used by the debug camera preview). */
  onFrame(listener: () => void) {
    this.frameListeners.add(listener);
    return () => {
      this.frameListeners.delete(listener);
    };
  }

  getVideo(): HTMLVideoElement | null {
    return this.video;
  }

  private setStatus(patch: Partial<TrackerStatus>) {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof TrackerStatus)[]) {
      if (this.status[key] !== patch[key]) changed = true;
    }
    if (!changed) return;
    this.status = { ...this.status, ...patch };
    this.statusListeners.forEach((l) => l());
  }

  // --------------------------------------------------------------- control

  /** Start the camera and tracking. Optionally use a provided stream (dev testing). */
  async start(streamOverride?: MediaStream): Promise<void> {
    this.stop();
    const session = ++this.session;
    this.setStatus({ camera: 'starting', message: null });

    if (!streamOverride && !navigator.mediaDevices?.getUserMedia) {
      this.setStatus({
        camera: 'unavailable',
        message: window.isSecureContext
          ? 'This browser does not provide camera access.'
          : 'Camera access requires a secure (HTTPS) connection.',
      });
      return;
    }

    const landmarkerReady = this.loadLandmarker();

    let stream: MediaStream;
    try {
      stream = streamOverride ?? (await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS));
    } catch (err) {
      if (session !== this.session) return;
      this.setStatus(describeCameraError(err));
      return;
    }
    if (session !== this.session) {
      stopStream(stream);
      return;
    }
    this.stream = stream;

    const video = this.ensureVideo();
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Autoplay of a muted inline video should not fail; if it does, frames still arrive.
    }
    if (session !== this.session) return;

    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (session !== this.session) return;
        this.setStatus({ camera: 'error', faceDetected: false, message: 'The camera stopped.' });
      });
    }
    this.setStatus({ camera: 'active' });

    const landmarker = await landmarkerReady;
    if (session !== this.session || !landmarker) return;
    this.scheduleFrame(session);
  }

  stop() {
    this.session++;
    if (this.video && this.frameHandle && 'cancelVideoFrameCallback' in this.video) {
      this.video.cancelVideoFrameCallback(this.frameHandle);
    }
    window.clearTimeout(this.frameTimer);
    this.frameHandle = 0;
    if (this.stream) stopStream(this.stream);
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.landmarks = null;
    this.lastFaceAt = -Infinity;
    this.cancelCalibration();
    this.setStatus({ camera: 'off', faceDetected: false, message: null });
  }

  /** Sample several consecutive frames and use their median as the neutral pose. */
  calibrate() {
    this.cancelCalibration();
    this.calibrationSamples = [];
    this.setStatus({ calibration: 'sampling', calibrationProgress: 0 });
    this.calibrationTimer = window.setTimeout(() => {
      if (this.status.calibration !== 'sampling') return;
      this.setStatus({ calibration: 'failed', calibrationProgress: 0 });
    }, CALIBRATION_TIMEOUT_MS);
  }

  resetCalibration() {
    this.cancelCalibration();
    this.center = null;
    this.setStatus({ calibration: 'none', calibrationProgress: 0 });
  }

  private cancelCalibration() {
    window.clearTimeout(this.calibrationTimer);
    if (this.status.calibration === 'sampling') {
      this.setStatus({ calibration: this.center ? 'done' : 'none', calibrationProgress: 0 });
    }
  }

  // ---------------------------------------------------------- render-rate

  /**
   * Called every render frame. Produces `pose` from the latest filtered
   * tracking result, holding through brief dropouts, easing back to neutral
   * when the face stays lost, and blending smoothly when it returns.
   */
  update(dt: number) {
    const sinceFace = (performance.now() - this.lastFaceAt) / 1000;
    const p = this.pose;

    if (this.center && sinceFace < HOLD_SECONDS) {
      const tau = REACQUIRE_TAU * this.reacquire;
      this.reacquire = Math.max(0, this.reacquire - dt / REACQUIRE_SECONDS);
      const a = tau < 1e-3 ? 1 : 1 - Math.exp(-dt / tau);
      const f = this.filteredPose;
      p.x += (f.x - p.x) * a;
      p.y += (f.y - p.y) * a;
      p.z += (f.z - p.z) * a;
      p.confidence = 1;
    } else {
      const a = 1 - Math.exp(-dt / RETURN_TAU);
      p.x -= p.x * a;
      p.y -= p.y * a;
      p.z -= p.z * a;
      p.confidence = Math.max(0, p.confidence - dt / 1.0);
    }

    if (this.status.faceDetected && sinceFace >= HOLD_SECONDS) {
      this.setStatus({ faceDetected: false });
    }
  }

  // ------------------------------------------------------------- internals

  private ensureVideo(): HTMLVideoElement {
    if (this.video) return this.video;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.className = 'tracker-video';
    document.body.appendChild(video);
    this.video = video;
    return video;
  }

  private loadLandmarker(forceDelegate?: Delegate): Promise<FaceLandmarker | null> {
    if (this.landmarkerPromise && !forceDelegate) return this.landmarkerPromise;
    this.setStatus({ model: 'loading' });

    this.landmarkerPromise = (async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
        const delegates: Delegate[] = forceDelegate ? [forceDelegate] : ['GPU', 'CPU'];
        for (const delegate of delegates) {
          try {
            const landmarker = await FaceLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: MODEL_PATH, delegate },
              runningMode: 'VIDEO',
              numFaces: 1,
              minFaceDetectionConfidence: 0.5,
              minFacePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            });
            this.landmarker?.close();
            this.landmarker = landmarker;
            this.setStatus({ model: 'ready', delegate });
            return landmarker;
          } catch (err) {
            console.warn(`[FaceTracker] ${delegate} delegate failed`, err);
          }
        }
        throw new Error('No MediaPipe delegate available');
      } catch (err) {
        console.error('[FaceTracker] failed to load face landmarker', err);
        this.landmarkerPromise = null;
        this.setStatus({ model: 'error', message: 'Face tracking failed to load.' });
        return null;
      }
    })();
    return this.landmarkerPromise;
  }

  private scheduleFrame(session: number) {
    const video = this.video;
    if (!video || session !== this.session) return;
    if ('requestVideoFrameCallback' in video) {
      this.frameHandle = video.requestVideoFrameCallback(() => this.onVideoFrame(session));
    } else {
      this.frameTimer = window.setTimeout(() => this.onVideoFrame(session), 1000 / 60);
    }
  }

  private onVideoFrame(session: number) {
    if (session !== this.session) return;
    const now = performance.now();
    const interval = 1000 / Math.max(1, tuning.get().trackingRate);
    if (now - this.lastInferenceAt >= interval * 0.9) {
      if (this.lastInferenceAt > 0) {
        const fps = 1000 / (now - this.lastInferenceAt);
        this.stats.trackingFps += (fps - this.stats.trackingFps) * 0.1;
      }
      this.lastInferenceAt = now;
      this.processFrame(now);
    }
    this.scheduleFrame(session);
  }

  private processFrame(now: number) {
    const video = this.video;
    const landmarker = this.landmarker;
    if (!video || !landmarker || video.readyState < 2 || video.videoWidth === 0) return;

    const timestamp = Math.max(now, this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;

    let face: NormalizedLandmark[] | undefined;
    try {
      const t0 = performance.now();
      face = landmarker.detectForVideo(video, timestamp).faceLandmarks[0];
      this.stats.inferenceMs += (performance.now() - t0 - this.stats.inferenceMs) * 0.1;
    } catch (err) {
      console.error('[FaceTracker] inference failed', err);
      if (this.status.delegate === 'GPU') {
        this.landmarker = null;
        void this.loadLandmarker('CPU');
      }
      return;
    }

    this.stats.videoWidth = video.videoWidth;
    this.stats.videoHeight = video.videoHeight;
    this.landmarks = face ?? null;

    if (face) {
      measureFace(face, video.videoWidth, video.videoHeight, this.measurement);
      this.onFace(this.measurement, now);
    } else if (this.status.calibration === 'sampling') {
      this.calibrationSamples = [];
      this.setStatus({ calibrationProgress: 0 });
    }

    this.frameListeners.forEach((l) => l());
  }

  private onFace(m: FaceMeasurement, now: number) {
    if (this.status.calibration === 'sampling') this.addCalibrationSample(m);

    const lostFor = (now - this.lastFaceAt) / 1000;
    this.lastFaceAt = now;
    if (!this.status.faceDetected) this.setStatus({ faceDetected: true });

    const c = this.center;
    if (!c) return;

    const sign = tuning.get().invertX ? -1 : 1;
    const raw = this.rawPose;
    raw.x = clamp(-(m.offsetX - c.offsetX) * sign, -3, 3);
    raw.y = clamp(-(m.offsetY - c.offsetY), -3, 3);
    raw.z = clamp(c.ipd / m.ipd - 1, -0.5, 1);
    raw.confidence = 1;

    if (lostFor >= HOLD_SECONDS) {
      this.filters.x.reset();
      this.filters.y.reset();
      this.filters.z.reset();
      this.reacquire = 1;
    }

    const t = now / 1000;
    const f = this.filteredPose;
    f.x = this.filters.x.filter(raw.x, t);
    f.y = this.filters.y.filter(raw.y, t);
    f.z = this.filters.z.filter(raw.z, t);
    f.confidence = 1;
  }

  private addCalibrationSample(m: FaceMeasurement) {
    this.calibrationSamples.push({ ...m });
    const n = this.calibrationSamples.length;
    if (n < CALIBRATION_SAMPLES) {
      this.setStatus({ calibrationProgress: n / CALIBRATION_SAMPLES });
      return;
    }
    const s = this.calibrationSamples;
    this.center = {
      offsetX: median(s.map((v) => v.offsetX)),
      offsetY: median(s.map((v) => v.offsetY)),
      ipd: median(s.map((v) => v.ipd)),
    };
    this.calibrationSamples = [];
    window.clearTimeout(this.calibrationTimer);
    this.filters.x.reset();
    this.filters.y.reset();
    this.filters.z.reset();
    this.reacquire = 1;
    this.setStatus({ calibration: 'done', calibrationProgress: 1 });
  }

  private onVisibilityChange = () => {
    if (document.visibilityState !== 'visible' || !this.stream) return;
    const ended = this.stream.getVideoTracks().some((t) => t.readyState === 'ended');
    if (ended) void this.start();
  };
}

function measureFace(face: NormalizedLandmark[], width: number, height: number, out: FaceMeasurement) {
  const r0 = face[RIGHT_EYE_OUTER];
  const r1 = face[RIGHT_EYE_INNER];
  const l0 = face[LEFT_EYE_OUTER];
  const l1 = face[LEFT_EYE_INNER];

  const rx = ((r0.x + r1.x) / 2) * width;
  const ry = ((r0.y + r1.y) / 2) * height;
  const rz = ((r0.z + r1.z) / 2) * width;
  const lx = ((l0.x + l1.x) / 2) * width;
  const ly = ((l0.y + l1.y) / 2) * height;
  const lz = ((l0.z + l1.z) / 2) * width;

  const ipd = Math.max(1, Math.hypot(lx - rx, ly - ry, lz - rz));
  out.ipd = ipd;
  out.offsetX = ((rx + lx) / 2 - width / 2) / ipd;
  out.offsetY = ((ry + ly) / 2 - height / 2) / ipd;
}

function describeCameraError(err: unknown): Partial<TrackerStatus> {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { camera: 'blocked', message: 'Camera permission was denied.' };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { camera: 'unavailable', message: 'No usable front camera was found.' };
  }
  if (name === 'NotReadableError') {
    return { camera: 'error', message: 'The camera is busy in another app or tab.' };
  }
  return { camera: 'error', message: 'The camera could not be started.' };
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop());
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export const faceTracker = new FaceTracker();
