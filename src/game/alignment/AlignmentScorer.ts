import type { Camera, Vector3 } from 'three';
import { projectToScreen, type ScreenPoint } from './projectToScreen';

export interface AlignmentAnchor {
  /** World-space reference point. */
  world: Vector3;
  /** Ideal NDC position when the puzzle is solved. */
  ideal: ScreenPoint;
}

export interface AlignmentResult {
  /** Combined score 0..1 used for feedback (min of mean and worst anchor). */
  score: number;
  /** Mean of per-anchor scores. */
  mean: number;
  /** Worst per-anchor score — gates HOLDING to avoid two-of-three false positives. */
  min: number;
  /** Per-anchor scores, same order as anchors. */
  perAnchor: number[];
  /** Current projected NDC for each anchor. */
  projected: ScreenPoint[];
}

function smooth01(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Reusable screen-space alignment scorer.
 * Compares live camera projections of world anchors to an authored ideal NDC layout.
 * Never reads HeadPose — only the active camera and world geometry.
 */
export class AlignmentScorer {
  private readonly projected: ScreenPoint[] = [];
  private readonly perAnchor: number[] = [];

  /**
   * @param tolerance NDC distance at which an anchor scores ~0 (beyond this → 0).
   */
  score(camera: Camera, anchors: readonly AlignmentAnchor[], tolerance: number): AlignmentResult {
    const n = anchors.length;
    while (this.projected.length < n) this.projected.push({ x: 0, y: 0 });
    this.perAnchor.length = n;

    const tol = Math.max(1e-4, tolerance);
    let sum = 0;
    let min = 1;

    for (let i = 0; i < n; i++) {
      const p = projectToScreen(anchors[i].world, camera, this.projected[i]);
      const ideal = anchors[i].ideal;
      const dist = Math.hypot(p.x - ideal.x, p.y - ideal.y);
      // 1 at perfect alignment, 0 at/beyond tolerance; smoothstep softens the edge.
      const s = smooth01(1 - dist / tol);
      this.perAnchor[i] = s;
      sum += s;
      if (s < min) min = s;
    }

    const mean = n > 0 ? sum / n : 0;
    // Combined score: a single bad anchor pulls the whole score down.
    const score = Math.min(mean, min);

    return {
      score,
      mean,
      min: n > 0 ? min : 0,
      perAnchor: this.perAnchor,
      projected: this.projected,
    };
  }
}
