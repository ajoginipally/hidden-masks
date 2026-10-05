import { Vector3 } from 'three';
import { DEG, smoothstep, stepSpring, type Spring1 } from './spring';

export type GazeMode = 'FOLLOW_PLAYER' | 'LOOK_AT_WORLD_TARGET';

export interface GazeSettings {
  /** Spring rate for gaze direction (1/s). */
  response: number;
  /** Eye-contact zone half-angle, degrees, around the gazer's forward axis. */
  contactTolerance: number;
}

/** Outside the eye-contact zone the gaze trails the player very slightly. */
const FOLLOW_PRECISION = 0.93;
/** Inside the zone the gaze holds on more tightly. */
const CONTACT_RESPONSE_BOOST = 0.8;

/**
 * Decides *where* a pair of eyes looks, in world space. Knows nothing about
 * meshes: callers feed it the gaze origin and the player's eye position each
 * frame and read back `gazePoint`, then aim their own eyeballs at it.
 *
 * Gaze is smoothed as a world-space direction + distance from the origin,
 * so when the head carrying the eyes turns, the eyes stay on target.
 */
export class EyeController {
  mode: GazeMode = 'FOLLOW_PLAYER';
  readonly worldTarget = new Vector3();
  worldTargetLabel = '';

  /** Overrides both modes while set (e.g. the awakening stare). */
  overrideDir: Vector3 | null = null;

  /** World point the eyes are currently looking at (smoothed). */
  readonly gazePoint = new Vector3();
  /** 0..1, how strongly the gaze is locked onto the player. */
  contact = 0;

  private readonly dir = [
    { x: 0, v: 0 },
    { x: 0, v: 0 },
    { x: 1, v: 0 },
  ] as Spring1[];
  private readonly dist: Spring1 = { x: 7, v: 0 };
  private readonly desired = new Vector3();
  private readonly toPlayer = new Vector3();

  setGazeMode(mode: GazeMode) {
    this.mode = mode;
  }

  setWorldTarget(position: Vector3, label = '') {
    this.worldTarget.copy(position);
    this.worldTargetLabel = label;
  }

  /** Jump straight to looking along `dir` (no animation). */
  snapTo(dir: Vector3, distance: number) {
    const d = dir.clone().normalize();
    this.dir[0].x = d.x;
    this.dir[1].x = d.y;
    this.dir[2].x = d.z;
    for (const s of this.dir) s.v = 0;
    this.dist.x = distance;
    this.dist.v = 0;
  }

  /**
   * @param origin  world position between the eyes
   * @param forward world-space neutral facing of the gazer (unit)
   * @param player  world position of the viewer's eye
   */
  update(dt: number, origin: Vector3, forward: Vector3, player: Vector3, s: GazeSettings) {
    this.toPlayer.subVectors(player, origin);
    const playerDist = this.toPlayer.length();
    this.toPlayer.divideScalar(playerDist || 1);

    const angle = Math.acos(Math.min(1, Math.max(-1, this.toPlayer.dot(forward)))) / DEG;
    const tol = Math.max(0.1, s.contactTolerance);
    const inZone = 1 - smoothstep(tol * 0.5, tol, angle);

    let distance: number;
    if (this.overrideDir) {
      this.desired.copy(this.overrideDir).normalize();
      distance = playerDist;
      this.contact = 0;
    } else if (this.mode === 'FOLLOW_PLAYER') {
      // Gently bias toward exact eye contact near the center.
      const precision = FOLLOW_PRECISION + (1 - FOLLOW_PRECISION) * inZone;
      this.desired.copy(forward).lerp(this.toPlayer, precision).normalize();
      distance = playerDist;
      this.contact = inZone;
    } else {
      this.desired.subVectors(this.worldTarget, origin);
      distance = this.desired.length();
      this.desired.divideScalar(distance || 1);
      this.contact = 0;
    }

    const omega = s.response * (1 + CONTACT_RESPONSE_BOOST * this.contact);
    stepSpring(this.dir[0], this.desired.x, omega, dt);
    stepSpring(this.dir[1], this.desired.y, omega, dt);
    stepSpring(this.dir[2], this.desired.z, omega, dt);
    stepSpring(this.dist, distance, omega, dt);

    this.gazePoint
      .set(this.dir[0].x, this.dir[1].x, this.dir[2].x)
      .normalize()
      .multiplyScalar(Math.max(0.05, this.dist.x))
      .add(origin);
  }

  /** Current smoothed gaze direction (unit, world). */
  getDirection(out: Vector3): Vector3 {
    return out.set(this.dir[0].x, this.dir[1].x, this.dir[2].x).normalize();
  }
}

/** Yaw/pitch (radians) that make a +Z-facing object look at `local` from `from`. */
export function aimAngles(from: Vector3, local: Vector3, out: { yaw: number; pitch: number }) {
  const dx = local.x - from.x;
  const dy = local.y - from.y;
  const dz = local.z - from.z;
  out.yaw = Math.atan2(dx, dz);
  out.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return out;
}
