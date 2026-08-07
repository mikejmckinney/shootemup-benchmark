export class AudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private started = false;

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  async ensureStarted(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.started = true;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain = 0.08,
    slideTo?: number,
  ): void {
    if (!this.started || this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
    }
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  shoot(): void {
    this.tone(660, 0.08, 'square', 0.05, 220);
  }

  explosion(): void {
    this.tone(120, 0.25, 'sawtooth', 0.09, 40);
  }

  hit(): void {
    this.tone(180, 0.15, 'triangle', 0.07, 60);
  }

  start(): void {
    this.tone(440, 0.1, 'sine', 0.06);
    this.tone(660, 0.15, 'sine', 0.05);
  }

  gameOver(): void {
    this.tone(330, 0.2, 'sawtooth', 0.07, 110);
    this.tone(165, 0.35, 'triangle', 0.06, 55);
  }
}
