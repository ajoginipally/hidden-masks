import { useSyncExternalStore } from 'react';
import { Vector3 } from 'three';
import { liveStats } from '../../debug/liveStats';
import { doorPuzzle } from '../door/doorPuzzle';
import { maskDirector } from '../mask/maskDirector';

export type EndingPhase =
  | 'WAITING'
  | 'FRAGMENT_AVAILABLE'
  | 'FRAGMENT_MOVING'
  | 'RESTORING'
  | 'ACKNOWLEDGING'
  | 'COMPLETE';

/** Ease out of the passage into the room after the door opens. */
const PRESENT_DURATION = 0.85;
const LIFT_DURATION = 0.28;
const TRAVEL_DURATION = 1.35;
const RESTORE_DURATION = 0.65;
/** Full eye-contact beat before the end card may appear. */
const ACK_DURATION = 2.4;

export interface EndingFlight {
  /** 0..1 emerge from passage to in-room present pose. */
  presentT: number;
  /** 0..1 overall progress through lift+travel. */
  travelT: number;
  /** 0..1 lift phase only. */
  liftT: number;
  /** 0..1 restore settle. */
  restoreT: number;
  attached: boolean;
}

/**
 * Milestone 6 ending / restoration. Progression only — fragment visibility
 * comes from world occlusion (door/passage), not from this state.
 */
function createEndingPuzzle() {
  const listeners = new Set<() => void>();

  let phase: EndingPhase = 'WAITING';
  let t = 0;
  let attached = false;
  let flight: EndingFlight = {
    presentT: 0,
    travelT: 0,
    liftT: 0,
    restoreT: 0,
    attached: false,
  };
  const gazePoint = new Vector3();

  const emit = () => listeners.forEach((l) => l());

  const snapshot = () => ({
    phase,
    attached,
    presentT: flight.presentT,
    travelT: flight.travelT,
    liftT: flight.liftT,
    restoreT: flight.restoreT,
    restored: attached && (phase === 'ACKNOWLEDGING' || phase === 'COMPLETE' || phase === 'RESTORING'),
  });

  let lastSnap = snapshot();

  const maybeEmit = () => {
    const next = snapshot();
    if (
      next.phase !== lastSnap.phase ||
      next.attached !== lastSnap.attached ||
      Math.abs(next.presentT - lastSnap.presentT) > 0.02 ||
      Math.abs(next.travelT - lastSnap.travelT) > 0.02 ||
      Math.abs(next.restoreT - lastSnap.restoreT) > 0.02
    ) {
      lastSnap = next;
      emit();
    }
  };

  const writeStats = () => {
    liveStats.endingPhase = phase;
    liveStats.fragmentRestored = attached && phase !== 'FRAGMENT_MOVING' && phase !== 'WAITING';
    liveStats.endingComplete = phase === 'COMPLETE';
  };

  const beginMoving = () => {
    phase = 'FRAGMENT_MOVING';
    t = 0;
    attached = false;
    flight = {
      presentT: 1,
      travelT: 0,
      liftT: 0,
      restoreT: 0,
      attached: false,
    };
  };

  return {
    getPhase: () => phase,
    getFlight: () => flight,
    isAttached: () => attached,
    isComplete: () => phase === 'COMPLETE',
    /** World point the mask should look at while tracking the fragment. */
    getGazePoint: () => gazePoint,
    setGazePoint(x: number, y: number, z: number) {
      gazePoint.set(x, y, z);
    },

    update(dt: number) {
      if (phase === 'WAITING') {
        if (doorPuzzle.isOpened()) {
          phase = 'FRAGMENT_AVAILABLE';
          t = 0;
          flight = { presentT: 0, travelT: 0, liftT: 0, restoreT: 0, attached: false };
          writeStats();
          maybeEmit();
        }
        return;
      }

      if (phase === 'FRAGMENT_AVAILABLE') {
        t += dt;
        const presentT = Math.min(1, t / PRESENT_DURATION);
        flight = { presentT, travelT: 0, liftT: 0, restoreT: 0, attached: false };
        // Track the emerging shard once it clears the doorway.
        if (presentT > 0.35) maskDirector.lookAtWorld(gazePoint, 'FRAGMENT');
        writeStats();
        maybeEmit();
        return;
      }

      if (phase === 'FRAGMENT_MOVING') {
        t += dt;
        const liftT = Math.min(1, t / LIFT_DURATION);
        const travelT = Math.min(1, Math.max(0, (t - LIFT_DURATION) / TRAVEL_DURATION));
        flight = { presentT: 1, travelT, liftT, restoreT: 0, attached: false };
        maskDirector.lookAtWorld(gazePoint, 'FRAGMENT');
        if (t >= LIFT_DURATION + TRAVEL_DURATION) {
          phase = 'RESTORING';
          t = 0;
          flight = { presentT: 1, travelT: 1, liftT: 1, restoreT: 0, attached: false };
        }
        writeStats();
        maybeEmit();
        return;
      }

      if (phase === 'RESTORING') {
        t += dt;
        const restoreT = Math.min(1, t / RESTORE_DURATION);
        if (!attached && restoreT > 0.15) {
          attached = true;
        }
        flight = { presentT: 1, travelT: 1, liftT: 1, restoreT, attached };
        maskDirector.lookAtWorld(gazePoint, 'FRAGMENT');
        if (t >= RESTORE_DURATION) {
          phase = 'ACKNOWLEDGING';
          t = 0;
          attached = true;
          flight = { presentT: 1, travelT: 1, liftT: 1, restoreT: 1, attached: true };
          maskDirector.lookAtPlayer();
        }
        writeStats();
        maybeEmit();
        return;
      }

      if (phase === 'ACKNOWLEDGING') {
        t += dt;
        maskDirector.lookAtPlayer();
        // End card only after the full recognition beat — do not overlap.
        if (t >= ACK_DURATION) {
          phase = 'COMPLETE';
          t = 0;
        }
        writeStats();
        maybeEmit();
        return;
      }

      // COMPLETE — hold.
      writeStats();
    },

    /** Player tapped the fragment. One-shot — only after it has emerged into the room. */
    tryCollect() {
      if (phase !== 'FRAGMENT_AVAILABLE' || flight.presentT < 0.9) return false;
      beginMoving();
      writeStats();
      lastSnap = snapshot();
      emit();
      return true;
    },

    /**
     * Debug-only: mark fragment available for testing.
     * Explicitly force-opens the door so the passage is visible — does not
     * change key state. Normal progression still requires a real door OPEN.
     */
    forceFragmentAvailable() {
      doorPuzzle.forceOpen();
      phase = 'FRAGMENT_AVAILABLE';
      t = 0;
      attached = false;
      flight = { presentT: 0, travelT: 0, liftT: 0, restoreT: 0, attached: false };
      writeStats();
      lastSnap = snapshot();
      emit();
    },

    /** Debug-only: start restoration from available (force-opens door if needed). */
    playRestoration() {
      if (phase === 'WAITING' || phase === 'FRAGMENT_AVAILABLE') {
        if (!doorPuzzle.isOpened()) doorPuzzle.forceOpen();
        phase = 'FRAGMENT_AVAILABLE';
        flight = { presentT: 1, travelT: 0, liftT: 0, restoreT: 0, attached: false };
        beginMoving();
      } else if (phase === 'COMPLETE' || phase === 'ACKNOWLEDGING') {
        attached = false;
        beginMoving();
      }
      writeStats();
      lastSnap = snapshot();
      emit();
    },

    /** Debug-only: jump to player acknowledgement (after a synthetic restore). */
    skipToAcknowledgement() {
      if (!doorPuzzle.isOpened()) doorPuzzle.forceOpen();
      attached = true;
      flight = { presentT: 1, travelT: 1, liftT: 1, restoreT: 1, attached: true };
      phase = 'ACKNOWLEDGING';
      t = 0;
      maskDirector.lookAtPlayer();
      writeStats();
      lastSnap = snapshot();
      emit();
    },

    /**
     * Reset ending only. Returns fragment to shelf logically; does not reset
     * key or door (call those separately if a full replay is needed).
     */
    reset() {
      phase = doorPuzzle.isOpened() ? 'FRAGMENT_AVAILABLE' : 'WAITING';
      t = 0;
      attached = false;
      flight = {
        presentT: doorPuzzle.isOpened() ? 0 : 0,
        travelT: 0,
        liftT: 0,
        restoreT: 0,
        attached: false,
      };
      writeStats();
      lastSnap = snapshot();
      emit();
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

export const endingPuzzle = createEndingPuzzle();

export function useEndingPuzzle() {
  return useSyncExternalStore(endingPuzzle.subscribe, endingPuzzle.getSnapshot);
}
