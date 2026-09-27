export class AudioSystem {
  enabled = true;
  volume = 0.35;
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  unlock(): void {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
      if (!this.noise) {
        this.noise = this.context.createBuffer(1, this.context.sampleRate * 0.25, this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
    } catch { this.enabled = false; }
  }

  play(kind: 'shot' | 'enemy' | 'reload' | 'hit' | 'step' | 'complete'): void {
    if (!this.enabled || !this.context || !this.noise || this.context.state !== 'running') return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const noise = ctx.createBufferSource();
    noise.buffer = this.noise;
    filter.type = 'lowpass';
    const level = kind === 'shot' ? 0.45 : kind === 'enemy' ? 0.22 : kind === 'step' ? 0.055 : 0.15;
    const duration = kind === 'reload' ? 0.1 : kind === 'hit' ? 0.13 : 0.065;
    filter.frequency.value = kind === 'reload' ? 2700 : kind === 'step' ? 350 : 1400;
    gain.gain.setValueAtTime(this.volume * level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
    noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
    if (kind === 'shot' || kind === 'complete') {
      const body = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      body.frequency.setValueAtTime(kind === 'complete' ? 620 : 145, now);
      body.frequency.exponentialRampToValueAtTime(kind === 'complete' ? 940 : 48, now + 0.1);
      bodyGain.gain.setValueAtTime(this.volume * 0.2, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      body.connect(bodyGain).connect(ctx.destination);
      body.start(); body.stop(now + 0.17);
      body.onended = () => { body.disconnect(); bodyGain.disconnect(); };
    }
  }

  dispose(): void {
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}