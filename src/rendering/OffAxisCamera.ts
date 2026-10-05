import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

/**
 * Head-coupled perspective.
 *
 * The physical screen is modelled as a fixed rectangular window lying in the
 * world plane z = 0, centered on the origin. The virtual room lives behind it
 * (z < 0). The camera sits at the viewer's eye position (z > 0), always looks
 * straight down -Z (it never rotates), and uses an asymmetric frustum whose
 * edges pass exactly through the window's edges.
 *
 * Moving the eye therefore changes *what is visible through the window*
 * rather than turning a camera: near objects stay roughly pinned to the
 * glass, distant ones slide, and you can see around things.
 */

export interface WindowSize {
  width: number;
  height: number;
}

/** Portrait design window. The real window always contains this rectangle. */
export const DESIGN_WINDOW: WindowSize = { width: 1, height: 2.1 };

export function computeWindowSize(aspect: number, design: WindowSize = DESIGN_WINDOW): WindowSize {
  const width = Math.max(design.width, design.height * aspect);
  return { width, height: width / aspect };
}

export interface Frustum {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
}

const MIN_EYE_DISTANCE = 0.5;

export class OffAxisCamera extends PerspectiveCamera {
  readonly eye = new Vector3(0, 0, 5);
  readonly window: WindowSize = { ...DESIGN_WINDOW };
  readonly frustum: Frustum = { left: 0, right: 0, top: 0, bottom: 0, near: 0, far: 0 };

  constructor(near = 0.05, far = 60) {
    super(30, 1, near, far);
    this.manual = true;
    this.updateProjectionMatrix();
  }

  /** Eye position in world units, relative to the window center. */
  setEye(x: number, y: number, z: number) {
    this.eye.set(x, y, Math.max(MIN_EYE_DISTANCE, z));
    this.updateProjectionMatrix();
  }

  setAspect(aspect: number) {
    this.aspect = aspect;
    this.updateProjectionMatrix();
  }

  override updateProjectionMatrix() {
    // Called once by the PerspectiveCamera constructor before our fields exist.
    if (!this.eye) {
      super.updateProjectionMatrix();
      return;
    }

    const size = computeWindowSize(this.aspect);
    this.window.width = size.width;
    this.window.height = size.height;

    const { x: ex, y: ey, z: ez } = this.eye;
    const halfW = size.width / 2;
    const halfH = size.height / 2;
    const n = this.near;
    const scale = n / ez;

    const f = this.frustum;
    f.left = (-halfW - ex) * scale;
    f.right = (halfW - ex) * scale;
    f.bottom = (-halfH - ey) * scale;
    f.top = (halfH - ey) * scale;
    f.near = n;
    f.far = this.far;

    this.position.copy(this.eye);
    this.quaternion.identity();
    this.fov = MathUtils.radToDeg(2 * Math.atan(halfH / ez));

    this.projectionMatrix.makePerspective(f.left, f.right, f.top, f.bottom, n, this.far);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}

declare module 'three' {
  interface PerspectiveCamera {
    /** react-three-fiber: when true, R3F will not overwrite aspect on resize. */
    manual?: boolean;
  }
}
