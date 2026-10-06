import { DOOR_BASE, doorOpeningPos } from '../door/doorLayout';

/**
 * Rest poses for the mask fragment.
 *
 * `shelf` — inside the passage (occluded while the leaf is shut).
 * `present` — just outside the open doorway in the room. OffAxisCamera never
 * yaws into −X, so a deep side-passage is unreadable; once the door opens the
 * shard eases here so it can be seen and tapped.
 */
export function fragmentPoses(
  leftWallX: number,
  doorOffset: { x: number; y: number; z: number },
) {
  const opening = doorOpeningPos(leftWallX, doorOffset);
  const { w, h, d } = DOOR_BASE.doorSize;
  const T = DOOR_BASE.wallThickness;
  const R = DOOR_BASE.leafRecess;

  const shelf = {
    x: leftWallX - 0.1,
    y: opening.y - h * 0.12,
    z: opening.z,
    shelfY: opening.y - h * 0.2,
  };

  // Clear of the swung leaf, in-room, still reading as “from the doorway”.
  const present = {
    x: leftWallX + T + 0.1,
    y: opening.y - h * 0.05,
    z: opening.z + w * 0.15,
  };

  // Closed-leaf mid pose (for reference / debug).
  const behindLeaf = {
    x: leftWallX + T - R - d - 0.01,
    y: opening.y,
    z: opening.z,
  };

  return { shelf, present, behindLeaf };
}

/** @deprecated use fragmentPoses().shelf */
export function fragmentShelfWorld(
  leftWallX: number,
  doorOffset: { x: number; y: number; z: number },
) {
  return fragmentPoses(leftWallX, doorOffset).shelf;
}
