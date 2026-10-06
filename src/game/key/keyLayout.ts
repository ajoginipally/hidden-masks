import { Vector3 } from 'three';
import { tuning } from '../../config/tuning';
import { OffAxisCamera } from '../../rendering/OffAxisCamera';
import type { AlignmentAnchor } from '../alignment/AlignmentScorer';
import { worldPointFromNdc } from '../alignment/projectToScreen';

/**
 * Authoring viewpoint for the perspective key.
 * Comfortable rightward lean: with default exaggeration (~1.3×) this is about
 * headX ≈ 0.65 — well inside front-camera tracking range on a phone.
 */
export const KEY_DESIGN_EYE = { x: 0.85, y: 0.02, z: 5 };

/** Portrait aspect matching the design window (1 × 2.1). */
const DESIGN_ASPECT = 1 / 2.1;

export interface KeyFragmentLayout {
  bow: Vector3;
  /** Same-depth rim toward the shaft — sizes the ring. */
  bowRim: Vector3;
  shaftLeft: Vector3;
  shaftRight: Vector3;
  /**
   * Top of the tooth bar at tooth depth. Shares the tooth's NDC X and the
   * shaft's NDC Y so it meets the shaft end on screen when solved — both
   * endpoints sit on one depth plane (no Z-slant).
   */
  toothTop: Vector3;
  tooth: Vector3;
  anchors: AlignmentAnchor[];
}

function buildCamera(): OffAxisCamera {
  const cam = new OffAxisCamera();
  cam.setAspect(DESIGN_ASPECT);
  cam.setEye(KEY_DESIGN_EYE.x, KEY_DESIGN_EYE.y, KEY_DESIGN_EYE.z);
  cam.updateMatrixWorld(true);
  return cam;
}

/** Read live silhouette authoring from tuning. */
export function getKeySilhouetteFromTuning() {
  const t = tuning.get();
  return {
    offset: { x: t.keyOffsetX, y: t.keyOffsetY, z: t.keyOffsetZ },
    ideal: {
      bow: { x: t.keyBowNdcX, y: t.keyBowNdcY },
      shaftLeft: { x: t.keyShaftLeftNdcX, y: t.keyShaftLeftNdcY },
      shaftRight: { x: t.keyShaftRightNdcX, y: t.keyShaftRightNdcY },
      tooth: { x: t.keyToothNdcX, y: t.keyToothNdcY },
    },
    depth: {
      bow: t.keyDepthBow,
      shaft: t.keyDepthShaft,
      tooth: t.keyDepthTooth,
    },
  };
}

/**
 * Three fragments only: bow · shaft · tooth.
 * The tooth is a single bar on one depth plane that meets the shaft in projection.
 */
export function buildKeyLayout(): KeyFragmentLayout {
  const { offset, ideal, depth } = getKeySilhouetteFromTuning();
  const cam = buildCamera();

  const bow = worldPointFromNdc(cam, ideal.bow.x, ideal.bow.y, depth.bow);
  const bowRim = worldPointFromNdc(cam, ideal.shaftLeft.x, ideal.shaftLeft.y, depth.bow);
  const shaftLeft = worldPointFromNdc(cam, ideal.shaftLeft.x, ideal.shaftLeft.y, depth.shaft);
  const shaftRight = worldPointFromNdc(cam, ideal.shaftRight.x, ideal.shaftRight.y, depth.shaft);
  // Attach under the shaft tip on screen: same X as tooth tip, Y = shaft height.
  const toothTop = worldPointFromNdc(cam, ideal.tooth.x, ideal.shaftRight.y, depth.tooth);
  const tooth = worldPointFromNdc(cam, ideal.tooth.x, ideal.tooth.y, depth.tooth);

  for (const p of [bow, bowRim, shaftLeft, shaftRight, toothTop, tooth]) {
    p.x += offset.x;
    p.y += offset.y;
    p.z += offset.z;
  }

  return {
    bow,
    bowRim,
    shaftLeft,
    shaftRight,
    toothTop,
    tooth,
    anchors: [
      { world: bow.clone(), ideal: { ...ideal.bow } },
      { world: shaftLeft.clone(), ideal: { ...ideal.shaftLeft } },
      { world: shaftRight.clone(), ideal: { ...ideal.shaftRight } },
      { world: tooth.clone(), ideal: { ...ideal.tooth } },
    ],
  };
}
