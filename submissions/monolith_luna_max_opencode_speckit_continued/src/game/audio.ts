interface AudioNodeLike {
  connect(node: unknown): void;
  start(): void;
  stop(): void;
}

interface AudioGainLike {
  connect(node: unknown): void;
  gain: {
    setValueAtTime(value: number, time: number): void;
    exponentialRampToValueAtTime(value: number, time: number): void;
  };
}

interface AudioContextLike {
  state: string;
  currentTime: number;
  destination: unknown;
  resume(): Promise<void>;
  createOscillator(): AudioNodeLike;
  createGain(): AudioGainLike;
}

export interface AudioController {
  unlock(): Promise<void>;
  toggleMute(): boolean;
  isMuted(): boolean;
  playShoot(): void;
  playHit(): void;
  dispose(): void;
}

type AudioFactory = () => AudioContextLike;

function browserAudioFactory(): AudioContextLike {
  return new AudioContext() as unknown as AudioContextLike;
}

export function createAudioController(factory: AudioFactory = browserAudioFactory): AudioController {
  let context: AudioContextLike | null = null;
  let muted = false;

  const unlock = async () => {
    if (!context) {
      try {
        context = factory();
      } catch {
        return;
      }
    }
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch {
        context = null;
      }
    }
  };

  const tone = (frequency: number, duration: number) => {
    if (!context || muted) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.start();
      oscillator.stop();
    } catch {
      // Audio is optional and must never interrupt gameplay.
    }
  };

  return {
    unlock,
    toggleMute: () => {
      muted = !muted;
      return muted;
    },
    isMuted: () => muted,
    playShoot: () => tone(580, 0.06),
    playHit: () => tone(120, 0.12),
    dispose: () => {
      context = null;
    },
  };
}
