import { useSyncExternalStore } from 'react';

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
  /** Exponential smoothing time constant in seconds. 0 = raw input. */
  smoothing: number;
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
  /** Screen-space tolerance for puzzle alignment (used from Milestone 4). */
  keyTolerance: number;
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
  smoothing: 0.05,
  perspectiveStrength: 1,
  exaggerationX: 1.3,
  exaggerationY: 1.0,
  eyeDistance: 5,
  maxDisplacement: 2,
  keyTolerance: 0.05,
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
