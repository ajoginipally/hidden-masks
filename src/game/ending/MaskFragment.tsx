import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MathUtils,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { useTuning } from '../../config/tuning';
import { CAMERA_FRAME_PRIORITY } from '../../rendering/HeadTrackedCamera';
import { computeWindowSize } from '../../rendering/OffAxisCamera';
import { getMaskRestoreSlot, MASK_POSITION, MASK_RESTORE_LOCAL } from '../mask/maskRestore';
import { endingPuzzle, useEndingPuzzle } from './endingPuzzle';
import { fragmentPoses } from './fragmentShelf';
import { ShardMesh } from './ShardMesh';

const SHELF = '#3a322a';
const ENDING_FRAME_PRIORITY = CAMERA_FRAME_PRIORITY + 7;

const _world = new Vector3();
const _restoreWorld = new Vector3();
const _from = new Vector3();
const _to = new Vector3();
const _pos = new Vector3();

/**
 * Ceramic shard: occluded in the passage while the door is shut, then eases
 * into the room (OffAxis cannot look down a side corridor). Tap when present.
 */
export function MaskFragment() {
  const t = useTuning();
  const { phase, attached, presentT } = useEndingPuzzle();
  const size = useThree((s) => s.size);
  const { width: W } = useMemo(
    () => computeWindowSize(size.width / size.height),
    [size.width, size.height],
  );
  const leftWallX = -W / 2;

  const poses = useMemo(
    () =>
      fragmentPoses(leftWallX, {
        x: t.doorOffsetX,
        y: t.doorOffsetY,
        z: t.doorOffsetZ,
      }),
    [leftWallX, t.doorOffsetX, t.doorOffsetY, t.doorOffsetZ],
  );

  const frag = useRef<Group>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  const geometry = useMemo(() => buildShardGeometry(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    endingPuzzle.update(dt);

    const group = frag.current;
    if (!group) return;

    const p = endingPuzzle.getPhase();
    const flight = endingPuzzle.getFlight();
    const slot = getMaskRestoreSlot();
    const { shelf, present } = poses;

    _restoreWorld.copy(MASK_RESTORE_LOCAL).add(MASK_POSITION);
    if (slot) slot.getWorldPosition(_restoreWorld);

    if (endingPuzzle.isAttached()) {
      group.visible = false;
      if (slot) {
        slot.getWorldPosition(_world);
        endingPuzzle.setGazePoint(_world.x, _world.y, _world.z);
      }
      return;
    }

    group.visible = true;

    if (p === 'WAITING') {
      group.position.set(shelf.x, shelf.y, shelf.z);
      group.rotation.set(0.35, -0.4, 0.15);
      group.scale.setScalar(1);
      if (mat.current) mat.current.emissiveIntensity = 0.2;
    } else if (p === 'FRAGMENT_AVAILABLE') {
      const u = easeOutCubic(flight.presentT);
      group.position.set(
        MathUtils.lerp(shelf.x, present.x, u),
        MathUtils.lerp(shelf.y, present.y, u),
        MathUtils.lerp(shelf.z, present.z, u),
      );
      group.rotation.set(
        MathUtils.lerp(0.35, 0.2, u),
        MathUtils.lerp(-0.4, 0.6, u),
        MathUtils.lerp(0.15, 0.05, u),
      );
      if (mat.current) mat.current.emissiveIntensity = 0.35 + u * 0.4;
    } else if (p === 'FRAGMENT_MOVING' || p === 'RESTORING') {
      _pos.set(present.x, present.y, present.z);
      const liftY = present.y + 0.1;
      if (flight.liftT < 1) {
        const u = easeOutCubic(flight.liftT);
        group.position.set(present.x, MathUtils.lerp(present.y, liftY, u), present.z);
        group.rotation.set(0.2, 0.6, 0.05);
      } else {
        const u = easeInOutCubic(flight.travelT);
        _from.set(present.x, liftY, present.z);
        _to.copy(_restoreWorld);
        group.position.lerpVectors(_from, _to, u);
        group.rotation.set(
          MathUtils.lerp(0.2, 0.1, u),
          MathUtils.lerp(0.6, 0.05, u),
          MathUtils.lerp(0.05, 0, u),
        );
      }
      if (mat.current) {
        if (p === 'RESTORING') {
          mat.current.emissiveIntensity = 0.35 + Math.sin(flight.restoreT * Math.PI) * 0.55;
        } else {
          mat.current.emissiveIntensity = 0.4 + flight.travelT * 0.4;
        }
      }
    }

    group.getWorldPosition(_world);
    endingPuzzle.setGazePoint(_world.x, _world.y, _world.z);
  }, ENDING_FRAME_PRIORITY);

  const canTap = phase === 'FRAGMENT_AVAILABLE' && !attached && presentT >= 0.9;

  return (
    <group>
      {/* Ledge stays in the passage — always present. */}
      <mesh
        position={[poses.shelf.x, poses.shelf.shelfY, poses.shelf.z]}
        castShadow
        receiveShadow
        raycast={noRaycast}
      >
        <boxGeometry args={[0.08, 0.016, 0.09]} />
        <meshStandardMaterial color={SHELF} roughness={0.92} metalness={0.05} />
      </mesh>

      <group
        ref={frag}
        position={[poses.shelf.x, poses.shelf.y, poses.shelf.z]}
        rotation={[0.35, -0.4, 0.15]}
        onClick={(e) => {
          e.stopPropagation();
          endingPuzzle.tryCollect();
        }}
        onPointerOver={(e) => {
          if (endingPuzzle.getPhase() !== 'FRAGMENT_AVAILABLE') return;
          if (endingPuzzle.getFlight().presentT < 0.9) return;
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <ShardMesh geometry={geometry} matRef={mat} interactive={canTap} />
      </group>
    </group>
  );
}

/**
 * Shard under the mask restore slot — joins the mask local hierarchy and
 * moves with mask yaw/pitch after restoration.
 */
export function RestoredFragment() {
  const { attached, phase } = useEndingPuzzle();
  const mat = useRef<MeshStandardMaterial>(null);
  const geometry = useMemo(() => buildShardGeometry(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (!mat.current || !attached) return;
    const p = endingPuzzle.getPhase();
    const flight = endingPuzzle.getFlight();
    if (p === 'RESTORING') {
      mat.current.emissiveIntensity = 0.35 + Math.sin(flight.restoreT * Math.PI) * 0.55;
    } else {
      mat.current.emissiveIntensity = MathUtils.lerp(
        mat.current.emissiveIntensity,
        0.18,
        1 - Math.exp(-dt * 3),
      );
    }
  });

  if (!attached || phase === 'FRAGMENT_MOVING' || phase === 'WAITING' || phase === 'FRAGMENT_AVAILABLE') {
    return null;
  }

  return (
    <group rotation={[0.1, 0.05, 0]}>
      <ShardMesh geometry={geometry} matRef={mat} interactive={false} />
    </group>
  );
}

const noRaycast = () => {};

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function buildShardGeometry() {
  const geo = new BufferGeometry();
  const s = 2.4;
  const top = [
    [0.0 * s, 0.012 * s, 0.028 * s],
    [0.022 * s, 0.01 * s, 0.008 * s],
    [0.014 * s, 0.008 * s, -0.022 * s],
    [-0.016 * s, 0.011 * s, -0.018 * s],
    [-0.024 * s, 0.009 * s, 0.01 * s],
  ];
  const bot = top.map(([x, y, z]) => [x * 0.92, y - 0.012 * s, z * 0.92]);
  const positions: number[] = [];
  const push = (a: number[], b: number[], c: number[]) => {
    positions.push(...a, ...b, ...c);
  };
  for (let i = 1; i < top.length - 1; i++) push(top[0], top[i], top[i + 1]);
  for (let i = 1; i < bot.length - 1; i++) push(bot[0], bot[i + 1], bot[i]);
  for (let i = 0; i < top.length; i++) {
    const j = (i + 1) % top.length;
    push(top[i], bot[i], top[j]);
    push(top[j], bot[i], bot[j]);
  }
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}
