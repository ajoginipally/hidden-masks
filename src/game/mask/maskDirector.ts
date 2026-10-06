import { useSyncExternalStore } from 'react';
import { Vector3 } from 'three';
import { EyeController, type GazeMode } from './EyeController';
import { Eyelids } from './Eyelids';

export type AwakeningPhase = 'ASLEEP' | 'OPENING' | 'STARING' | 'NOTICING' | 'AWAKE';

export type GazeTargetName = 'LEFT' | 'CENTER' | 'RIGHT';

/** Temporary world-space gaze targets (Milestone 3 testing). */
export const GAZE_TARGETS: Record<GazeTargetName, Vector3> = {
  LEFT: new Vector3(-0.36, 0.05, -1.25),
  CENTER: new Vector3(0, -0.45, -1.0),
  RIGHT: new Vector3(0.36, 0.05, -1.25),
};

/** Awakening timeline, seconds after entering the room. */
const T_OPEN = 1.5;
const OPEN_DURATION = 0.6;
const T_STARE = T_OPEN + OPEN_DURATION;
const T_NOTICE = 2.4;
const T_AWAKE = 3.0;
const FOLLOW_RAMP = 1.4;

/** Waking stare: straight ahead, slightly downcast, not yet seeing anyone. */
const STARE_DIR = new Vector3(0, -0.14, 1).normalize();

/**
 * The mask's behavior state, shared by the 3D mask and the debug panel.
 * Gaze logic lives in EyeController; this owns the awakening sequence and
 * the developer commands.
 */
function createMaskDirector() {
  const eyes = new EyeController();
  const lids = new Eyelids();
  const listeners = new Set<() => void>();

  let phase: AwakeningPhase = 'ASLEEP';
  let t = 0;
  let wasGated = false;
  let snapshot = { mode: eyes.mode, target: 'PLAYER' };

  const emit = () => {
    snapshot = { mode: eyes.mode, target: eyes.mode === 'FOLLOW_PLAYER' ? 'PLAYER' : eyes.worldTargetLabel };
    listeners.forEach((l) => l());
  };

  const resetAwakening = () => {
    phase = 'ASLEEP';
    t = 0;
    lids.shut();
    eyes.overrideDir = STARE_DIR;
  };
  resetAwakening();

  return {
    eyes,
    lids,
    /** Live readouts written by the mask every frame. */
    stats: {
      leftEye: { yaw: 0, pitch: 0 },
      rightEye: { yaw: 0, pitch: 0 },
      mask: { yaw: 0, pitch: 0 },
      gazePoint: new Vector3(),
    },

    getPhase: () => phase,

    /** How much the mask itself may turn (0 during awakening, ramps in after). */
    get followWeight() {
      if (phase !== 'AWAKE') return 0;
      const x = Math.min(1, (t - T_AWAKE) / FOLLOW_RAMP);
      return x * x * (3 - 2 * x);
    },

    /**
     * Advance the awakening. While `gated` (e.g. calibration overlay is up),
     * a sleeping mask stays asleep so the player sees it wake. The first
     * time the gate closes, the mask goes back to sleep to wake on entry.
     */
    update(dt: number, gated: boolean) {
      if (gated && !wasGated) {
        wasGated = true;
        resetAwakening();
        eyes.snapTo(STARE_DIR, 7);
      }
      if (phase === 'ASLEEP' && gated) {
        t = 0;
        return;
      }
      t += dt;
      if (phase === 'ASLEEP' && t >= T_OPEN) {
        phase = 'OPENING';
        lids.open(OPEN_DURATION);
      }
      if (phase === 'OPENING' && t >= T_STARE) phase = 'STARING';
      if (phase === 'STARING' && t >= T_NOTICE) {
        phase = 'NOTICING';
        eyes.overrideDir = null;
      }
      if (phase === 'NOTICING' && t >= T_AWAKE) phase = 'AWAKE';
    },

    // ------------------------------------------------------------ commands

    setGazeMode(mode: GazeMode) {
      eyes.setGazeMode(mode);
      emit();
    },
    lookAtPlayer() {
      eyes.setGazeMode('FOLLOW_PLAYER');
      emit();
    },
    lookAt(name: GazeTargetName) {
      eyes.setWorldTarget(GAZE_TARGETS[name], name);
      eyes.setGazeMode('LOOK_AT_WORLD_TARGET');
      emit();
    },
    /** Look at an arbitrary world-space point (Milestone 5 door clue). */
    lookAtWorld(position: Vector3, label = 'WORLD') {
      eyes.setWorldTarget(position, label);
      eyes.setGazeMode('LOOK_AT_WORLD_TARGET');
      emit();
    },
    blinkNow: () => lids.blink(),
    closeEyes: () => lids.close(),
    openEyes: () => lids.open(0.35),
    replayAwakening() {
      resetAwakening();
      eyes.snapTo(STARE_DIR, 7);
      emit();
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
  };
}

export const maskDirector = createMaskDirector();

export function useMaskGaze() {
  return useSyncExternalStore(maskDirector.subscribe, maskDirector.getSnapshot);
}
