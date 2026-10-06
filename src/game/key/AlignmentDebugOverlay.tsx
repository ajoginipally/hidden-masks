import { useEffect, useRef } from 'react';
import { useTuning } from '../../config/tuning';
import { liveStats } from '../../debug/liveStats';

/**
 * Dev-only HTML overlay of projected anchors (filled) and ideal targets (rings).
 */
export function AlignmentDebugOverlay() {
  const { showKeyAlignmentDebug } = useTuning();
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showKeyAlignmentDebug) return;
    let raf = 0;
    const loop = () => {
      const layer = layerRef.current;
      if (layer) {
        const projected = liveStats.keyProjected;
        const ideals = liveStats.keyIdeals;
        const nodes = layer.children;
        const n = Math.max(projected.length, ideals.length);
        while (layer.children.length < n * 2) {
          const d = document.createElement('div');
          d.className = 'align-dot';
          layer.appendChild(d);
        }
        for (let i = 0; i < n; i++) {
          const proj = nodes[i * 2] as HTMLDivElement;
          const ideal = nodes[i * 2 + 1] as HTMLDivElement;
          proj.className = 'align-dot align-dot-proj';
          ideal.className = 'align-dot align-dot-ideal';
          if (projected[i]) {
            proj.style.display = 'block';
            proj.style.left = `${((projected[i].x + 1) / 2) * 100}%`;
            proj.style.top = `${((1 - projected[i].y) / 2) * 100}%`;
          } else proj.style.display = 'none';
          if (ideals[i]) {
            ideal.style.display = 'block';
            ideal.style.left = `${((ideals[i].x + 1) / 2) * 100}%`;
            ideal.style.top = `${((1 - ideals[i].y) / 2) * 100}%`;
          } else ideal.style.display = 'none';
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [showKeyAlignmentDebug]);

  if (!showKeyAlignmentDebug) return null;
  return <div ref={layerRef} className="align-debug-layer" data-ui />;
}
