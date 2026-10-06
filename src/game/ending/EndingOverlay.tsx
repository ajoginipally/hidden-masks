import { useEndingPuzzle } from './endingPuzzle';

/**
 * End card — only after the full ACKNOWLEDGING eye-contact beat completes.
 * Does not overlap the recognition moment.
 */
export function EndingOverlay() {
  const { phase } = useEndingPuzzle();
  if (phase !== 'COMPLETE') return null;

  return (
    <div className="ending-overlay" data-ui aria-live="polite">
      <div className="ending-fade" />
      <div className="ending-card">
        <h1 className="ending-title">HIDDEN MASKS</h1>
        <p className="ending-line">Every mask sees the world differently.</p>
        <p className="ending-sub">Prototype complete.</p>
      </div>
    </div>
  );
}
