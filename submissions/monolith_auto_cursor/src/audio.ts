export class AudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private unlocked = false;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx) {
      void this.ctx.suspend().catch(() => undefined);
      if (!muted && this.unlocked) {
        void this.ctx.resume().catch(() => undefined);
      }
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.unlocked = true;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType,
    gain = 0.08,
    slideTo?: number,
  ): void {
    if (this.muted || !this.ctx || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
    }
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  shoot(): void {
    this.tone(880, 0.07, 'square', 0.04, 420);
  }

  explode(): void {
    this.tone(180, 0.18, 'sawtooth', 0.07, 60);
  }

  hurt(): void {
    this.tone(140, 0.22, 'triangle', 0.08, 40);
  }

  gameOver(): void {
    this.tone(220, 0.35, 'sine', 0.07, 80);
  }

  ui(): void {
    this.tone(660, 0.06, 'sine', 0.04);
  }
}
