import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  BackSide,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
  PMREMGenerator,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { tuning } from '../../config/tuning';
import { faceTracker } from '../../tracking/FaceTracker';
import { headInput } from '../../tracking/headInput';
import { aimAngles } from './EyeController';
import { GAZE_TARGETS, maskDirector, useMaskGaze, type GazeTargetName } from './maskDirector';
import { EYE, MASK_HEIGHT, MASK_WIDTH, surfaceZ } from './maskShape';
import { getMaskTextures } from './maskTextures';
import { DEG, stepSpring, type Spring1 } from './spring';

/** Center of the mask, toward the back of the room. */
export const MASK_POSITION = new Vector3(0, 0.2, -1.9);

const EYE_RADIUS = 0.05;
const EYE_X = EYE.u * (MASK_WIDTH / 2);
const EYE_Y = EYE.v * (MASK_HEIGHT / 2);
const EYE_Z = surfaceZ(EYE.u, EYE.v) - EYE_RADIUS - 0.004;
const EYES_MIDPOINT = new Vector3(0, EYE_Y, EYE_Z);
const FORWARD = new Vector3(0, 0, 1);

const IRIS_ANGLE = 28 * DEG;
const IRIS_INNER_ANGLE = 23.5 * DEG;
const PUPIL_ANGLE = 10 * DEG;
const PUPIL_DILATION = 0.16;
/** 1 = eyes fully converge on near targets, 0 = parallel. Full convergence reads cross-eyed. */
const VERGENCE = 0.5;

/** Upper / lower lid edge rotation (radians), open → closed. */
const UPPER_OPEN = -15 * DEG;
const UPPER_CLOSED = 14 * DEG;
const LOWER_OPEN = 25 * DEG;
const LOWER_CLOSED = 6 * DEG;
/** How much the lids ride along with vertical gaze. */
const UPPER_LID_FOLLOW = 0.45;
const LOWER_LID_FOLLOW = 0.3;

interface EyeRig {
  socket: Group | null;
  ball: Group | null;
  pupil: Mesh | null;
  upperLid: Mesh | null;
  lowerLid: Mesh | null;
}

const newRig = (): EyeRig => ({ socket: null, ball: null, pupil: null, upperLid: null, lowerLid: null });

/**
 * The central mask: an original procedural face with real 3D eyes behind
 * its openings. Behavior (where to look, when to blink, the awakening)
 * comes from maskDirector; this component only applies it to the meshes.
 */
export function Mask() {
  const gl = useThree((s) => s.gl);
  const envMap = useMemo(() => {
    const pmrem = new PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return tex;
  }, [gl]);
  const faceGeometry = useMemo(buildFaceGeometry, []);
  const tex = getMaskTextures();

  const root = useRef<Group>(null);
  const rigs = useMemo(() => ({ left: newRig(), right: newRig() }), []);
  const state = useMemo(
    () => ({
      yaw: { x: 0, v: 0 } as Spring1,
      pitch: { x: 0, v: 0 } as Spring1,
      dilation: 0,
      origin: new Vector3(),
      dir: new Vector3(),
      local: new Vector3(),
      angles: { yaw: 0, pitch: 0 },
    }),
    [],
  );

  useFrame(({ camera }, delta) => {
    const group = root.current;
    if (!group) return;
    const t = tuning.get();
    const dt = Math.min(delta, 0.1);
    const d = maskDirector;

    const gated = headInput.getMode() === 'head' && faceTracker.getStatus().calibration !== 'done';
    d.update(dt, gated);
    d.lids.update(dt, t.autoBlink);

    // Gaze, in world space.
    state.origin.copy(EYES_MIDPOINT);
    group.localToWorld(state.origin);
    d.eyes.update(dt, state.origin, FORWARD, camera.position, {
      response: t.eyeResponse,
      contactTolerance: t.eyeContactTolerance,
    });

    // The mask itself turns only a few degrees, slowly, after the eyes.
    const dir = d.eyes.getDirection(state.dir);
    const follow = t.maskFollowStrength * d.followWeight;
    const max = t.maskMaxAngle * DEG;
    const wantYaw = clamp(Math.atan2(dir.x, dir.z) * follow, max);
    const wantPitch = clamp(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) * follow, max);
    const omega = 3 / Math.max(0.05, t.maskFollowSmoothing);
    stepSpring(state.yaw, wantYaw, omega, dt);
    stepSpring(state.pitch, wantPitch, omega, dt);
    group.rotation.set(-state.pitch.x, state.yaw.x, 0, 'YXZ');
    group.updateMatrixWorld();

    // Each eyeball aims at the shared gaze point from its own socket.
    const c = d.lids.closure;
    state.dilation += (d.eyes.contact - state.dilation) * (1 - Math.exp(-dt / 0.4));
    const limX = t.eyeLimitX * DEG;
    const limY = t.eyeLimitY * DEG;
    for (const side of ['left', 'right'] as const) {
      const rig = rigs[side];
      if (!rig.socket || !rig.ball) continue;
      state.local.copy(d.eyes.gazePoint);
      rig.socket.worldToLocal(state.local);
      state.local.x += rig.socket.position.x * (1 - VERGENCE);
      const a = aimAngles(ZERO, state.local, state.angles);
      const r = Math.hypot(a.yaw / limX, a.pitch / limY);
      if (r > 1) {
        a.yaw /= r;
        a.pitch /= r;
      }
      rig.ball.rotation.set(-a.pitch, a.yaw, 0, 'YXZ');

      if (rig.upperLid) rig.upperLid.rotation.x = lerp(UPPER_OPEN, UPPER_CLOSED, c) - a.pitch * UPPER_LID_FOLLOW * (1 - c);
      if (rig.lowerLid) rig.lowerLid.rotation.x = lerp(LOWER_OPEN, LOWER_CLOSED, c) - a.pitch * LOWER_LID_FOLLOW * (1 - c);
      if (rig.pupil) {
        const s = 1 + PUPIL_DILATION * state.dilation;
        rig.pupil.scale.set(s, 1, s);
      }

      const out = side === 'left' ? d.stats.leftEye : d.stats.rightEye;
      out.yaw = a.yaw / DEG;
      out.pitch = a.pitch / DEG;
    }
    d.stats.mask.yaw = state.yaw.x / DEG;
    d.stats.mask.pitch = state.pitch.x / DEG;
    d.stats.gazePoint.copy(d.eyes.gazePoint);
  });

  return (
    <group ref={root} position={MASK_POSITION}>
      <mesh geometry={faceGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          map={tex.color}
          alphaMap={tex.alpha}
          alphaTest={0.5}
          roughnessMap={tex.roughMetal}
          metalnessMap={tex.roughMetal}
          roughness={1}
          metalness={1}
          envMap={envMap}
          envMapIntensity={0.35}
          side={DoubleSide}
        />
      </mesh>

      {/* Dark hollow behind the face, seen only through the eye openings. */}
      <mesh position={[0, EYE_Y, -0.04]} scale={[0.17, 0.2, 0.075]}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial color="#050302" side={BackSide} />
      </mesh>

      <Eye rig={rigs.left} x={-EYE_X} />
      <Eye rig={rigs.right} x={EYE_X} />
    </group>
  );
}

const ZERO = new Vector3();

const CATCHLIGHT = new Vector3(-0.32, 0.22, 0.92).normalize().multiplyScalar(EYE_RADIUS * 1.012);

function Eye({ rig, x }: { rig: EyeRig; x: number }) {
  const R = EYE_RADIUS;
  return (
    <group ref={(o) => void (rig.socket = o)} position={[x, EYE_Y, EYE_Z]}>
      <group ref={(o) => void (rig.ball = o)}>
        <mesh>
          <sphereGeometry args={[R, 48, 32]} />
          <meshPhysicalMaterial color="#c9bfac" roughness={0.35} clearcoat={1} clearcoatRoughness={0.08} />
        </mesh>
        <Cap radius={R * 1.003} angle={IRIS_ANGLE} color="#9a7438" offset={1} metal />
        <Cap radius={R * 1.006} angle={IRIS_INNER_ANGLE} color="#2e1c0c" offset={2} />
        <Cap radius={R * 1.009} angle={PUPIL_ANGLE} color="#030202" offset={3} meshRef={(o) => void (rig.pupil = o)} />
      </group>

      <mesh position={CATCHLIGHT}>
        <sphereGeometry args={[0.0034, 10, 8]} />
        <meshBasicMaterial color="#fff6e6" transparent opacity={0.85} toneMapped={false} />
      </mesh>

      <mesh ref={(o) => void (rig.upperLid = o)}>
        <sphereGeometry args={[R * 1.06, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c8b898" roughness={0.75} />
      </mesh>
      <mesh ref={(o) => void (rig.lowerLid = o)}>
        <sphereGeometry args={[R * 1.055, 40, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#bba98a" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Spherical cap on the eyeball, centered on +Z. */
function Cap(props: {
  radius: number;
  angle: number;
  color: string;
  offset: number;
  metal?: boolean;
  meshRef?: (o: Mesh | null) => void;
}) {
  return (
    <mesh ref={props.meshRef} rotation={[Math.PI / 2, 0, 0]}>
      <sphereGeometry args={[props.radius, 32, 6, 0, Math.PI * 2, 0, props.angle]} />
      <meshPhysicalMaterial
        color={props.color}
        roughness={props.metal ? 0.4 : 0.5}
        metalness={props.metal ? 0.5 : 0}
        clearcoat={1}
        clearcoatRoughness={0.08}
        polygonOffset
        polygonOffsetFactor={-props.offset}
        polygonOffsetUnits={-4 * props.offset}
      />
    </mesh>
  );
}

function buildFaceGeometry() {
  const geo = new PlaneGeometry(MASK_WIDTH, MASK_HEIGHT, 96, 132);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (MASK_WIDTH / 2);
    const v = pos.getY(i) / (MASK_HEIGHT / 2);
    pos.setZ(i, surfaceZ(u, v));
  }
  geo.computeVertexNormals();
  return geo;
}

/** Debug-only markers for the temporary world gaze targets. */
export function GazeTargetMarkers({ visible }: { visible: boolean }) {
  const { mode, target } = useMaskGaze();
  if (!visible) return null;
  return (
    <group>
      {(Object.keys(GAZE_TARGETS) as GazeTargetName[]).map((name) => {
        const active = mode === 'LOOK_AT_WORLD_TARGET' && target === name;
        return (
          <mesh key={name} position={GAZE_TARGETS[name]} scale={active ? 1.4 : 1}>
            <octahedronGeometry args={[0.03]} />
            <meshBasicMaterial color={active ? '#ffd27a' : '#7a6440'} wireframe toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function clamp(v: number, max: number) {
  return Math.max(-max, Math.min(max, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
