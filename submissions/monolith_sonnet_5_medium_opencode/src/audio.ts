// Lightweight generated Web Audio SFX. No external audio files.
// AudioContext is only created after a user gesture (see resume()).

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted = false;

  get muted() {
    return this._muted;
  }

  /** Must be called from within a user-gesture handler (click/keydown/touch). */
  ensureStarted(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._muted ? 0 : 0.35;
    this.masterGain.connect(this.ctx.destination);
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.35;
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this._muted);
    return this._muted;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainPeak = 0.6, glideTo?: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  shoot() {
    this.tone(880, 0.08, 'square', 0.25, 220);
  }

  explosion() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.3);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.3);
  }

  hit() {
    this.tone(220, 0.15, 'sawtooth', 0.4, 80);
  }

  gameOver() {
    this.tone(320, 0.5, 'sawtooth', 0.4, 60);
  }

  powerBeep() {
    this.tone(660, 0.12, 'triangle', 0.3, 1200);
  }
}
