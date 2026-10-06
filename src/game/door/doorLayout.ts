import { Vector3 } from 'three';

/**
 * Doorway cut into the left room wall (shell), not a freestanding prop.
 *
 * Wall faces +X into the chamber. Opening lies in the YZ plane.
 * `width` spans Z; `height` spans Y. Passage extends outward (−X).
 */
export const DOOR_BASE = {
  /**
   * Opening center on the left wall (world Y / Z). X comes from live −W/2.
   * Kept forward enough that an extreme OffAxis peek clears the buttress.
   */
  opening: { y: -0.55, z: -1.48 },
  /** Clear opening size: width along wall (Z), height (Y), leaf thickness (X). */
  doorSize: { w: 0.28, h: 0.4, d: 0.028 },
  /** Wall mass thickness around the aperture (into the room, +X). */
  wallThickness: 0.11,
  /** Fake passage depth beyond the outer face (−X). */
  passageDepth: 0.42,
  /** Leaf set back from the inner wall face. */
  leafRecess: 0.02,
  /**
   * Low buttress / wall-return occluder on the floor, meeting the left wall.
   * Hides the opening from neutral; shorter/thinner so max peek clears the aperture.
   */
  occluder: { z: -1.12 },
  occluderSize: { x: 0.16, y: 0.42, z: 0.2 },
} as const;

/** Gaze aim — X filled in at runtime from the live left-wall face. */
export const DOOR_GAZE_TARGET = new Vector3(-0.5, DOOR_BASE.opening.y + 0.02, DOOR_BASE.opening.z);

export function doorOpeningPos(
  leftWallX: number,
  offset: { x: number; y: number; z: number },
) {
  return {
    x: leftWallX + offset.x,
    y: DOOR_BASE.opening.y + offset.y,
    z: DOOR_BASE.opening.z + offset.z,
  };
}

/** Occluder sits on the floor and butts against the left wall. */
export function occluderWorldPos(
  leftWallX: number,
  floorY: number,
  offset: { x: number; y: number; z: number },
) {
  const { x: sx, y: sy } = DOOR_BASE.occluderSize;
  return {
    x: leftWallX + sx / 2 + 0.01 + offset.x,
    y: floorY + sy / 2 + offset.y,
    z: DOOR_BASE.occluder.z + offset.z,
  };
}
