import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { tuning } from '../config/tuning';
import { liveStats } from '../debug/liveStats';
import { headInput } from '../tracking/headInput';
import { neutralPose } from '../tracking/HeadPose';
import { OffAxisCamera } from './OffAxisCamera';

/** Runs before other frame callbacks so they see this frame's projection. */
export const CAMERA_FRAME_PRIORITY = -10;

/**
 * Installs an OffAxisCamera as the R3F default camera and drives its eye
 * position from the active head pose source every frame.
 */
export function HeadTrackedCamera() {
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const camera = useMemo(() => new OffAxisCamera(), []);
  const smoothed = useRef(neutralPose());

  useLayoutEffect(() => {
    const previous = get().camera;
    set({ camera });
    return () => set({ camera: previous });
  }, [camera, get, set]);

  useLayoutEffect(() => {
    camera.setAspect(size.width / size.height);
  }, [camera, size.width, size.height]);

  useFrame((_, delta) => {
    const t = tuning.get();
    const dt = Math.min(delta, 0.1);
    headInput.update(dt);
    const raw = headInput.pose;
    const s = smoothed.current;

    // Frame-rate independent exponential smoothing.
    const a = t.smoothing <= 0 ? 1 : 1 - Math.exp(-dt / t.smoothing);
    s.x += (raw.x - s.x) * a;
    s.y += (raw.y - s.y) * a;
    s.z += (raw.z - s.z) * a;
    s.confidence = raw.confidence;

    let ex = s.x * t.sensitivityX * t.exaggerationX * t.perspectiveStrength;
    let ey = s.y * t.sensitivityY * t.exaggerationY * t.perspectiveStrength;
    const r = Math.hypot(ex, ey);
    if (r > t.maxDisplacement && r > 0) {
      ex *= t.maxDisplacement / r;
      ey *= t.maxDisplacement / r;
    }
    const ez = t.eyeDistance * (1 + s.z * t.depthSensitivity);

    camera.setEye(ex, ey, ez);

    liveStats.rawPose = headInput.rawPose;
    liveStats.inputPose = raw;
    liveStats.smoothedPose = s;
    liveStats.eye.x = camera.eye.x;
    liveStats.eye.y = camera.eye.y;
    liveStats.eye.z = camera.eye.z;
    liveStats.window = camera.window;
    liveStats.frustum = camera.frustum;
    if (delta > 0) liveStats.fps += (1 / delta - liveStats.fps) * 0.05;
  }, CAMERA_FRAME_PRIORITY);

  return null;
}
