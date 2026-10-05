import { faceTracker } from '../tracking/FaceTracker';
import { headInput } from '../tracking/headInput';
import { useInputMode, useTrackerStatus } from '../tracking/useHeadTracking';

/** Bottom bar for switching input sources and recalibrating. */
export function InputModeBar() {
  const mode = useInputMode();
  const status = useTrackerStatus();
  const calibrated = mode === 'head' && status.calibration === 'done';

  return (
    <div className="mode-bar" data-ui>
      <div className="mode-switch">
        <button className={mode === 'head' ? 'active' : ''} onClick={() => headInput.setMode('head')}>
          HEAD TRACKING
        </button>
        <button className={mode === 'pointer' ? 'active' : ''} onClick={() => headInput.setMode('pointer')}>
          MOUSE / TOUCH
        </button>
      </div>
      {calibrated && (
        <button className="mode-recalibrate" onClick={() => faceTracker.resetCalibration()}>
          RECALIBRATE
        </button>
      )}
    </div>
  );
}
