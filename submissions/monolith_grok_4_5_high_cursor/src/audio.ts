type Tone = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  slide?: number;
};

export class AudioEngine {
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
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.unlocked = true;
  }

  private playTone({ freq, duration, type = 'square', gain = 0.05, slide }: Tone): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slide != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), this.ctx.currentTime + duration);
    }
    amp.gain.setValueAtTime(gain, this.ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  shoot(): void {
    this.playTone({ freq: 660, duration: 0.08, type: 'square', gain: 0.04, slide: 220 });
  }

  explosion(): void {
    this.playTone({ freq: 180, duration: 0.22, type: 'sawtooth', gain: 0.07, slide: 60 });
  }

  hit(): void {
    this.playTone({ freq: 120, duration: 0.28, type: 'triangle', gain: 0.08, slide: 40 });
  }

  start(): void {
    this.playTone({ freq: 392, duration: 0.1, type: 'square', gain: 0.05 });
    setTimeout(() => this.playTone({ freq: 523, duration: 0.12, type: 'square', gain: 0.05 }), 90);
  }

  gameOver(): void {
    this.playTone({ freq: 300, duration: 0.2, type: 'sawtooth', gain: 0.06, slide: 80 });
    setTimeout(() => this.playTone({ freq: 180, duration: 0.35, type: 'triangle', gain: 0.06, slide: 50 }), 150);
  }
}
