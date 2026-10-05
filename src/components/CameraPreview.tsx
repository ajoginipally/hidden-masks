import { useEffect, useRef } from 'react';
import { useTuning } from '../config/tuning';
import { faceTracker } from '../tracking/FaceTracker';
import { useInputMode } from '../tracking/useHeadTracking';

const PREVIEW_WIDTH = 132;
const EYE_POINTS = [33, 133, 263, 362];

/**
 * DEV ONLY debug view: a small mirrored camera preview with the tracked eye
 * corners, head point, and calibrated center. Off by default; never part of
 * the game experience.
 */
export function CameraPreview() {
  const { showCameraPreview } = useTuning();
  const mode = useInputMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enabled = showCameraPreview && mode === 'head';

  useEffect(() => {
    if (!enabled) return;
    return faceTracker.onFrame(() => {
      const canvas = canvasRef.current;
      const video = faceTracker.getVideo();
      if (!canvas || !video || !video.videoWidth) return;

      const w = PREVIEW_WIDTH;
      const h = Math.round((w * video.videoHeight) / video.videoWidth);
      if (canvas.width !== w * 2) {
        canvas.width = w * 2;
        canvas.height = h * 2;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext('2d')!;
      const cw = canvas.width;
      const ch = canvas.height;

      // Mirror so it reads like a mirror: move right, the preview moves right.
      ctx.save();
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, cw, ch);
      ctx.restore();

      const mx = (x: number) => (1 - x) * cw;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(cw / 2, 0);
      ctx.lineTo(cw / 2, ch);
      ctx.moveTo(0, ch / 2);
      ctx.lineTo(cw, ch / 2);
      ctx.stroke();

      const face = faceTracker.landmarks;
      if (face) {
        ctx.fillStyle = '#7fd7ff';
        for (const i of EYE_POINTS) {
          ctx.beginPath();
          ctx.arc(mx(face[i].x), face[i].y * ch, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        const m = faceTracker.measurement;
        const hx = cw / 2 - (m.offsetX * m.ipd * cw) / video.videoWidth;
        const hy = ch / 2 + (m.offsetY * m.ipd * ch) / video.videoHeight;
        ctx.fillStyle = '#d8b47a';
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fill();

        const c = faceTracker.center;
        if (c) {
          const cx = cw / 2 - (c.offsetX * m.ipd * cw) / video.videoWidth;
          const cy = ch / 2 + (c.offsetY * m.ipd * ch) / video.videoHeight;
          ctx.strokeStyle = '#d8b47a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
    });
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div className="camera-preview">
      <canvas ref={canvasRef} />
      <span>DEBUG PREVIEW</span>
    </div>
  );
}
