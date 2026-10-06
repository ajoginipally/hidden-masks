import type { BufferGeometry, MeshStandardMaterial } from 'three';
import { Mesh } from 'three';
import type { Ref } from 'react';

export const CERAMIC = '#c4b49a';
export const CERAMIC_EMISSIVE = '#e8d4a8';

const noRaycast = () => {};

export function ShardMesh({
  geometry,
  matRef,
  interactive,
}: {
  geometry: BufferGeometry;
  matRef: Ref<MeshStandardMaterial>;
  interactive: boolean;
}) {
  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      raycast={interactive ? Mesh.prototype.raycast : noRaycast}
    >
      <meshStandardMaterial
        ref={matRef}
        color={CERAMIC}
        emissive={CERAMIC_EMISSIVE}
        emissiveIntensity={0.45}
        roughness={0.55}
        metalness={0.08}
      />
    </mesh>
  );
}
