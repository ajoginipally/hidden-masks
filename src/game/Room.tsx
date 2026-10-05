import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { CanvasTexture, Object3D, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { computeWindowSize } from '../rendering/OffAxisCamera';

export const ROOM_DEPTH = 2.6;
const GRID_CELL = 0.2;

/**
 * A box whose open front face coincides exactly with the screen window, so
 * every ray through the glass lands on a wall — like a shadow-box diorama.
 */
export function Room() {
  const size = useThree((s) => s.size);
  const { width: W, height: H } = computeWindowSize(size.width / size.height);
  const D = ROOM_DEPTH;

  return (
    <group>
      <Wall width={W} height={H} position={[0, 0, -D]} rotation={[0, 0, 0]} />
      <Wall width={W} height={D} position={[0, -H / 2, -D / 2]} rotation={[-Math.PI / 2, 0, 0]} />
      <Wall width={W} height={D} position={[0, H / 2, -D / 2]} rotation={[Math.PI / 2, 0, 0]} />
      <Wall width={D} height={H} position={[-W / 2, 0, -D / 2]} rotation={[0, Math.PI / 2, 0]} />
      <Wall width={D} height={H} position={[W / 2, 0, -D / 2]} rotation={[0, -Math.PI / 2, 0]} />
      <Lights roomHeight={H} />
      <TestObjects roomHeight={H} />
    </group>
  );
}

function Lights({ roomHeight: H }: { roomHeight: number }) {
  const target = useMemo(() => new Object3D(), []);
  return (
    <>
      <ambientLight color="#ffd9b0" intensity={0.2} />
      <directionalLight color="#ffe0bd" position={[0.4, 1, 3]} intensity={0.35} />
      <primitive object={target} position={[0, -H / 2, -ROOM_DEPTH * 0.65]} />
      <spotLight
        color="#ffcf9a"
        position={[0.1, H / 2 - 0.05, -1.1]}
        target={target}
        angle={0.95}
        penumbra={0.8}
        intensity={7}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.01}
      />
      <pointLight color="#ff9a5a" position={[0, 0.2, -ROOM_DEPTH + 0.4]} intensity={1.2} distance={3} decay={2} />
    </>
  );
}

const STONE = '#7a6e62';
const BRASS = '#b8904f';

function TestObjects({ roomHeight: H }: { roomHeight: number }) {
  const floor = -H / 2;
  const ceiling = H / 2;

  return (
    <group>
      {/* Foreground pillar hiding the orb from the neutral viewpoint (kept left of the mask). */}
      <Block position={[-0.34, 0, -0.55]} size={[0.26, H, 0.26]} color={STONE} />

      {/* Hidden orb — only visible by peeking around the pillar. */}
      <mesh position={[-0.42, floor + 0.55 / 2, -1.9]} castShadow receiveShadow>
        <cylinderGeometry args={[0.025, 0.035, 0.55, 12]} />
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      <mesh position={[-0.42, floor + 0.55 + 0.07, -1.9]} castShadow>
        <sphereGeometry args={[0.07, 24, 16]} />
        <meshStandardMaterial color="#ff6a3a" emissive="#ff4a1a" emissiveIntensity={2.2} />
      </mesh>

      {/* Floor cubes at increasing depth. */}
      <Block position={[-0.3, floor + 0.09, -0.3]} size={[0.18, 0.18, 0.18]} color={BRASS} metal />
      <Block position={[0.3, floor + 0.11, -1.1]} size={[0.22, 0.22, 0.22]} color={STONE} />
      <Block position={[-0.28, floor + 0.25, -1.6]} size={[0.14, 0.5, 0.14]} color={STONE} />
      <Block position={[-0.28, floor + 0.61, -1.6]} size={[0.22, 0.22, 0.22]} color={BRASS} metal />
      <Block position={[0.22, floor + 0.15, -2.2]} size={[0.3, 0.3, 0.3]} color={STONE} />

      {/* Hanging cubes. */}
      <Hanging x={0.28} z={-0.7} drop={0.45} size={0.14} ceiling={ceiling} color={BRASS} metal />
      <Hanging x={-0.22} z={-1.9} drop={0.3} size={0.2} ceiling={ceiling} color={STONE} />
      <Block position={[0.3, 0.6, -1.4]} size={[0.12, 0.12, 0.12]} rotation={[0.6, 0.8, 0]} color={BRASS} metal />
    </group>
  );
}

function Hanging(props: {
  x: number;
  z: number;
  drop: number;
  size: number;
  ceiling: number;
  color: string;
  metal?: boolean;
}) {
  const { x, z, drop, size, ceiling, color, metal } = props;
  return (
    <group>
      <mesh position={[x, ceiling - drop / 2, z]}>
        <cylinderGeometry args={[0.004, 0.004, drop, 4]} />
        <meshStandardMaterial color="#2a2420" />
      </mesh>
      <Block position={[x, ceiling - drop - size / 2, z]} size={[size, size, size]} color={color} metal={metal} />
    </group>
  );
}

function Block(props: {
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  metal?: boolean;
}) {
  return (
    <mesh position={props.position} rotation={props.rotation} castShadow receiveShadow>
      <boxGeometry args={props.size} />
      <meshStandardMaterial
        color={props.color}
        roughness={props.metal ? 0.35 : 0.9}
        metalness={props.metal ? 0.6 : 0}
      />
    </mesh>
  );
}

function Wall(props: {
  width: number;
  height: number;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const { width, height } = props;
  const texture = useGridTexture(width, height);
  return (
    <mesh position={props.position} rotation={props.rotation} receiveShadow>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} roughness={0.95} />
    </mesh>
  );
}

let gridCanvas: HTMLCanvasElement | null = null;

function getGridCanvas(): HTMLCanvasElement {
  if (gridCanvas) return gridCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3b3129';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#6e5b47';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 128, 128);
  gridCanvas = c;
  return c;
}

function useGridTexture(width: number, height: number): Texture {
  return useMemo(() => {
    const tex = new CanvasTexture(getGridCanvas());
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(width / GRID_CELL, height / GRID_CELL);
    tex.anisotropy = 4;
    return tex;
  }, [width, height]);
}
