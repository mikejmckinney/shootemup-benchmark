// Generated Web Audio SFX. The AudioContext is only constructed after a real
// user gesture, so browsers never block or warn about autoplay.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const Ctor = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.28;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone({ type = 'square', from, to, duration, gain = 1, delay = 0 }) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noise({ duration = 0.35, gain = 0.6 }) {
    if (muted || !ensure()) return;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + duration);
    const env = ctx.createGain();
    env.gain.value = gain;
    src.connect(filter).connect(env).connect(master);
    src.start();
  }

  return {
    unlock: ensure,
    get muted() { return muted; },
    setMuted(next) {
      muted = next;
      if (master) master.gain.value = muted ? 0 : 0.28;
    },
    play(event) {
      switch (event) {
        case 'shoot': return tone({ type: 'square', from: 900, to: 320, duration: 0.08, gain: 0.16 });
        case 'enemyShoot': return tone({ type: 'sawtooth', from: 320, to: 140, duration: 0.12, gain: 0.1 });
        case 'enemyHit': return tone({ type: 'triangle', from: 640, to: 420, duration: 0.06, gain: 0.14 });
        case 'explosion': return noise({ duration: 0.32, gain: 0.5 });
        case 'playerHit':
          noise({ duration: 0.5, gain: 0.7 });
          return tone({ type: 'sawtooth', from: 260, to: 60, duration: 0.5, gain: 0.3 });
        case 'wave':
          tone({ type: 'triangle', from: 480, to: 720, duration: 0.16, gain: 0.22 });
          return tone({ type: 'triangle', from: 720, to: 980, duration: 0.2, gain: 0.2, delay: 0.14 });
        case 'start': return tone({ type: 'triangle', from: 320, to: 880, duration: 0.28, gain: 0.24 });
        case 'gameover':
          tone({ type: 'sawtooth', from: 420, to: 180, duration: 0.4, gain: 0.26 });
          return tone({ type: 'sawtooth', from: 220, to: 70, duration: 0.7, gain: 0.24, delay: 0.3 });
        default: return undefined;
      }
    },
  };
}
