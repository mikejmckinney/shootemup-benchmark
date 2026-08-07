import { describe, expect, it, vi } from 'vitest';
import { createAudioController } from '../../src/game/audio';
import { getMotionProfile } from '../../src/game/render';

describe('audio controller', () => {
  it('does not create audio until explicitly unlocked', () => {
    const factory = vi.fn();
    const audio = createAudioController(factory);

    expect(factory).not.toHaveBeenCalled();
    audio.toggleMute();
    expect(audio.isMuted()).toBe(true);
  });

  it('unlocks from a user gesture and tolerates unavailable audio', async () => {
    const factory = vi.fn(() => ({
      state: 'suspended',
      resume: vi.fn(async () => undefined),
      createOscillator: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
      createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() })),
      destination: {},
      currentTime: 0,
    }));
    const audio = createAudioController(factory);

    await audio.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
    audio.playShoot();
    audio.toggleMute();
    audio.playHit();
  });

  it('selects a static, low-glow profile for reduced motion', () => {
    expect(getMotionProfile(true)).toEqual({ gridAlpha: 0.16, glowBlur: 0 });
    expect(getMotionProfile(false)).toEqual({ gridAlpha: 0.3, glowBlur: 18 });
  });
});
