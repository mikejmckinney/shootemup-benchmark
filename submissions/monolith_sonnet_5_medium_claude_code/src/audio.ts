// Lightweight Web Audio synth. No audio assets, no autoplay: context resumes
// only after a user gesture (start button / touch), per browser autoplay policy.
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  muted = false;

  init(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.35;
    this.masterGain.connect(this.ctx.destination);
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.35;
    }
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain = 0.5, sweepTo?: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (sweepTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(sweepTo, 1), this.ctx.currentTime + duration);
    }
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  shoot(): void {
    this.tone(880, 0.08, "square", 0.15, 440);
  }

  explosion(): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    noise.connect(g);
    g.connect(this.masterGain);
    noise.start();
  }

  hit(): void {
    this.tone(220, 0.2, "sawtooth", 0.3, 80);
  }

  gameOver(): void {
    this.tone(300, 0.5, "sawtooth", 0.25, 60);
  }

  levelUp(): void {
    this.tone(660, 0.15, "triangle", 0.2, 990);
  }
}
