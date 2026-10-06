import { Camera, Vector3 } from 'three';

export interface ScreenPoint {
  x: number;
  y: number;
}

const _v = new Vector3();

/** Project a world-space point to normalized device coordinates (-1..1). */
export function projectToScreen(world: Vector3, camera: Camera, out: ScreenPoint = { x: 0, y: 0 }): ScreenPoint {
  _v.copy(world).project(camera);
  out.x = _v.x;
  out.y = _v.y;
  return out;
}

/**
 * Place a world point on the ray from the camera through a given NDC coordinate,
 * at a fixed world Z (behind the window). Used to author perspective-aligned layouts.
 */
export function worldPointFromNdc(camera: Camera, ndcX: number, ndcY: number, worldZ: number, out = new Vector3()): Vector3 {
  const near = new Vector3(ndcX, ndcY, -1).unproject(camera);
  const far = new Vector3(ndcX, ndcY, 1).unproject(camera);
  const dz = far.z - near.z;
  const t = Math.abs(dz) < 1e-8 ? 0 : (worldZ - near.z) / dz;
  return out.copy(near).lerp(far, t);
}
