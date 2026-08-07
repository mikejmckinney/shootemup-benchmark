export class NeonAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.unlocked = false;
  }

  unlock() {
    if (this.muted || this.unlocked || typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
      this.unlocked = true;
      void this.context.resume();
    } catch {
      this.context = null;
      this.master = null;
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.muted) this.unlock();
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.16;
  }

  play(kind) {
    if (this.muted || !this.unlocked || !this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const settings = {
      fire: { type: 'square', start: 480, end: 130, duration: 0.08, volume: 0.18 },
      hit: { type: 'sine', start: 180, end: 90, duration: 0.18, volume: 0.25 },
      destroy: { type: 'sawtooth', start: 300, end: 42, duration: 0.26, volume: 0.28 },
      danger: { type: 'triangle', start: 110, end: 55, duration: 0.32, volume: 0.24 },
      start: { type: 'sine', start: 220, end: 660, duration: 0.34, volume: 0.2 },
      gameover: { type: 'sawtooth', start: 260, end: 48, duration: 0.5, volume: 0.22 }
    }[kind] || { type: 'sine', start: 220, end: 180, duration: 0.12, volume: 0.15 };
    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, settings.end), now + settings.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(settings.volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + settings.duration + 0.02);
  }
}
