import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('Neon Barrage presentation contract', () => {
  it('keeps the stable selectors and narrow adapter', () => {
    for (const selector of [
      'game-canvas',
      'start-button',
      'score',
      'lives',
      'mute-button',
      'touch-controls',
      'leaderboard',
      'player-name',
      'submit-score',
    ]) {
      expect(html).toContain(`data-testid="${selector}"`);
    }

    expect(entry).toContain('__NEON_BARRAGE__');
    expect(entry).toContain('endGameForTest');
    expect(entry).toContain('requestAnimationFrame');
  });

  it('guards editable keyboard targets and releases touch state at the window boundary', () => {
    expect(entry).toContain('function isEditableTarget');
    expect(entry).toContain('if (isEditableTarget(event.target))');
    expect(entry).toMatch(/window\.addEventListener\('pointerup', releaseActiveTouch/);
    expect(entry).toMatch(/window\.addEventListener\('pointercancel', releaseActiveTouch/);

    const cleanupStart = entry.indexOf('function releaseActiveTouch');
    const cleanupEnd = entry.indexOf('function fireFromGesture', cleanupStart);
    const cleanup = entry.slice(cleanupStart, cleanupEnd);
    expect(cleanup.indexOf('activeTouches.get(event.pointerId)')).toBeGreaterThanOrEqual(0);
    expect(cleanup.indexOf('event.preventDefault()')).toBeGreaterThan(
      cleanup.indexOf('activeTouches.get(event.pointerId)'),
    );
  });

  it('keeps controls at least 44px and de-emphasizes touch controls on desktop', () => {
    expect(styles).toMatch(/\.mute-button\s*\{[\s\S]*min-height:\s*44px;/);
    expect(styles).toMatch(/\.touch-controls\s*\{[\s\S]*opacity:\s*0\.[0-9]+;/);
    expect(styles).toMatch(
      /@media \(max-width: 760px\) \{[\s\S]*\.touch-controls\s*\{[\s\S]*opacity:\s*1;/,
    );
  });
});
