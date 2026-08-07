export class AudioSystem {
  private ctx: AudioContext | null = null;
  private muted = false;
  private unlocked = false;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.unlocked = true;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain = 0.08): void {
    if (this.muted || !this.ctx || !this.unlocked) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  playShoot(): void {
    this.tone(880, 0.08, 'square', 0.05);
  }

  playHit(): void {
    this.tone(220, 0.12, 'sawtooth', 0.07);
  }

  playExplosion(): void {
    this.tone(110, 0.22, 'triangle', 0.09);
    this.tone(55, 0.28, 'sawtooth', 0.05);
  }

  playGameOver(): void {
    this.tone(330, 0.18, 'sine', 0.08);
    setTimeout(() => this.tone(220, 0.25, 'sine', 0.08), 120);
    setTimeout(() => this.tone(140, 0.4, 'triangle', 0.08), 260);
  }

  playStart(): void {
    this.tone(523, 0.1, 'square', 0.06);
    setTimeout(() => this.tone(659, 0.1, 'square', 0.06), 90);
    setTimeout(() => this.tone(784, 0.16, 'square', 0.06), 180);
  }
}
