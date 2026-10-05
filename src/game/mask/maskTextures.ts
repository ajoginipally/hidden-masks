import { CanvasTexture, NoColorSpace, SRGBColorSpace, type Texture } from 'three';
import { EYE, traceEye, traceOutline, type ToPx } from './maskShape';
import { mulberry32 } from './random';

const TEX_W = 512;
const TEX_H = 704;

const toPx: ToPx = (u, v) => [((u + 1) / 2) * TEX_W, ((1 - v) / 2) * TEX_H];

export interface MaskTextures {
  color: Texture;
  /** Silhouette + eye openings (white = solid). */
  alpha: Texture;
  /** glTF convention: G = roughness, B = metalness. */
  roughMetal: Texture;
}

let cached: MaskTextures | null = null;

/** Painted on canvases once and shared. */
export function getMaskTextures(): MaskTextures {
  if (cached) return cached;
  cached = {
    color: finish(paintColor(), SRGBColorSpace),
    alpha: finish(paintAlpha(), NoColorSpace),
    roughMetal: finish(paintRoughMetal(), NoColorSpace),
  };
  return cached;
}

function finish(canvas: HTMLCanvasElement, colorSpace: string): Texture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.anisotropy = 4;
  return tex;
}

function canvas2d(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = TEX_W;
  c.height = TEX_H;
  return [c, c.getContext('2d')!];
}

function paintAlpha() {
  const [c, ctx] = canvas2d();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = '#fff';
  traceOutline(ctx, toPx);
  ctx.fill();
  ctx.fillStyle = '#000';
  traceEye(ctx, toPx, 1);
  ctx.fill();
  traceEye(ctx, toPx, -1);
  ctx.fill();
  return c;
}

const GOLD = '#c79a52';

/** Gold inlays: edge trim, eye rims, and the crown seam with its lozenge. */
function paintInlays(ctx: CanvasRenderingContext2D, style: string) {
  ctx.strokeStyle = style;
  ctx.fillStyle = style;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.lineWidth = 9;
  traceOutline(ctx, toPx);
  ctx.stroke();

  ctx.lineWidth = 2;
  traceOutline(ctx, toPx, 0.93);
  ctx.stroke();

  ctx.lineWidth = 5;
  traceEye(ctx, toPx, 1, 0.012);
  ctx.stroke();
  traceEye(ctx, toPx, -1, 0.012);
  ctx.stroke();

  const [sx, sy] = toPx(0, 0.93);
  const [ex, ey] = toPx(0, 0.34);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  const [lx, ly] = toPx(0, 0.6);
  ctx.beginPath();
  ctx.moveTo(lx, ly - 22);
  ctx.lineTo(lx + 9, ly);
  ctx.lineTo(lx, ly + 22);
  ctx.lineTo(lx - 9, ly);
  ctx.closePath();
  ctx.fill();

  // Fine lines sweeping from the outer eye corners toward the temples.
  ctx.lineWidth = 2;
  for (const side of [1, -1]) {
    const [ax, ay] = toPx(side * (EYE.u + EYE.halfU + 0.04), EYE.v + EYE.tilt + 0.02);
    const [bx, by] = toPx(side * 0.8, 0.42);
    const [cx, cy] = toPx(side * 0.72, 0.22);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(cx, cy, bx, by);
    ctx.stroke();
  }
}

function paintColor() {
  const [c, ctx] = canvas2d();
  const rnd = mulberry32(0x1f0e);

  const [cx, cy] = toPx(0, 0.1);
  const base = ctx.createRadialGradient(cx, cy, 20, cx, cy, TEX_H * 0.6);
  base.addColorStop(0, '#ece2cd');
  base.addColorStop(0.6, '#d9ccb0');
  base.addColorStop(1, '#b3a284');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // Mottled aging.
  for (let i = 0; i < 520; i++) {
    const x = rnd() * TEX_W;
    const y = rnd() * TEX_H;
    const r = 6 + rnd() * 38;
    const dark = rnd() < 0.6;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, dark ? 'rgba(120,98,70,0.10)' : 'rgba(255,248,232,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Grime gathered in the eye sockets and under the brow.
  for (const side of [1, -1]) {
    const [ex, ey] = toPx(side * EYE.u, EYE.v);
    const grad = ctx.createRadialGradient(ex, ey, 30, ex, ey, 95);
    grad.addColorStop(0, 'rgba(70,52,34,0.55)');
    grad.addColorStop(1, 'rgba(70,52,34,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TEX_W, TEX_H);
  }

  // Darkened rim.
  ctx.save();
  traceOutline(ctx, toPx);
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(80,62,44,${0.06 + i * 0.02})`;
    ctx.lineWidth = 60 - i * 9;
    traceOutline(ctx, toPx);
    ctx.stroke();
  }
  ctx.restore();

  // A hairline crack running in from the lower left cheek.
  ctx.strokeStyle = 'rgba(60,44,30,0.55)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  let [x, y] = toPx(-0.78, -0.42);
  ctx.moveTo(x, y);
  for (let i = 0; i < 14; i++) {
    x += 5 + rnd() * 6;
    y += -2 + rnd() * 6;
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  paintInlays(ctx, GOLD);
  return c;
}

function paintRoughMetal() {
  const [c, ctx] = canvas2d();
  ctx.fillStyle = 'rgb(0,150,0)';
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  paintInlays(ctx, 'rgb(0,80,255)');
  return c;
}