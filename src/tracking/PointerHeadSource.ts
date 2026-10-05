import { neutralPose, type HeadPose, type HeadPoseSource } from './HeadPose';

const DRAG_THRESHOLD_PX = 6;

/**
 * Simulates head movement with mouse / touch drags.
 *
 * Dragging moves the virtual head relative to where it was (like leaning),
 * and the position is held on release so you can inspect a viewpoint and
 * still tap objects. Dragging across the full screen width sweeps x from -1
 * to +1. The mouse wheel moves the head closer / farther.
 */
export class PointerHeadSource implements HeadPoseSource {
  readonly pose: HeadPose = neutralPose();

  private activePointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private travelled = 0;

  attach(el: HTMLElement): () => void {
    const onDown = (e: PointerEvent) => {
      if (this.activePointer !== null || isUiTarget(e.target)) return;
      this.activePointer = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.travelled = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.activePointer) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.travelled += Math.abs(dx) + Math.abs(dy);
      if (this.travelled < DRAG_THRESHOLD_PX) return;

      const rect = el.getBoundingClientRect();
      this.pose.x = clamp(this.pose.x + (dx / rect.width) * 2, -1, 1);
      this.pose.y = clamp(this.pose.y - (dy / rect.width) * 2, -1, 1);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId === this.activePointer) this.activePointer = null;
    };

    const onWheel = (e: WheelEvent) => {
      if (isUiTarget(e.target)) return;
      e.preventDefault();
      this.pose.z = clamp(this.pose.z + e.deltaY * 0.0015, -0.5, 1);
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  }

  recenter() {
    this.pose.x = 0;
    this.pose.y = 0;
    this.pose.z = 0;
  }
}

function isUiTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-ui]') !== null;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
