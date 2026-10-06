import { useSyncExternalStore } from "react";

/**
 * Live-tunable constants. Read every frame via `tuning.get()` (no React
 * re-render), or subscribe from UI with `useTuning()`.
 *
 * World units: the portrait design window is 1 unit wide (~ a phone width).
 */
export interface Tuning {
  /** Multiplies normalized head X before it reaches the camera. */
  sensitivityX: number;
  /** Multiplies normalized head Y before it reaches the camera. */
  sensitivityY: number;
  /** Multiplies normalized head Z (distance) before it reaches the camera. */
  depthSensitivity: number;
  /** Let tracked head Z move the eye toward/away from the screen. Off = fixed eyeDistance. */
  enableHeadDepth: boolean;
  /** Normalized head Z treated as "normal distance" (no depth response). */
  depthDeadZone: number;
  /** Exponential smoothing time constant for eye distance, seconds. 0 = immediate. */
  depthSmoothing: number;
  /** Closest the eye may get, as a fraction of eyeDistance. */
  minEyeDistanceScale: number;
  /** Farthest the eye may get, as a fraction of eyeDistance. */
  maxEyeDistanceScale: number;
  /** Exponential smoothing time constant in seconds. 0 = raw input. */
  smoothing: number;
  /** Normalized head X/Y treated as still (no eye travel). */
  headDeadZone: number;
  /** Global multiplier on eye displacement. 0 = no parallax at all. */
  perspectiveStrength: number;
  /** World units of horizontal eye travel per unit of normalized head X. */
  exaggerationX: number;
  /** World units of vertical eye travel per unit of normalized head Y. */
  exaggerationY: number;
  /** Neutral distance from the eye to the screen plane, in world units. */
  eyeDistance: number;
  /** Max radial eye offset from the window center, in world units. */
  maxDisplacement: number;
  /** Screen-space tolerance for puzzle alignment (NDC distance → score 0). */
  keyTolerance: number;
  /** Combined alignment score required to begin/continue HOLDING. */
  keySolveThreshold: number;
  /** Every required anchor must clear this before HOLDING can begin. */
  keyMinAnchorScore: number;
  /** Alignment score at which subtle shimmer begins. */
  keyShimmerLow: number;
  /** Alignment score at which stronger glow begins. */
  keyShimmerHigh: number;
  /** Seconds the solve threshold must be held before KEY FOUND. */
  keyHoldDuration: number;
  /** Live offset applied to the whole key fragment group (world units). */
  keyOffsetX: number;
  keyOffsetY: number;
  keyOffsetZ: number;
  /** Solve-silhouette NDC (screen space) for each anchor. */
  keyBowNdcX: number;
  keyBowNdcY: number;
  keyShaftLeftNdcX: number;
  keyShaftLeftNdcY: number;
  keyShaftRightNdcX: number;
  keyShaftRightNdcY: number;
  keyToothNdcX: number;
  keyToothNdcY: number;
  /** World Z for each fragment layer (more negative = farther). */
  keyDepthBow: number;
  keyDepthShaft: number;
  keyDepthTooth: number;
  /** When true, fragments fade out after KEY FOUND. Off = stay visible for debugging. */
  keyDisappearOnFound: boolean;
  /** Dev only: show projected alignment anchors / ideal targets. */
  showKeyAlignmentDebug: boolean;
  /** Live offsets for the hidden door assembly (world units). */
  doorOffsetX: number;
  doorOffsetY: number;
  doorOffsetZ: number;
  /** Live offsets for the left occluder slab (world units). */
  occluderOffsetX: number;
  occluderOffsetY: number;
  occluderOffsetZ: number;
  /** Dev only: render the door occluder as wireframe for placement. */
  showDoorOccluderDebug: boolean;
  /** Show the normalized head-position dot overlay. */
  showTrackingDot: boolean;
  /** Max face-tracking inferences per second (render rate is independent). */
  trackingRate: number;
  /** Flip head X, for cameras that deliver mirrored frames. */
  invertX: boolean;
  /** Dev only: show a small mirrored camera preview with landmarks. */
  showCameraPreview: boolean;

  /** Mask eye response, as a critically damped spring rate (1/s). Higher = snappier. */
  eyeResponse: number;
  /** Max eyeball yaw, degrees. */
  eyeLimitX: number;
  /** Max eyeball pitch, degrees. */
  eyeLimitY: number;
  /** Fraction of the gaze angle the mask itself turns toward. */
  maskFollowStrength: number;
  /** Mask turn smoothing, seconds (roughly time to settle most of the way). */
  maskFollowSmoothing: number;
  /** Hard cap on mask rotation, degrees. */
  maskMaxAngle: number;
  /** Angle (degrees) from the mask's forward axis within which gaze locks onto the player. */
  eyeContactTolerance: number;
  /** Periodic natural blinking. */
  autoBlink: boolean;
}

export const DEFAULT_TUNING: Tuning = {
  sensitivityX: 1,
  sensitivityY: 1,
  depthSensitivity: 1,
  enableHeadDepth: false,
  depthDeadZone: 0.08,
  depthSmoothing: 0.4,
  minEyeDistanceScale: 0.75,
  maxEyeDistanceScale: 1.4,
  smoothing: 0.14,
  headDeadZone: 0.04,
  perspectiveStrength: 1,
  /** Stronger lateral peek so left-wall doorway / fragment stay reachable. */
  exaggerationX: 2.1,
  exaggerationY: 1.0,
  eyeDistance: 5,
  maxDisplacement: 2.8,
  keyTolerance: 0.08,
  keySolveThreshold: 0.95,
  keyMinAnchorScore: 0.9,
  keyShimmerLow: 0.7,
  keyShimmerHigh: 0.85,
  keyHoldDuration: 0.5,
  keyOffsetX: 0,
  keyOffsetY: 0,
  keyOffsetZ: 0,
  // Classic key: ring · long shaft · single thick tooth hanging from the tip.
  keyBowNdcX: -0.2,
  keyBowNdcY: 0.0,
  keyShaftLeftNdcX: -0.04,
  keyShaftLeftNdcY: 0,
  keyShaftRightNdcX: 0.45,
  keyShaftRightNdcY: 0,
  // Keep tooth X near shaft tip so the bar is nearly vertical (same depth plane).
  keyToothNdcX: 0.38,
  keyToothNdcY: -0.1,
  keyDepthBow: -1.3,
  keyDepthShaft: -0.95,
  keyDepthTooth: -0.45,
  keyDisappearOnFound: true,
  showKeyAlignmentDebug: false,
  doorOffsetX: 0,
  doorOffsetY: 0,
  doorOffsetZ: 0,
  occluderOffsetX: 0,
  occluderOffsetY: 0,
  occluderOffsetZ: 0,
  showDoorOccluderDebug: false,
  showTrackingDot: true,
  trackingRate: 30,
  invertX: false,
  showCameraPreview: false,

  eyeResponse: 14,
  eyeLimitX: 32,
  eyeLimitY: 24,
  maskFollowStrength: 0.22,
  maskFollowSmoothing: 0.7,
  maskMaxAngle: 4,
  eyeContactTolerance: 7,
  autoBlink: true,
};

type Listener = () => void;

function createTuningStore(initial: Tuning) {
  let state = { ...initial };
  const listeners = new Set<Listener>();
  return {
    get: (): Readonly<Tuning> => state,
    set(patch: Partial<Tuning>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    reset() {
      state = { ...initial };
      listeners.forEach((l) => l());
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const tuning = createTuningStore(DEFAULT_TUNING);

export function useTuning(): Readonly<Tuning> {
  return useSyncExternalStore(tuning.subscribe, tuning.get);
}
