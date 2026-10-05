import type { Frustum, WindowSize } from '../rendering/OffAxisCamera';
import { neutralPose, type HeadPose } from '../tracking/HeadPose';

/**
 * Mutable per-frame values written by the render loop and polled by the
 * debug UI. Intentionally not reactive: it is updated ~60 times a second.
 */
export const liveStats = {
  fps: 0,
  /** Unfiltered pose from the active source. */
  rawPose: neutralPose() as HeadPose,
  /** Pose handed to the camera (after tracker filtering / hold). */
  inputPose: neutralPose() as HeadPose,
  /** After the camera's exponential smoothing. */
  smoothedPose: neutralPose() as HeadPose,
  eye: { x: 0, y: 0, z: 0 },
  window: { width: 0, height: 0 } as WindowSize,
  frustum: { left: 0, right: 0, top: 0, bottom: 0, near: 0, far: 0 } as Frustum,
};
