/**
 * One Euro filter (Casiez et al. 2012): an adaptive low-pass filter.
 * Heavy smoothing while the signal is still (kills landmark jitter), light
 * smoothing while it moves quickly (keeps deliberate motion responsive).
 */
export class OneEuroFilter {
  private value = 0;
  private derivative = 0;
  private lastTime = 0;
  private initialized = false;

  constructor(
    public minCutoff: number,
    public beta: number,
    public derivativeCutoff = 1,
  ) {}

  reset() {
    this.initialized = false;
    this.derivative = 0;
  }

  filter(sample: number, timeSeconds: number): number {
    if (!this.initialized) {
      this.initialized = true;
      this.value = sample;
      this.lastTime = timeSeconds;
      return sample;
    }
    const dt = Math.max(1e-3, timeSeconds - this.lastTime);
    this.lastTime = timeSeconds;

    const rawDerivative = (sample - this.value) / dt;
    this.derivative += smoothingFactor(dt, this.derivativeCutoff) * (rawDerivative - this.derivative);

    const cutoff = this.minCutoff + this.beta * Math.abs(this.derivative);
    this.value += smoothingFactor(dt, cutoff) * (sample - this.value);
    return this.value;
  }
}

function smoothingFactor(dt: number, cutoffHz: number) {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dt);
}
