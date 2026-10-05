import type { HeadPose } from './HeadPose';
import { faceTracker } from './FaceTracker';
import { PointerHeadSource } from './PointerHeadSource';

export type InputMode = 'pointer' | 'head';

/**
 * Selects which source drives the viewpoint. The camera only ever asks for
 * `headInput.pose`, so pointer simulation and face tracking are
 * interchangeable.
 */
function createHeadInput() {
  const pointer = new PointerHeadSource();
  let mode: InputMode = 'pointer';
  const listeners = new Set<() => void>();

  return {
    pointer,
    face: faceTracker,
    /** Pose fed to the camera. */
    get pose(): Readonly<HeadPose> {
      return mode === 'head' ? faceTracker.pose : pointer.pose;
    },
    /** Unfiltered pose, for debugging. */
    get rawPose(): Readonly<HeadPose> {
      return mode === 'head' ? faceTracker.rawPose : pointer.pose;
    },
    /** Advance time-based behavior of the active source (render rate). */
    update(dt: number) {
      if (mode === 'head') faceTracker.update(dt);
    },
    getMode: () => mode,
    setMode(next: InputMode) {
      if (next === mode) return;
      mode = next;
      if (mode === 'head') void faceTracker.start();
      else faceTracker.stop();
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const headInput = createHeadInput();
