import { useEffect, useRef } from 'react';
import { useTuning } from '../config/tuning';
import { liveStats } from '../debug/liveStats';

/** Small overlay showing the smoothed normalized head position. */
export function TrackingDot() {
  const { showTrackingDot } = useTuning();
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTrackingDot) return;
    let raf = 0;
    const loop = () => {
      const dot = dotRef.current;
      if (dot) {
        const { x, y } = liveStats.smoothedPose;
        dot.style.transform = `translate(${clamp(x) * 50}%, ${-clamp(y) * 50}%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showTrackingDot]);

  if (!showTrackingDot) return null;

  return (
    <div className="tracking-dot-frame">
      <div className="tracking-dot-cross" />
      <div ref={dotRef} className="tracking-dot-track">
        <div className="tracking-dot" />
      </div>
    </div>
  );
}

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}
