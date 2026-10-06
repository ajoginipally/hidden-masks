import { useEffect, useState } from 'react';
import { tuning, useTuning, type Tuning } from '../config/tuning';
import { liveStats } from '../debug/liveStats';
import { doorPuzzle, useDoorPuzzle } from '../game/door/doorPuzzle';
import { endingPuzzle, useEndingPuzzle } from '../game/ending/endingPuzzle';
import { keyPuzzle, useKeyPuzzle } from '../game/key/keyPuzzle';
import { maskDirector, useMaskGaze, type GazeTargetName } from '../game/mask/maskDirector';
import { faceTracker, type TrackerStatus } from '../tracking/FaceTracker';
import { headInput } from '../tracking/headInput';
import { useInputMode, useTrackerStatus } from '../tracking/useHeadTracking';

type NumericKey = {
  [K in keyof Tuning]: Tuning[K] extends number ? K : never;
}[keyof Tuning];

type BooleanKey = {
  [K in keyof Tuning]: Tuning[K] extends boolean ? K : never;
}[keyof Tuning];

interface SliderDef {
  key: NumericKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

const VIEW_SLIDERS: SliderDef[] = [
  { key: 'sensitivityX', label: 'Head sensitivity X', min: 0, max: 3, step: 0.05 },
  { key: 'sensitivityY', label: 'Head sensitivity Y', min: 0, max: 3, step: 0.05 },
  { key: 'depthSensitivity', label: 'Depth sensitivity', min: 0, max: 3, step: 0.05 },
  { key: 'depthDeadZone', label: 'Depth dead zone', min: 0, max: 0.3, step: 0.01 },
  { key: 'depthSmoothing', label: 'Depth smoothing (s)', min: 0, max: 1.5, step: 0.05 },
  { key: 'minEyeDistanceScale', label: 'Min eye distance scale', min: 0.4, max: 1, step: 0.05 },
  { key: 'maxEyeDistanceScale', label: 'Max eye distance scale', min: 1, max: 2.5, step: 0.05 },
  { key: 'smoothing', label: 'Smoothing (s)', min: 0, max: 0.4, step: 0.005 },
  { key: 'headDeadZone', label: 'Head dead zone', min: 0, max: 0.2, step: 0.005 },
  { key: 'perspectiveStrength', label: 'Perspective strength', min: 0, max: 2, step: 0.05 },
  { key: 'exaggerationX', label: 'Horizontal exaggeration', min: 0, max: 3, step: 0.05 },
  { key: 'exaggerationY', label: 'Vertical exaggeration', min: 0, max: 3, step: 0.05 },
  { key: 'eyeDistance', label: 'Virtual eye distance', min: 1.5, max: 12, step: 0.1 },
  { key: 'maxDisplacement', label: 'Max displacement', min: 0.2, max: 4, step: 0.05 },
  { key: 'keyTolerance', label: 'Key alignment tolerance', min: 0.01, max: 0.25, step: 0.005 },
];

const KEY_SLIDERS: SliderDef[] = [
  { key: 'keyTolerance', label: 'Alignment tolerance (NDC)', min: 0.01, max: 0.25, step: 0.005 },
  { key: 'keySolveThreshold', label: 'Solve threshold', min: 0.7, max: 1, step: 0.01 },
  { key: 'keyMinAnchorScore', label: 'Min per-anchor score', min: 0.5, max: 1, step: 0.01 },
  { key: 'keyShimmerLow', label: 'Shimmer low', min: 0.4, max: 0.95, step: 0.01 },
  { key: 'keyShimmerHigh', label: 'Shimmer high', min: 0.5, max: 0.99, step: 0.01 },
  { key: 'keyHoldDuration', label: 'Hold duration (s)', min: 0.15, max: 2, step: 0.05 },
  { key: 'keyOffsetX', label: 'Fragment offset X', min: -0.4, max: 0.4, step: 0.01 },
  { key: 'keyOffsetY', label: 'Fragment offset Y', min: -0.4, max: 0.4, step: 0.01 },
  { key: 'keyOffsetZ', label: 'Fragment offset Z', min: -0.4, max: 0.4, step: 0.01 },
];

/** Live silhouette sculpt — NDC is solve screen-space; depths are world Z. */
const KEY_SILHOUETTE_SLIDERS: SliderDef[] = [
  { key: 'keyBowNdcX', label: 'Bow NDC X', min: -0.6, max: 0.4, step: 0.01 },
  { key: 'keyBowNdcY', label: 'Bow NDC Y', min: -0.4, max: 0.4, step: 0.01 },
  { key: 'keyShaftLeftNdcX', label: 'Shaft L NDC X', min: -0.5, max: 0.5, step: 0.01 },
  { key: 'keyShaftLeftNdcY', label: 'Shaft L NDC Y', min: -0.4, max: 0.4, step: 0.01 },
  { key: 'keyShaftRightNdcX', label: 'Shaft R NDC X', min: -0.4, max: 0.6, step: 0.01 },
  { key: 'keyShaftRightNdcY', label: 'Shaft R NDC Y', min: -0.4, max: 0.4, step: 0.01 },
  { key: 'keyToothNdcX', label: 'Tooth NDC X', min: -0.3, max: 0.7, step: 0.01 },
  { key: 'keyToothNdcY', label: 'Tooth NDC Y', min: -0.5, max: 0.3, step: 0.01 },
  { key: 'keyDepthBow', label: 'Depth bow (Z)', min: -2.4, max: -0.4, step: 0.05 },
  { key: 'keyDepthShaft', label: 'Depth shaft (Z)', min: -2.0, max: -0.3, step: 0.05 },
  { key: 'keyDepthTooth', label: 'Depth tooth (Z)', min: -1.5, max: -0.15, step: 0.05 },
];

const DOOR_SLIDERS: SliderDef[] = [
  { key: 'doorOffsetX', label: 'Door offset X', min: -0.35, max: 0.35, step: 0.01 },
  { key: 'doorOffsetY', label: 'Door offset Y', min: -0.4, max: 0.4, step: 0.01 },
  { key: 'doorOffsetZ', label: 'Door offset Z', min: -0.5, max: 0.5, step: 0.01 },
  { key: 'occluderOffsetX', label: 'Occluder offset X', min: -0.35, max: 0.35, step: 0.01 },
  { key: 'occluderOffsetY', label: 'Occluder offset Y', min: -0.4, max: 0.4, step: 0.01 },
  { key: 'occluderOffsetZ', label: 'Occluder offset Z', min: -0.6, max: 0.6, step: 0.01 },
];

const TRACKING_SLIDERS: SliderDef[] = [
  { key: 'trackingRate', label: 'Tracking rate (Hz)', min: 5, max: 60, step: 1 },
];

const MASK_SLIDERS: SliderDef[] = [
  { key: 'eyeResponse', label: 'Eye response speed', min: 1, max: 40, step: 0.5 },
  { key: 'eyeLimitX', label: 'Eye horizontal limit (°)', min: 0, max: 50, step: 1 },
  { key: 'eyeLimitY', label: 'Eye vertical limit (°)', min: 0, max: 40, step: 1 },
  { key: 'maskFollowStrength', label: 'Mask follow strength', min: 0, max: 1, step: 0.01 },
  { key: 'maskFollowSmoothing', label: 'Mask follow smoothing (s)', min: 0.05, max: 3, step: 0.05 },
  { key: 'maskMaxAngle', label: 'Mask max angle (°)', min: 0, max: 10, step: 0.5 },
  { key: 'eyeContactTolerance', label: 'Eye contact tolerance (°)', min: 0.5, max: 25, step: 0.5 },
];

const CAMERA_LABEL: Record<TrackerStatus['camera'], string> = {
  off: 'OFF',
  starting: 'STARTING',
  active: 'ACTIVE',
  blocked: 'BLOCKED',
  unavailable: 'UNAVAILABLE',
  error: 'ERROR',
};

export function DebugPanel({ open }: { open: boolean }) {
  const t = useTuning();
  const mode = useInputMode();
  const status = useTrackerStatus();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  const { rawPose: raw, inputPose: input, smoothedPose: s, eye, frustum: f, window: win } = liveStats;
  const head = mode === 'head';
  const c = faceTracker.center;
  const stats = faceTracker.stats;

  return (
    <div className="debug-panel" data-ui>
      <div className="debug-title">DEBUG</div>

      <section>
        <div className="debug-label">INPUT MODE</div>
        <label className="debug-radio">
          <input type="radio" checked={head} onChange={() => headInput.setMode('head')} />
          HEAD TRACKING
        </label>
        <label className="debug-radio">
          <input type="radio" checked={!head} onChange={() => headInput.setMode('pointer')} />
          MOUSE / TOUCH
        </label>
      </section>

      {head && (
        <section className="debug-readout">
          <div className="debug-status">
            <span className={status.camera === 'active' ? 'ok' : 'bad'}>CAMERA: {CAMERA_LABEL[status.camera]}</span>
            <span className={status.faceDetected ? 'ok' : 'bad'}>
              FACE: {status.faceDetected ? 'DETECTED' : 'NOT DETECTED'}
            </span>
          </div>
          <Row
            label="model"
            value={status.model === 'ready' ? `READY (${status.delegate})` : status.model.toUpperCase()}
          />
          <Row label="calibration" value={status.calibration.toUpperCase()} />
          <Row label="tracking fps" value={stats.trackingFps.toFixed(1)} />
          <Row label="inference ms" value={stats.inferenceMs.toFixed(1)} />
          <Row label="video" value={stats.videoWidth ? `${stats.videoWidth} × ${stats.videoHeight}` : '—'} />
          {status.message && <Row label="message" value={status.message} />}
        </section>
      )}

      <section className="debug-readout">
        <Row label="input" value={head ? 'HEAD TRACKING' : 'MOUSE / TOUCH'} />
        <Row label="raw x / y / z" value={xyz(raw)} />
        {head && <Row label="filtered x/y/z" value={xyz(input)} />}
        <Row label="smoothed x/y/z" value={xyz(s)} />
        <Row label="confidence" value={fmt(input.confidence)} />
        <Row
          label="calibrated center"
          value={!head ? 'n/a (pointer)' : c ? `${fmt(c.offsetX)} ${fmt(c.offsetY)} ${c.ipd.toFixed(0)}px` : 'not calibrated'}
        />
        {head && (
          <Row
            label="face offset / ipd"
            value={`${fmt(faceTracker.measurement.offsetX)} ${fmt(faceTracker.measurement.offsetY)} ${faceTracker.measurement.ipd.toFixed(0)}px`}
          />
        )}
        <Row label="eye (world)" value={`${fmt(eye.x)}  ${fmt(eye.y)}  ${fmt(eye.z)}`} />
        <Row label="window w × h" value={`${fmt(win.width)} × ${fmt(win.height)}`} />
        <Row label="frustum l / r" value={`${fmt(f.left, 4)}  ${fmt(f.right, 4)}`} />
        <Row label="frustum b / t" value={`${fmt(f.bottom, 4)}  ${fmt(f.top, 4)}`} />
        <Row label="key alignment" value={fmt(liveStats.alignmentScore)} />
        <Row label="puzzle state" value={liveStats.keyPhase} />
        <Row label="fps" value={liveStats.fps.toFixed(0)} />
      </section>

      <section>
        {VIEW_SLIDERS.map((def) => (
          <Slider key={def.key} def={def} value={t[def.key]} />
        ))}
        <Toggle k="enableHeadDepth" label={`HEAD DEPTH: ${t.enableHeadDepth ? 'ON' : 'OFF'}`} value={t.enableHeadDepth} />
        <Toggle k="showTrackingDot" label="Show tracking dot" value={t.showTrackingDot} />
      </section>

      <section>
        <div className="debug-label">TRACKING</div>
        {TRACKING_SLIDERS.map((def) => (
          <Slider key={def.key} def={def} value={t[def.key]} />
        ))}
        <Toggle k="invertX" label="Invert head X" value={t.invertX} />
        <Toggle k="showCameraPreview" label="Show camera preview" value={t.showCameraPreview} />
      </section>

      <KeySection />

      <DoorSection />

      <EndingSection />

      <MaskSection />

      <section className="debug-buttons">
        {head ? (
          <button onClick={() => faceTracker.resetCalibration()}>RESET / RECENTER CALIBRATION (R)</button>
        ) : (
          <button onClick={() => headInput.pointer.recenter()}>RECENTER VIEW (R)</button>
        )}
        <button onClick={() => tuning.reset()}>RESET TUNING</button>
      </section>
    </div>
  );
}

function KeySection() {
  const t = useTuning();
  const k = useKeyPuzzle();
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button className="debug-collapse" onClick={() => setOpen((o) => !o)}>
        <span>KEY</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <>
          <div className="debug-readout">
            <Row label="phase" value={k.phase} />
            <Row label="alignment" value={fmt(k.score)} />
            <Row label="mean / min" value={`${fmt(k.mean)}  ${fmt(k.min)}`} />
            <Row label="hold" value={`${(k.hold * 100).toFixed(0)}%`} />
            <Row label="key found" value={k.keyFound ? 'YES' : 'no'} />
          </div>
          {KEY_SLIDERS.map((def) => (
            <Slider key={def.key} def={def} value={t[def.key]} />
          ))}
          <div className="debug-label">SILHOUETTE (NDC / DEPTH)</div>
          {KEY_SILHOUETTE_SLIDERS.map((def) => (
            <Slider key={def.key} def={def} value={t[def.key]} />
          ))}
          <Toggle
            k="showKeyAlignmentDebug"
            label="Show alignment debug"
            value={t.showKeyAlignmentDebug}
          />
          <Toggle
            k="keyDisappearOnFound"
            label="Disappear on found"
            value={t.keyDisappearOnFound}
          />
          <div className="debug-buttons">
            <button onClick={() => keyPuzzle.reset()}>RESET KEY PUZZLE</button>
          </div>
        </>
      )}
    </section>
  );
}

function DoorSection() {
  const t = useTuning();
  const d = useDoorPuzzle();
  const gaze = useMaskGaze();
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button className="debug-collapse" onClick={() => setOpen((o) => !o)}>
        <span>DOOR</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <>
          <div className="debug-readout">
            <Row label="key found" value={liveStats.keyFound ? 'YES' : 'no'} />
            <Row label="mask clue active" value={d.clueActive ? 'YES' : 'no'} />
            <Row label="mask gaze mode" value={gaze.mode} />
            <Row label="mask gaze target" value={gaze.target} />
            <Row label="door phase" value={d.phase} />
            <Row label="door opened" value={d.opened ? 'YES' : 'no'} />
            <Row label="open amount" value={fmt(d.openAmount)} />
          </div>
          {DOOR_SLIDERS.map((def) => (
            <Slider key={def.key} def={def} value={t[def.key]} />
          ))}
          <Toggle
            k="showDoorOccluderDebug"
            label="Occluder wireframe"
            value={t.showDoorOccluderDebug}
          />
          <div className="debug-buttons">
            <button onClick={() => doorPuzzle.lookAtDoor()}>LOOK AT DOOR</button>
            <button onClick={() => doorPuzzle.forceOpen()}>OPEN DOOR</button>
            <button onClick={() => doorPuzzle.reset()}>RESET DOOR</button>
          </div>
        </>
      )}
    </section>
  );
}

function EndingSection() {
  const e = useEndingPuzzle();
  const [open, setOpen] = useState(true);

  return (
    <section>
      <button className="debug-collapse" onClick={() => setOpen((o) => !o)}>
        <span>ENDING</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <>
          <div className="debug-readout">
            <Row label="ending phase" value={e.phase} />
            <Row label="fragment restored" value={liveStats.fragmentRestored ? 'YES' : 'no'} />
            <Row label="ending complete" value={liveStats.endingComplete ? 'YES' : 'no'} />
            <Row label="door opened (gate)" value={liveStats.doorOpened ? 'YES' : 'no'} />
          </div>
          <p className="debug-note">
            Debug force paths below may force-open the door for testing. They do not replace normal
            door progression — use DOOR controls to verify real OPEN state.
          </p>
          <div className="debug-buttons">
            <button onClick={() => endingPuzzle.forceFragmentAvailable()}>
              FORCE FRAGMENT AVAILABLE
            </button>
            <button onClick={() => endingPuzzle.playRestoration()}>PLAY RESTORATION</button>
            <button onClick={() => endingPuzzle.skipToAcknowledgement()}>
              SKIP TO ACKNOWLEDGE
            </button>
            <button onClick={() => endingPuzzle.reset()}>RESET ENDING</button>
          </div>
        </>
      )}
    </section>
  );
}

function MaskSection() {
  const t = useTuning();
  const gaze = useMaskGaze();
  const [open, setOpen] = useState(true);
  const [lastTarget, setLastTarget] = useState<GazeTargetName>('CENTER');
  const m = maskDirector;
  const { leftEye: l, rightEye: r, mask, gazePoint: g } = m.stats;
  const world = gaze.mode === 'LOOK_AT_WORLD_TARGET';

  const lookAt = (name: GazeTargetName) => {
    setLastTarget(name);
    m.lookAt(name);
  };

  return (
    <section>
      <button className="debug-collapse" onClick={() => setOpen((o) => !o)}>
        <span>MASK</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <>
          <div className="debug-label">GAZE MODE</div>
          <label className="debug-radio">
            <input type="radio" checked={!world} onChange={() => m.lookAtPlayer()} />
            PLAYER
          </label>
          <label className="debug-radio">
            <input type="radio" checked={world} onChange={() => lookAt(lastTarget)} />
            WORLD
          </label>
          <div className="debug-grid">
            <button onClick={() => m.lookAtPlayer()}>LOOK AT PLAYER</button>
            <button onClick={() => lookAt('LEFT')}>LOOK LEFT</button>
            <button onClick={() => lookAt('CENTER')}>LOOK CENTER</button>
            <button onClick={() => lookAt('RIGHT')}>LOOK RIGHT</button>
          </div>

          <div className="debug-readout">
            <Row label="phase" value={m.getPhase()} />
            <Row label="gaze mode" value={gaze.mode} />
            <Row label="gaze target" value={gaze.target} />
            <Row label="gaze point" value={xyz(g)} />
            <Row label="eye contact" value={fmt(m.eyes.contact)} />
            <Row label="L eye yaw/pitch" value={`${deg(l.yaw)} ${deg(l.pitch)}`} />
            <Row label="R eye yaw/pitch" value={`${deg(r.yaw)} ${deg(r.pitch)}`} />
            <Row label="mask yaw/pitch" value={`${deg(mask.yaw)} ${deg(mask.pitch)}`} />
            <Row label="lid closure" value={fmt(m.lids.closure)} />
          </div>

          {MASK_SLIDERS.map((def) => (
            <Slider key={def.key} def={def} value={t[def.key]} />
          ))}
          <Toggle k="autoBlink" label="AUTO BLINK" value={t.autoBlink} />

          <div className="debug-grid">
            <button onClick={() => m.blinkNow()}>BLINK NOW</button>
            <button onClick={() => m.replayAwakening()}>REPLAY AWAKENING</button>
            <button onClick={() => m.closeEyes()}>CLOSE EYES</button>
            <button onClick={() => m.openEyes()}>OPEN EYES</button>
          </div>
        </>
      )}
    </section>
  );
}

function deg(v: number) {
  return `${fmt(v, 1)}°`;
}

function Slider({ def, value }: { def: SliderDef; value: number }) {
  const { key, label, min, max, step } = def;
  const digits = step >= 1 ? 0 : step < 0.01 ? 3 : 2;
  return (
    <label className="debug-slider">
      <span>
        {label}
        <b>{value.toFixed(digits)}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => tuning.set({ [key]: Number(e.target.value) })}
      />
    </label>
  );
}

function Toggle({ k, label, value }: { k: BooleanKey; label: string; value: boolean }) {
  return (
    <label className="debug-radio">
      <input type="checkbox" checked={value} onChange={(e) => tuning.set({ [k]: e.target.checked })} />
      {label}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="debug-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function xyz(p: { x: number; y: number; z: number }) {
  return `${fmt(p.x)}  ${fmt(p.y)}  ${fmt(p.z)}`;
}

function fmt(v: number, digits = 2) {
  return (v >= 0 ? ' ' : '') + v.toFixed(digits);
}
