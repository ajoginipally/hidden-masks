/**
 * Procedural description of the mask, in normalized face coordinates:
 * u = -1 (screen left edge) .. +1 (right edge), v = -1 (chin) .. +1 (crown).
 * The same functions drive the geometry (relief) and the painted textures
 * (silhouette, eye openings, inlays) so they always line up.
 */

export const MASK_WIDTH = 0.44;
export const MASK_HEIGHT = 0.6;

export const EYE = {
  /** Eye center, right eye (left eye mirrors u). */
  u: 0.36,
  v: 0.08,
  /** Half-extent of the almond opening. */
  halfU: 0.2,
  halfV: 0.08,
  /** Outer corners lift slightly. */
  tilt: 0.04,
};

/** Right half of the silhouette, crown to chin. Mirrored for the left. */
const OUTLINE_RIGHT: [number, number][] = [
  [0, 1],
  [0.3, 0.94],
  [0.64, 0.78],
  [0.88, 0.5],
  [0.97, 0.17],
  [0.9, -0.16],
  [0.72, -0.5],
  [0.42, -0.82],
  [0, -1],
];

export const OUTLINE: [number, number][] = [
  ...OUTLINE_RIGHT,
  ...OUTLINE_RIGHT.slice(1, -1)
    .reverse()
    .map(([u, v]) => [-u, v] as [number, number]),
];

const g = (x: number, s: number) => Math.exp(-(x / s) * (x / s));

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Surface height toward the viewer (world units) at (u, v). */
export function surfaceZ(u: number, v: number): number {
  const au = Math.abs(u);
  const base = 0.075 * (1 - 0.8 * u * u) * (1 - 0.25 * v * v);
  const brow = 0.011 * g(v - 0.26, 0.08) * (1 - 0.5 * u * u);
  const socket = -0.02 * g(au - EYE.u, 0.22) * g(v - EYE.v, 0.13);
  const along = Math.min(1, Math.max(0, (0.15 - v) / 0.45));
  const nose = (0.006 + 0.02 * along) * g(u, 0.06 + 0.05 * along) * smooth(-0.44, -0.3, v) * smooth(0.32, 0.12, v);
  const cheeks = 0.01 * g(au - 0.5, 0.18) * g(v + 0.22, 0.14);
  const chin = 0.007 * g(u, 0.25) * g(v + 0.8, 0.12);
  const crest = 0.004 * g(u, 0.05) * g(v - 0.6, 0.08);
  return base + brow + socket + nose + cheeks + chin + crest;
}

export type ToPx = (u: number, v: number) => [number, number];

/** Closed Catmull-Rom path through the outline. */
export function traceOutline(ctx: CanvasRenderingContext2D, toPx: ToPx, inset = 1) {
  const pts = OUTLINE.map(([u, v]) => toPx(u * inset, v * inset));
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
  ctx.closePath();
}

/** Almond eye opening. side = +1 (screen right) or -1 (screen left). */
export function traceEye(ctx: CanvasRenderingContext2D, toPx: ToPx, side: 1 | -1, grow = 0) {
  const { u, v, halfU, halfV, tilt } = EYE;
  const hu = halfU + grow;
  const hv = halfV + grow * 0.8;
  const inner = toPx(side * (u - hu), v - tilt * 0.3);
  const outer = toPx(side * (u + hu), v + tilt);
  const top = toPx(side * (u - 0.01), v + 2 * hv);
  const bottom = toPx(side * (u + 0.02), v - 1.6 * hv);
  ctx.beginPath();
  ctx.moveTo(inner[0], inner[1]);
  ctx.quadraticCurveTo(top[0], top[1], outer[0], outer[1]);
  ctx.quadraticCurveTo(bottom[0], bottom[1], inner[0], inner[1]);
  ctx.closePath();
}
