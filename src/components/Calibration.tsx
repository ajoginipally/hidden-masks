import type { ReactNode } from 'react';
import { faceTracker } from '../tracking/FaceTracker';
import { headInput } from '../tracking/headInput';
import { useInputMode, useTrackerStatus } from '../tracking/useHeadTracking';

const PRIVACY = 'Video is processed on this device and never leaves it.';

/**
 * Head-tracking setup overlay: camera start-up, permission failures, and
 * calibration. Hidden once tracking is calibrated.
 */
export function Calibration() {
  const mode = useInputMode();
  const s = useTrackerStatus();

  if (mode !== 'head') return null;

  const useTouch = () => headInput.setMode('pointer');
  const retry = () => void faceTracker.start();

  if (s.camera === 'blocked' || s.camera === 'unavailable' || s.camera === 'error' || s.model === 'error') {
    const title =
      s.camera === 'blocked' ? 'CAMERA BLOCKED' : s.model === 'error' ? 'TRACKING UNAVAILABLE' : 'CAMERA UNAVAILABLE';
    return (
      <Panel>
        <h2>{title}</h2>
        <p>{s.message ?? 'Head tracking could not start.'}</p>
        {s.camera === 'blocked' && <p className="overlay-small">Allow camera access in your browser settings to use head tracking.</p>}
        <button className="overlay-primary" onClick={useTouch}>
          USE TOUCH MODE
        </button>
        {s.camera !== 'unavailable' && (
          <button className="overlay-secondary" onClick={retry}>
            TRY AGAIN
          </button>
        )}
      </Panel>
    );
  }

  if (s.camera !== 'active' || s.model !== 'ready') {
    return (
      <Panel>
        <h2>STARTING CAMERA</h2>
        <p className="overlay-small">{PRIVACY}</p>
        <button className="overlay-secondary" onClick={useTouch}>
          USE TOUCH MODE
        </button>
      </Panel>
    );
  }

  if (s.calibration === 'done') return null;

  const sampling = s.calibration === 'sampling';
  return (
    <Panel>
      <h2>POSITION YOURSELF</h2>
      <p>Hold your phone comfortably and look at the center of the screen.</p>
      <p className={`overlay-status ${s.faceDetected ? 'ok' : 'warn'}`}>
        {s.calibration === 'failed'
          ? 'Couldn’t see your face steadily. Try again.'
          : s.faceDetected
            ? 'Face detected'
            : 'Looking for your face…'}
      </p>
      <button className="overlay-primary" disabled={sampling || !s.faceDetected} onClick={() => faceTracker.calibrate()}>
        {sampling ? `HOLD STILL… ${Math.round(s.calibrationProgress * 100)}%` : 'CALIBRATE'}
      </button>
      <button className="overlay-secondary" onClick={useTouch}>
        USE TOUCH MODE
      </button>
      <p className="overlay-small">{PRIVACY}</p>
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="overlay" data-ui>
      <div className="overlay-card">{children}</div>
    </div>
  );
}
