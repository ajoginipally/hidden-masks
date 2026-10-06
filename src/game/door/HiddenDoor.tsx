import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Group, MathUtils, MeshStandardMaterial, PointLight } from 'three';
import { useTuning } from '../../config/tuning';
import { CAMERA_FRAME_PRIORITY } from '../../rendering/HeadTrackedCamera';
import { computeWindowSize } from '../../rendering/OffAxisCamera';
import { ROOM_DEPTH } from '../Room';
import { playDoorClick } from './doorClick';
import { DOOR_BASE, doorOpeningPos, occluderWorldPos } from './doorLayout';
import { doorPuzzle } from './doorPuzzle';

const STONE = '#6a5e52';
const STONE_DARK = '#4a4038';
const STONE_DEEP = '#2e2822';
const THRESHOLD = '#1a1612';
const BRASS = '#c49a4a';
const BRASS_EMISSIVE = '#ffb45a';
const WALL = '#3b3129';

const DOOR_FRAME_PRIORITY = CAMERA_FRAME_PRIORITY + 6;
/** ~92° — free edge clears the opening without burying into the wall. */
const OPEN_ANGLE = MathUtils.degToRad(92);

const noRaycast = () => {};

/**
 * Doorway cut into the left room-shell wall (not a freestanding prop).
 * Renders the split left wall, recessed leaf, and short exterior passage.
 * Puzzle logic unchanged. Hits stay on visible leaf / brass / keyhole.
 */
export function HiddenDoor() {
  const t = useTuning();
  const size = useThree((s) => s.size);
  const { width: W, height: H } = useMemo(
    () => computeWindowSize(size.width / size.height),
    [size.width, size.height],
  );
  const floorY = -H / 2;
  const ceilingY = H / 2;
  const leftWallX = -W / 2;
  const D = ROOM_DEPTH;

  const leaf = useRef<Group>(null);
  const keyholeMat = useRef<MeshStandardMaterial>(null);
  const backlight = useRef<PointLight>(null);
  const backGlow = useRef<MeshStandardMaterial>(null);

  const opening = useMemo(
    () => doorOpeningPos(leftWallX, { x: t.doorOffsetX, y: t.doorOffsetY, z: t.doorOffsetZ }),
    [leftWallX, t.doorOffsetX, t.doorOffsetY, t.doorOffsetZ],
  );
  const occPos = useMemo(
    () =>
      occluderWorldPos(leftWallX, floorY, {
        x: t.occluderOffsetX,
        y: t.occluderOffsetY,
        z: t.occluderOffsetZ,
      }),
    [leftWallX, floorY, t.occluderOffsetX, t.occluderOffsetY, t.occluderOffsetZ],
  );

  const { w, h, d } = DOOR_BASE.doorSize;
  const T = DOOR_BASE.wallThickness;
  const P = DOOR_BASE.passageDepth;
  const R = DOOR_BASE.leafRecess;
  const os = DOOR_BASE.occluderSize;

  const y0 = opening.y - h / 2;
  const y1 = opening.y + h / 2;
  const z0 = opening.z - w / 2;
  const z1 = opening.z + w / 2;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    doorPuzzle.update(dt);
    if (doorPuzzle.consumeClick()) playDoorClick();

    const open = doorPuzzle.getOpenAmount();
    const pulse = doorPuzzle.getKeyholePulse();
    const light = doorPuzzle.getLightAmount();

    // Rotate the hinge group (pivot on the jamb). Mesh is offset from this axis.
    if (leaf.current) leaf.current.rotation.y = OPEN_ANGLE * easeOutCubic(open);
    if (keyholeMat.current) keyholeMat.current.emissiveIntensity = 0.15 + pulse * 1.6;
    if (backlight.current) {
      // Soft warm spill — a blown-out portal wash hides the emerging shard.
      backlight.current.intensity = light * 2.2;
      backlight.current.visible = light > 0.01;
    }
    if (backGlow.current) {
      backGlow.current.emissiveIntensity = light * 0.25;
      backGlow.current.opacity = 0.08 + light * 0.18;
      backGlow.current.visible = light > 0.02;
    }
  }, DOOR_FRAME_PRIORITY);

  const onDoorPointer = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    doorPuzzle.tryUnlock();
  };

  const leafX = leftWallX + T - R - d / 2;
  const passageCenterX = leftWallX - P / 2;
  const passageBackX = leftWallX - P;

  return (
    <group>
      <LeftWallPanels
        leftWallX={leftWallX}
        wallT={T}
        floorY={floorY}
        ceilingY={ceilingY}
        depth={D}
        y0={y0}
        y1={y1}
        z0={z0}
        z1={z1}
      />

      {/* Low buttress meeting the left wall — occlusion with shell contact. */}
      <mesh
        position={[occPos.x, occPos.y, occPos.z]}
        castShadow
        receiveShadow
        raycast={t.showDoorOccluderDebug ? noRaycast : undefined}
      >
        <boxGeometry args={[os.x, os.y, os.z]} />
        {t.showDoorOccluderDebug ? (
          <meshStandardMaterial color="#8a7a68" wireframe transparent opacity={0.4} depthWrite={false} />
        ) : (
          <meshStandardMaterial color={STONE_DARK} roughness={0.92} />
        )}
      </mesh>

      {/*
        Hinged rigid leaf: pivot sits on the back vertical jamb (world z = z0).
        All door meshes are children offset by +w/2 in local Z so the hinge edge
        stays on the axis; only this group rotates.
      */}
      <group ref={leaf} position={[leafX, opening.y, z0]}>
        <group position={[0, 0, w / 2]}>
          <mesh castShadow receiveShadow onPointerDown={onDoorPointer}>
            <boxGeometry args={[d, h, w]} />
            <meshStandardMaterial color="#5c5046" roughness={0.85} metalness={0.05} />
          </mesh>
          <mesh position={[d * 0.52, 0, w * 0.15]} onPointerDown={onDoorPointer} castShadow>
            <boxGeometry args={[0.008, h * 0.72, 0.012]} />
            <meshStandardMaterial color={BRASS} metalness={0.75} roughness={0.35} />
          </mesh>
          <group position={[d * 0.55, 0.02, 0]} onPointerDown={onDoorPointer}>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.018, 0.018, 0.01, 16]} />
              <meshStandardMaterial
                ref={keyholeMat}
                color={BRASS}
                emissive={BRASS_EMISSIVE}
                emissiveIntensity={0.15}
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0.006, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.005, 0.005, 0.012, 8]} />
              <meshStandardMaterial color="#1a1510" roughness={1} />
            </mesh>
            <mesh position={[0.006, -0.012, 0]}>
              <boxGeometry args={[0.008, 0.016, 0.007]} />
              <meshStandardMaterial color="#1a1510" roughness={1} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Thin sill only — a full-aperture plane would seal the passage from OffAxis peeks. */}
      <mesh
        position={[leftWallX + 0.002, y0 + 0.008, opening.z]}
        rotation={[0, Math.PI / 2, 0]}
        raycast={noRaycast}
      >
        <planeGeometry args={[w * 0.98, 0.016]} />
        <meshStandardMaterial color={THRESHOLD} roughness={1} />
      </mesh>

      {/* Passage carved beyond the shell (−X). */}
      <mesh position={[passageCenterX, opening.y, z0 - 0.012]} raycast={noRaycast} receiveShadow>
        <boxGeometry args={[P, h, 0.024]} />
        <meshStandardMaterial color={STONE_DEEP} roughness={0.95} />
      </mesh>
      <mesh position={[passageCenterX, opening.y, z1 + 0.012]} raycast={noRaycast} receiveShadow>
        <boxGeometry args={[P, h, 0.024]} />
        <meshStandardMaterial color={STONE_DEEP} roughness={0.95} />
      </mesh>
      <mesh position={[passageCenterX, y0 - 0.01, opening.z]} raycast={noRaycast} receiveShadow>
        <boxGeometry args={[P, 0.02, w + 0.04]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.97} />
      </mesh>
      <mesh position={[passageCenterX, y1 + 0.01, opening.z]} raycast={noRaycast}>
        <boxGeometry args={[P, 0.02, w + 0.04]} />
        <meshStandardMaterial color={STONE_DEEP} roughness={0.98} />
      </mesh>
      <mesh position={[passageBackX, opening.y, opening.z]} raycast={noRaycast} receiveShadow>
        <boxGeometry args={[0.03, h + 0.04, w + 0.05]} />
        <meshStandardMaterial color={THRESHOLD} roughness={1} />
      </mesh>
      <mesh
        position={[passageBackX + 0.04, opening.y - 0.02, opening.z]}
        rotation={[0, Math.PI / 2, 0]}
        raycast={noRaycast}
      >
        <planeGeometry args={[w * 0.55, h * 0.4]} />
        <meshStandardMaterial
          ref={backGlow}
          color="#ffb078"
          emissive="#ff9a50"
          emissiveIntensity={0}
          transparent
          opacity={0.15}
          depthWrite={false}
          visible={false}
        />
      </mesh>
      <pointLight
        ref={backlight}
        color="#ffb078"
        position={[leftWallX + T + 0.12, opening.y, opening.z]}
        intensity={0}
        distance={1.6}
        decay={2}
        visible={false}
      />
    </group>
  );
}

/** Left wall shell split around the doorway aperture. */
function LeftWallPanels(props: {
  leftWallX: number;
  wallT: number;
  floorY: number;
  ceilingY: number;
  depth: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}) {
  const { leftWallX, wallT, floorY, ceilingY, depth: D, y0, y1, z0, z1 } = props;
  const midX = leftWallX + wallT / 2;
  const fullH = ceilingY - floorY;
  const midY = (floorY + ceilingY) / 2;

  const frontLen = Math.max(0.01, 0 - z1);
  const frontMid = (z1 + 0) / 2;
  const backLen = Math.max(0.01, z0 - -D);
  const backMid = (-D + z0) / 2;

  const belowH = Math.max(0.01, y0 - floorY);
  const belowMid = floorY + belowH / 2;
  const aboveH = Math.max(0.01, ceilingY - y1);
  const aboveMid = y1 + aboveH / 2;
  const openH = y1 - y0;
  const openMidY = (y0 + y1) / 2;
  const openW = z1 - z0;
  const openMidZ = (z0 + z1) / 2;

  return (
    <group>
      <WallSlab position={[midX, midY, frontMid]} size={[wallT, fullH, frontLen]} />
      <WallSlab position={[midX, midY, backMid]} size={[wallT, fullH, backLen]} />
      <WallSlab position={[midX, aboveMid, openMidZ]} size={[wallT, aboveH, openW]} />
      <WallSlab position={[midX, belowMid, openMidZ]} size={[wallT, belowH, openW]} />
      <mesh position={[midX + wallT * 0.15, openMidY, z0 - 0.008]} raycast={noRaycast} castShadow receiveShadow>
        <boxGeometry args={[wallT * 0.7, openH, 0.016]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      <mesh position={[midX + wallT * 0.15, openMidY, z1 + 0.008]} raycast={noRaycast} castShadow receiveShadow>
        <boxGeometry args={[wallT * 0.7, openH, 0.016]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      <mesh position={[midX + wallT * 0.15, y1 + 0.008, openMidZ]} raycast={noRaycast} castShadow receiveShadow>
        <boxGeometry args={[wallT * 0.7, 0.016, openW]} />
        <meshStandardMaterial color={STONE} roughness={0.88} />
      </mesh>
      <mesh position={[midX + wallT * 0.15, y0 - 0.008, openMidZ]} raycast={noRaycast} castShadow receiveShadow>
        <boxGeometry args={[wallT * 0.7, 0.016, openW]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.92} />
      </mesh>
    </group>
  );
}

function WallSlab({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow receiveShadow raycast={noRaycast}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={WALL} roughness={0.95} />
    </mesh>
  );
}

function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}
