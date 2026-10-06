/**
 * Short muted mechanical click via noise burst (not a tonal beep).
 * No-ops if AudioContext is unavailable or resume is blocked.
 */
export function playDoorClick() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const play = () => {
      const n = Math.floor(ctx.sampleRate * 0.035);
      const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const env = Math.exp(-i / (n * 0.12));
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      src.onended = () => void ctx.close().catch(() => {});
    };
    if (ctx.state === 'suspended') {
      void ctx.resume().then(play).catch(() => void ctx.close().catch(() => {}));
    } else {
      play();
    }
  } catch {
    // Leave silent rather than play a distracting fallback.
  }
}
