/**
 * Critically damped spring, solved in closed form so it is exact for any dt
 * (frame-rate independent). Starts and stops smoothly, never overshoots.
 */
export interface Spring1 {
  x: number;
  v: number;
}

export function stepSpring(s: Spring1, target: number, omega: number, dt: number) {
  const e = Math.exp(-omega * dt);
  const delta = s.x - target;
  const temp = (s.v + omega * delta) * dt;
  s.x = target + (delta + temp) * e;
  s.v = (s.v - omega * temp) * e;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export const DEG = Math.PI / 180;
