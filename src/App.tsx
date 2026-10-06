import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { PCFShadowMap } from 'three';
import { Calibration } from './components/Calibration';
import { CameraPreview } from './components/CameraPreview';
import { DebugPanel } from './components/DebugPanel';
import { InputModeBar } from './components/InputModeBar';
import { TrackingDot } from './components/TrackingDot';
import { GazeTargetMarkers, Mask } from './game/mask/Mask';
import { AlignmentDebugOverlay } from './game/key/AlignmentDebugOverlay';
import { KeyAnchorMarkers, KeyFragments } from './game/key/KeyFragments';
import { KeyFoundOverlay } from './game/key/KeyFoundOverlay';
import { HiddenDoor } from './game/door/HiddenDoor';
import { EndingOverlay } from './game/ending/EndingOverlay';
import { MaskFragment } from './game/ending/MaskFragment';
import { Room } from './game/Room';
import { HeadTrackedCamera } from './rendering/HeadTrackedCamera';
import { headInput } from './tracking/headInput';
import { useInputMode } from './tracking/useHeadTracking';

export default function App() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const mode = useInputMode();

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    return headInput.pointer.attach(el);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === 'd') setDebugOpen((o) => !o);
      if (key === 'r') {
        if (headInput.getMode() === 'head') headInput.face.resetCalibration();
        else headInput.pointer.recenter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div ref={stageRef} className={`stage ${mode === 'head' ? 'stage-head' : ''}`}>
      <Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#050403']} />
        <fog attach="fog" args={['#0a0705', 6, 13]} />
        <HeadTrackedCamera />
        <Room />
        <HiddenDoor />
        <Mask />
        <MaskFragment />
        <KeyFragments />
        <KeyAnchorMarkers />
        <GazeTargetMarkers visible={debugOpen} />
      </Canvas>

      <div className="vignette" />
      <div className="hint">
        {mode === 'head' ? 'MOVE YOUR HEAD · D DEBUG' : 'DRAG TO MOVE YOUR VIEWPOINT · R RECENTER · D DEBUG'}
      </div>
      <KeyFoundOverlay />
      <EndingOverlay />
      <AlignmentDebugOverlay />
      <InputModeBar />
      <TrackingDot />
      <CameraPreview />
      <button className="debug-toggle" data-ui onClick={() => setDebugOpen((o) => !o)} aria-label="Toggle debug panel">
        D
      </button>
      <Calibration />
      <DebugPanel open={debugOpen} />
    </div>
  );
}
