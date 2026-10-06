import { useSyncExternalStore } from 'react';
import { Vector3 } from 'three';
import { tuning } from '../../config/tuning';
import { liveStats } from '../../debug/liveStats';
import { keyPuzzle } from '../key/keyPuzzle';
import { maskDirector } from '../mask/maskDirector';
import { DOOR_GAZE_TARGET } from './doorLayout';

export type DoorPhase = 'SEALED' | 'CLUE' | 'AWAITING_UNLOCK' | 'UNLOCKING' | 'OPEN';

/** Pause after KEY FOUND so the banner can land before the gaze shift. */
const CLUE_DELAY = 1.2;
/** Unlock animation length (keyhole pulse → open → light). */
const UNLOCK_DURATION = 1.05;

const _gaze = new Vector3();

function gazeWithDoorOffset() {
  const t = tuning.get();
  // Aim at the wall opening; X tracks doorOffset so debug nudges stay consistent.
  return _gaze.set(
    DOOR_GAZE_TARGET.x + t.doorOffsetX,
    DOOR_GAZE_TARGET.y + t.doorOffsetY,
    DOOR_GAZE_TARGET.z + t.doorOffsetZ,
  );
}

/**
 * Milestone 5 door progression. Describes interaction state only — the door
 * mesh always exists; occlusion comes from room geometry + OffAxisCamera.
 * Never resets or modifies the Perspective Key (Milestone 4).
 */
function createDoorPuzzle() {
  const listeners = new Set<() => void>();

  let phase: DoorPhase = 'SEALED';
  let clueWait = 0;
  let unlockT = 0;
  let openAmount = 0;
  let keyholePulse = 0;
  let lightAmount = 0;
  let clueFired = false;
  let clickArmed = false;

  const emit = () => listeners.forEach((l) => l());

  const snapshot = () => ({
    phase,
    openAmount,
    keyholePulse,
    lightAmount,
    clueActive:
      phase === 'CLUE' ||
      phase === 'AWAITING_UNLOCK' ||
      phase === 'UNLOCKING' ||
      phase === 'OPEN',
    opened: phase === 'OPEN',
  });

  let lastSnap = snapshot();

  const maybeEmit = () => {
    const next = snapshot();
    if (
      next.phase !== lastSnap.phase ||
      next.opened !== lastSnap.opened ||
      next.clueActive !== lastSnap.clueActive ||
      Math.abs(next.openAmount - lastSnap.openAmount) > 0.02 ||
      Math.abs(next.lightAmount - lastSnap.lightAmount) > 0.02 ||
      Math.abs(next.keyholePulse - lastSnap.keyholePulse) > 0.05
    ) {
      lastSnap = next;
      emit();
    }
  };

  const writeStats = () => {
    liveStats.doorPhase = phase;
    liveStats.doorOpened = phase === 'OPEN';
    liveStats.doorClueActive = lastSnap.clueActive;
    liveStats.doorOpenAmount = openAmount;
  };

  const fireClueGaze = () => {
    maskDirector.lookAtWorld(gazeWithDoorOffset(), 'DOOR');
    clueFired = true;
  };

  const beginUnlock = () => {
    phase = 'UNLOCKING';
    unlockT = 0;
    openAmount = 0;
    lightAmount = 0;
    keyholePulse = 0;
    clickArmed = true;
  };

  return {
    getPhase: () => phase,
    getOpenAmount: () => openAmount,
    getKeyholePulse: () => keyholePulse,
    getLightAmount: () => lightAmount,
    isClueActive: () => lastSnap.clueActive,
    isOpened: () => phase === 'OPEN',
    /** True once when unlock should play the mechanical click. */
    consumeClick: () => {
      if (!clickArmed) return false;
      clickArmed = false;
      return true;
    },

    /**
     * Advance clue / unlock timelines. Call after the camera frame.
     * Never reads HeadPose — only keyFound + time.
     */
    update(dt: number) {
      const keyed = keyPuzzle.isFound();

      if (phase === 'SEALED') {
        if (keyed) {
          clueWait += dt;
          if (clueWait >= CLUE_DELAY) {
            fireClueGaze();
            phase = 'AWAITING_UNLOCK';
          }
        } else {
          clueWait = 0;
        }
        writeStats();
        maybeEmit();
        return;
      }

      if (phase === 'UNLOCKING') {
        unlockT += dt;
        const u = Math.min(1, unlockT / UNLOCK_DURATION);
        keyholePulse = u < 0.25 ? u / 0.25 : Math.max(0, 1 - (u - 0.25) / 0.35);
        openAmount = u < 0.2 ? 0 : Math.min(1, (u - 0.2) / 0.55);
        lightAmount = u < 0.45 ? 0 : Math.min(1, (u - 0.45) / 0.55);
        if (u >= 1) {
          phase = 'OPEN';
          openAmount = 1;
          lightAmount = 1;
          keyholePulse = 0;
        }
        writeStats();
        maybeEmit();
        return;
      }

      if (phase === 'OPEN') {
        openAmount = 1;
        lightAmount = 1;
        keyholePulse = 0;
        writeStats();
        return;
      }

      writeStats();
      maybeEmit();
    },

    /**
     * Player tapped the visible door/keyhole. Requires acquired key.
     * Returns true if unlock started.
     */
    tryUnlock() {
      if (!keyPuzzle.isFound()) return false;
      if (phase !== 'AWAITING_UNLOCK' && phase !== 'CLUE') return false;
      if (!clueFired) fireClueGaze();
      beginUnlock();
      writeStats();
      lastSnap = snapshot();
      emit();
      return true;
    },

    /** Debug: force/replay open without modifying key state. */
    forceOpen() {
      if (phase === 'UNLOCKING') return;
      if (!clueFired) fireClueGaze();
      beginUnlock();
      writeStats();
      lastSnap = snapshot();
      emit();
    },

    /** Debug: reset only Milestone 5; restore FOLLOW_PLAYER; leave key alone. */
    reset() {
      phase = 'SEALED';
      clueWait = 0;
      unlockT = 0;
      openAmount = 0;
      keyholePulse = 0;
      lightAmount = 0;
      clueFired = false;
      clickArmed = false;
      maskDirector.lookAtPlayer();
      writeStats();
      lastSnap = snapshot();
      emit();
    },

    /** Debug: aim mask at the door without changing door phase. */
    lookAtDoor() {
      fireClueGaze();
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

export const doorPuzzle = createDoorPuzzle();

export function useDoorPuzzle() {
  return useSyncExternalStore(doorPuzzle.subscribe, doorPuzzle.getSnapshot);
}
