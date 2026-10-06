import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { useTuning } from '../../config/tuning';
import { CAMERA_FRAME_PRIORITY } from '../../rendering/HeadTrackedCamera';
import { keyPuzzle } from './keyPuzzle';

const BRASS = '#c49a4a';
const BRASS_EMISSIVE = '#ffb45a';

const SHAFT_RADIUS = 0.022;
const TOOTH_RADIUS = 0.022;
const BOW_TUBE = 0.02;

/** After the camera so projection uses this frame's matrices. */
const KEY_FRAME_PRIORITY = CAMERA_FRAME_PRIORITY + 5;

const UP = new Vector3(0, 1, 0);

function BrassMaterial({
  matRef,
}: {
  matRef: (m: MeshStandardMaterial | null) => void;
}) {
  return (
    <meshStandardMaterial
      ref={matRef}
      color={BRASS}
      emissive={BRASS_EMISSIVE}
      emissiveIntensity={0.15}
      metalness={0.85}
      roughness={0.35}
    />
  );
}

/** Cylinder between two world points — each instance owns its transform. */
function Bar({
  a,
  b,
  radius,
  matRef,
}: {
  a: Vector3;
  b: Vector3;
  radius: number;
  matRef: (m: MeshStandardMaterial | null) => void;
}) {
  const ref = useRef<Mesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dir = new Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-4) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.addVectors(a, b).multiplyScalar(0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  }, [a, b, a.x, a.y, a.z, b.x, b.y, b.z]);

  return (
    <mesh ref={ref} castShadow>
      <cylinderGeometry args={[radius, radius, 1, 12]} />
      <BrassMaterial matRef={matRef} />
    </mesh>
  );
}

/** Tuning keys that reshape the solve silhouette — any change rebuilds meshes. */
const SILHOUETTE_KEYS = [
  'keyOffsetX',
  'keyOffsetY',
  'keyOffsetZ',
  'keyBowNdcX',
  'keyBowNdcY',
  'keyShaftLeftNdcX',
  'keyShaftLeftNdcY',
  'keyShaftRightNdcX',
  'keyShaftRightNdcY',
  'keyToothNdcX',
  'keyToothNdcY',
  'keyDepthBow',
  'keyDepthShaft',
  'keyDepthTooth',
] as const;

/**
 * Three fragments: closed bow · one shaft · one thick tooth.
 * Tooth endpoints share a depth plane so the bar never slants in Z.
 * At the solve eye, toothTop lands on the shaft tip in screen space.
 */
export function KeyFragments() {
  const camera = useThree((s) => s.camera);
  const group = useRef<Group>(null);
  const mats = useRef<MeshStandardMaterial[]>([]);
  const t = useTuning();

  const silhouetteKey = SILHOUETTE_KEYS.map((k) => t[k]).join('|');

  const layout = useMemo(() => {
    keyPuzzle.rebuildLayout();
    return keyPuzzle.getLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- silhouetteKey encodes all deps
  }, [silhouetteKey]);

  useFrame((_, delta) => {
    keyPuzzle.update(Math.min(delta, 0.1), camera);
    const fade = keyPuzzle.getFade();
    const glow = keyPuzzle.getGlow();
    if (group.current) group.current.visible = fade > 0.01;
    for (const m of mats.current) {
      if (!m) continue;
      m.opacity = fade;
      m.transparent = fade < 0.999;
      m.emissiveIntensity = 0.15 + glow * 1.8;
      m.needsUpdate = true;
    }
  }, KEY_FRAME_PRIORITY);

  const { bow, bowRim, shaftLeft, shaftRight, toothTop, tooth } = layout;

  const bowGeom = useMemo(() => {
    const dx = bowRim.x - bow.x;
    const dy = bowRim.y - bow.y;
    const radius = Math.max(0.035, Math.hypot(dx, dy));
    return { radius };
  }, [bow, bowRim, bow.x, bow.y, bow.z, bowRim.x, bowRim.y, bowRim.z]);

  /** Overlap tooth slightly into the shaft so the joint doesn't flash a gap. */
  const toothAttach = useMemo(() => {
    const along = new Vector3().subVectors(toothTop, tooth);
    if (along.lengthSq() < 1e-8) return toothTop.clone();
    return toothTop.clone().addScaledVector(along.normalize(), TOOTH_RADIUS * 0.6);
  }, [toothTop, tooth, toothTop.x, toothTop.y, toothTop.z, tooth.x, tooth.y, tooth.z]);

  const setMat = (i: number) => (m: MeshStandardMaterial | null) => {
    if (m) mats.current[i] = m;
  };

  return (
    <group ref={group}>
      <mesh position={[bow.x, bow.y, bow.z]} castShadow>
        <torusGeometry args={[bowGeom.radius, BOW_TUBE, 12, 48]} />
        <BrassMaterial matRef={setMat(0)} />
      </mesh>

      <Bar a={shaftLeft} b={shaftRight} radius={SHAFT_RADIUS} matRef={setMat(1)} />
      <Bar a={toothAttach} b={tooth} radius={TOOTH_RADIUS} matRef={setMat(2)} />
    </group>
  );
}

/** Dev-only: tiny markers at world anchors when alignment debug is on. */
export function KeyAnchorMarkers() {
  const t = useTuning();
  const silhouetteKey = SILHOUETTE_KEYS.map((k) => t[k]).join('|');
  const layout = useMemo(() => {
    keyPuzzle.rebuildLayout();
    return keyPuzzle.getLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [silhouetteKey]);

  if (!t.showKeyAlignmentDebug) return null;
  return (
    <group>
      {layout.anchors.map((a, i) => (
        <mesh key={i} position={a.world.toArray() as [number, number, number]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshBasicMaterial color="#ffe0a0" depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
