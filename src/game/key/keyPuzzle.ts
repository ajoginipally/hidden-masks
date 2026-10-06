import { useSyncExternalStore } from 'react';
import type { Camera, PerspectiveCamera } from 'three';
import { tuning } from '../../config/tuning';
import { liveStats } from '../../debug/liveStats';
import { OffAxisCamera } from '../../rendering/OffAxisCamera';
import { AlignmentScorer } from '../alignment/AlignmentScorer';
import { projectToScreen, type ScreenPoint } from '../alignment/projectToScreen';
import { buildKeyLayout, KEY_DESIGN_EYE, type KeyFragmentLayout } from './keyLayout';

export type KeyPhase = 'SEARCHING' | 'SHIMMER' | 'HOLDING' | 'SOLVING' | 'FOUND';

/** Brief confirmation flash after hold completes, before fragments fade. */
const SOLVING_DURATION = 0.7;

/**
 * Perspective-key puzzle state. Scores alignment from the active camera's
 * projection of world anchors — never from HeadPose directly.
 */
function createKeyPuzzle() {
  const scorer = new AlignmentScorer();
  const designCam = new OffAxisCamera();
  const listeners = new Set<() => void>();

  let layout = buildKeyLayout();
  let phase: KeyPhase = 'SEARCHING';
  let score = 0;
  let mean = 0;
  let min = 0;
  let hold = 0;
  let solveT = 0;
  let fade = 1;
  let glow = 0;
  let keyFound = false;
  let projected: ScreenPoint[] = [];
  let ideals: ScreenPoint[] = layout.anchors.map((a) => ({ ...a.ideal }));
  let lastAspect = -1;

  const emit = () => listeners.forEach((l) => l());

  const rebuildLayout = () => {
    layout = buildKeyLayout();
    lastAspect = -1;
  };

  /** Ideal NDC must match the live aspect so score=1 at the design eye on any screen. */
  const refreshIdeals = (aspect: number) => {
    if (Math.abs(aspect - lastAspect) < 1e-4) return;
    lastAspect = aspect;
    designCam.setAspect(aspect);
    designCam.setEye(KEY_DESIGN_EYE.x, KEY_DESIGN_EYE.y, KEY_DESIGN_EYE.z);
    designCam.updateMatrixWorld(true);
    for (const a of layout.anchors) {
      const p = projectToScreen(a.world, designCam);
      a.ideal.x = p.x;
      a.ideal.y = p.y;
    }
    ideals = layout.anchors.map((a) => ({ ...a.ideal }));
  };

  const writeStats = () => {
    liveStats.alignmentScore = score;
    liveStats.alignmentMean = mean;
    liveStats.alignmentMin = min;
    liveStats.keyHoldProgress = hold;
    liveStats.keyPhase = phase;
    liveStats.keyFound = keyFound;
    liveStats.keyProjected = projected;
    liveStats.keyIdeals = ideals;
  };

  const snapshot = () => ({
    phase,
    score,
    mean,
    min,
    hold,
    keyFound,
    fade,
    glow,
  });

  let lastSnap = snapshot();

  const maybeEmit = () => {
    const next = snapshot();
    if (
      next.phase !== lastSnap.phase ||
      next.keyFound !== lastSnap.keyFound ||
      Math.abs(next.score - lastSnap.score) > 0.01 ||
      Math.abs(next.hold - lastSnap.hold) > 0.02 ||
      Math.abs(next.fade - lastSnap.fade) > 0.02 ||
      Math.abs(next.glow - lastSnap.glow) > 0.05
    ) {
      lastSnap = next;
      emit();
    }
  };

  return {
    getLayout: (): KeyFragmentLayout => layout,
    getPhase: () => phase,
    getScore: () => score,
    getMean: () => mean,
    getMin: () => min,
    getHold: () => hold,
    getFade: () => fade,
    getGlow: () => glow,
    isFound: () => keyFound,
    getProjected: () => projected,
    getIdeals: () => ideals,

    rebuildLayout,

    reset() {
      phase = 'SEARCHING';
      score = mean = min = hold = solveT = glow = 0;
      fade = 1;
      keyFound = false;
      rebuildLayout();
      writeStats();
      lastSnap = snapshot();
      emit();
    },

    /**
     * Advance the puzzle using the current frame's camera.
     * Call after HeadTrackedCamera has updated the projection.
     */
    update(dt: number, camera: Camera) {
      const t = tuning.get();
      const disappear = t.keyDisappearOnFound;

      // Always keep projection debug fresh, even after FOUND.
      refreshIdeals((camera as PerspectiveCamera).aspect);
      const result = scorer.score(camera, layout.anchors, t.keyTolerance);
      score = result.score;
      mean = result.mean;
      min = result.min;
      projected = result.projected.map((p) => ({ x: p.x, y: p.y }));

      if (phase === 'FOUND') {
        fade = disappear ? 0 : 1;
        glow = disappear ? 0 : Math.max(0, (score - t.keyShimmerLow) / Math.max(0.01, 1 - t.keyShimmerLow));
        writeStats();
        maybeEmit();
        return;
      }

      if (phase === 'SOLVING') {
        solveT += dt;
        glow = 1;
        if (disappear) {
          fade =
            solveT < SOLVING_DURATION * 0.45
              ? 1
              : Math.max(0, 1 - (solveT - SOLVING_DURATION * 0.45) / (SOLVING_DURATION * 0.55));
        } else {
          fade = 1;
        }
        if (solveT >= SOLVING_DURATION) {
          phase = 'FOUND';
          keyFound = true;
          fade = disappear ? 0 : 1;
          glow = disappear ? 0 : 1;
        }
        writeStats();
        maybeEmit();
        return;
      }

      const shimmer = Math.max(0, (score - t.keyShimmerLow) / Math.max(0.01, 1 - t.keyShimmerLow));
      glow = shimmer * shimmer;

      const hyst = 0.03;
      const holding = phase === 'HOLDING';
      const canHold =
        score >= t.keySolveThreshold - (holding ? hyst : 0) &&
        min >= t.keyMinAnchorScore - (holding ? hyst : 0);

      if (canHold) {
        hold = Math.min(1, hold + dt / Math.max(0.05, t.keyHoldDuration));
        phase = hold >= 1 ? 'SOLVING' : 'HOLDING';
        if (phase === 'SOLVING') {
          solveT = 0;
          glow = 1;
        }
      } else {
        hold = Math.max(0, hold - dt / 0.2);
        phase = score >= t.keyShimmerLow ? 'SHIMMER' : 'SEARCHING';
      }

      writeStats();
      maybeEmit();
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => lastSnap,
  };
}

export const keyPuzzle = createKeyPuzzle();

export function useKeyPuzzle() {
  return useSyncExternalStore(keyPuzzle.subscribe, keyPuzzle.getSnapshot);
}
