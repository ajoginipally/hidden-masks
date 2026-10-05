/**
 * Viewer head position relative to the calibrated neutral position.
 *
 * x: -1 (head left) .. +1 (head right)
 * y: -1 (head down) .. +1 (head up)
 * z: 0 at calibrated distance, positive = farther from the screen
 * confidence: 0..1
 */
export interface HeadPose {
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export function neutralPose(): HeadPose {
  return { x: 0, y: 0, z: 0, confidence: 1 };
}

/** Anything that can supply a head pose each frame (pointer, face tracker...). */
export interface HeadPoseSource {
  readonly pose: Readonly<HeadPose>;
}
