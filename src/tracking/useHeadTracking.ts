import { useSyncExternalStore } from 'react';
import { faceTracker, type TrackerStatus } from './FaceTracker';
import { headInput, type InputMode } from './headInput';

export function useInputMode(): InputMode {
  return useSyncExternalStore(headInput.subscribe, headInput.getMode);
}

export function useTrackerStatus(): TrackerStatus {
  return useSyncExternalStore(faceTracker.subscribe, faceTracker.getStatus);
}
