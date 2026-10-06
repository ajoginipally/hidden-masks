import { useEffect, useState } from 'react';
import { useKeyPuzzle } from './keyPuzzle';

/**
 * Discovery toast + persistent corner key indicator.
 * No inventory — just a boolean "you have the key" cue.
 */
export function KeyFoundOverlay() {
  const { phase, keyFound } = useKeyPuzzle();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (phase !== 'SOLVING' && phase !== 'FOUND') {
      setShowBanner(false);
      return;
    }
    setShowBanner(true);
    if (phase === 'FOUND') {
      const id = window.setTimeout(() => setShowBanner(false), 2200);
      return () => window.clearTimeout(id);
    }
  }, [phase]);

  return (
    <>
      {showBanner && (
        <div className="key-found-banner" data-ui>
          KEY FOUND
        </div>
      )}
      {keyFound && (
        <div className="key-indicator" data-ui aria-label="Key acquired">
          <svg viewBox="0 0 40 20" width="36" height="18" aria-hidden>
            <circle cx="8" cy="10" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="13" y="8" width="18" height="4" rx="1" fill="currentColor" />
            <rect x="28" y="12" width="3" height="5" fill="currentColor" />
            <rect x="32" y="12" width="3" height="3" fill="currentColor" />
          </svg>
        </div>
      )}
    </>
  );
}
