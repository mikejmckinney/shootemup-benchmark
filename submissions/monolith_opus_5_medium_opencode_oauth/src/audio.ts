/**
 * Tiny Web Audio synth. The AudioContext is only created after a real user
 * gesture (start/mute/keypress), satisfying browser autoplay policies.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('nb:muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  /** Must be called from a user-gesture handler. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.28;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('nb:muted', muted ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.28, this.ctx.currentTime, 0.02);
    }
  }

  private blip(
    type: OscillatorType,
    from: number,
    to: number,
    dur: number,
    gain: number,
  ): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, freq: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
  }

  shoot(): void {
    this.blip('square', 880, 220, 0.09, 0.1);
  }

  explode(big: boolean): void {
    this.noise(big ? 0.55 : 0.26, big ? 0.5 : 0.28, big ? 1600 : 2600);
    if (big) this.blip('sawtooth', 200, 40, 0.45, 0.16);
  }

  hurt(): void {
    this.blip('sawtooth', 320, 70, 0.35, 0.22);
  }

  wave(): void {
    this.blip('triangle', 440, 880, 0.16, 0.16);
    window.setTimeout(() => this.blip('triangle', 660, 1320, 0.2, 0.14), 130);
  }

  gameOver(): void {
    this.blip('sawtooth', 420, 60, 0.9, 0.22);
  }

  ui(): void {
    this.blip('triangle', 660, 990, 0.08, 0.12);
  }
}
