import { mulberry32 } from './random';
import { smoothstep } from './spring';

const BLINK_CLOSE = 0.07;
const BLINK_HOLD = 0.04;
const BLINK_OPEN = 0.16;
const BLINK_TOTAL = BLINK_CLOSE + BLINK_HOLD + BLINK_OPEN;

const BLINK_INTERVAL_MIN = 2.8;
const BLINK_INTERVAL_MAX = 6.2;
const DOUBLE_BLINK_CHANCE = 0.12;

/**
 * Lid closure for a synchronized pair of eyes: 0 = open, 1 = closed.
 *
 * Combines a slow base state (asleep / awake, explicit open / close) with
 * quick blinks layered on top. Auto-blink timing varies but comes from a
 * fixed-seed generator, so a session's blink rhythm is reproducible.
 */
export class Eyelids {
  closure = 1;

  private base = 1;
  private baseTarget = 1;
  private baseDuration = 0.5;
  private blinkT = -1;
  private queuedBlink = false;
  private untilBlink = 3;
  private rng = mulberry32(0x6d61736b);

  /** Ease the lids open over `duration` seconds. */
  open(duration = 0.5) {
    this.baseTarget = 0;
    this.baseDuration = duration;
  }

  close(duration = 0.35) {
    this.baseTarget = 1;
    this.baseDuration = duration;
  }

  /** Close immediately with no animation. */
  shut() {
    this.base = this.baseTarget = this.closure = 1;
    this.blinkT = -1;
    this.queuedBlink = false;
  }

  get isOpen() {
    return this.baseTarget === 0;
  }

  blink() {
    if (this.blinkT < 0) this.blinkT = 0;
    else this.queuedBlink = true;
  }

  update(dt: number, autoBlink: boolean) {
    const step = dt / Math.max(0.01, this.baseDuration);
    this.base = this.base < this.baseTarget ? Math.min(this.baseTarget, this.base + step) : Math.max(this.baseTarget, this.base - step);

    const awakeAndOpen = this.baseTarget === 0 && this.base === 0;
    if (autoBlink && awakeAndOpen) {
      this.untilBlink -= dt;
      if (this.untilBlink <= 0) {
        this.blink();
        if (this.rng() < DOUBLE_BLINK_CHANCE) this.queuedBlink = true;
        this.untilBlink = BLINK_INTERVAL_MIN + (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN) * this.rng();
      }
    }

    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const t = this.blinkT;
      if (t < BLINK_CLOSE) blink = smoothstep(0, BLINK_CLOSE, t);
      else if (t < BLINK_CLOSE + BLINK_HOLD) blink = 1;
      else blink = 1 - smoothstep(BLINK_CLOSE + BLINK_HOLD, BLINK_TOTAL, t);
      if (t >= BLINK_TOTAL) {
        this.blinkT = this.queuedBlink ? 0 : -1;
        this.queuedBlink = false;
      }
    }

    this.closure = Math.max(smoothstep(0, 1, this.base), blink);
  }
}