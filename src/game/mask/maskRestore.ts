import type { Group } from 'three';
import { Vector3 } from 'three';

/** Center of the mask, toward the back of the room. */
export const MASK_POSITION = new Vector3(0, 0.2, -1.9);

/** Stable local pose of the restored shard on the mask face. */
export const MASK_RESTORE_LOCAL = new Vector3(0.055, 0.11, 0.055);

let restoreSlot: Group | null = null;

export function setMaskRestoreSlot(group: Group | null) {
  restoreSlot = group;
}

export function getMaskRestoreSlot() {
  return restoreSlot;
}
