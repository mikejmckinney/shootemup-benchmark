import './style.css';
import { AudioEngine } from './audio';
import { hasSupabaseConfig, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { Game, type InputState, type Phase } from './game';
import {
  createLeaderboardClient,
  fetchTopScores,
  submitScore,
  type LeaderboardEntry,
} from './leaderboard';
import { renderGame, resizeCanvas } from './render';

declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => ReturnType<Game['getSnapshot']>;
      endGameForTest: (score: number) => void;
    };
  }
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app missing');

app.innerHTML = `
  <div class="shell">
    <header class="brand-bar">
      <div>
        <h1 class="brand">Neon Barrage</h1>
        <p class="tagline">Arcade neon shooter · survive the swarm</p>
      </div>
      <button type="button" class="btn btn-ghost" data-testid="mute-button" aria-pressed="false">Sound On</button>
    </header>

    <div class="layout">
      <section>
        <div class="hud">
          <div class="hud-stat">SCORE <span data-testid="score">0</span></div>
          <div class="hud-stat">LIVES <span data-testid="lives">3</span></div>
        </div>
        <div class="stage-wrap">
          <canvas data-testid="game-canvas" width="800" height="600" aria-label="Neon Barrage game canvas"></canvas>
          <div class="overlay" data-overlay="title">
            <div class="panel">
              <h2>Ready to engage</h2>
              <p>Clear hostile neon craft. Difficulty rises the longer you survive.</p>
              <button type="button" class="btn" data-testid="start-button">Start Run</button>
              <p class="controls-hint">Move: WASD / Arrows · Fire: Space · Mute: button above</p>
            </div>
          </div>
          <div class="overlay" data-overlay="gameover" hidden>
            <div class="panel">
              <h2>Run Over</h2>
              <p data-final-score>Final score: 0</p>
              <form class="score-form" data-score-form>
                <label for="player-name">Leaderboard name (1–16 chars)</label>
                <input id="player-name" name="player-name" data-testid="player-name" maxlength="16" autocomplete="username" placeholder="ACE_PILOT" />
                <button type="submit" class="btn" data-testid="submit-score">Submit Score</button>
              </form>
              <p class="status-line" data-submit-status></p>
              <button type="button" class="btn btn-ghost" data-restart>Play Again</button>
            </div>
          </div>
        </div>
        <div data-testid="touch-controls" aria-label="Touch controls">
          <div class="dpad">
            <button type="button" class="pad-btn" data-dir="up" aria-label="Up">▲</button>
            <button type="button" class="pad-btn" data-dir="left" aria-label="Left">◀</button>
            <button type="button" class="pad-btn" data-dir="right" aria-label="Right">▶</button>
            <button type="button" class="pad-btn" data-dir="down" aria-label="Down">▼</button>
          </div>
          <button type="button" class="fire-btn" data-fire aria-label="Fire">FIRE</button>
        </div>
      </section>

      <aside class="side">
        <div class="card">
          <h3>Top 10</h3>
          <ol class="leaderboard" data-testid="leaderboard"></ol>
          <p class="status-line" data-lb-status>Loading leaderboard…</p>
        </div>
        <div class="card">
          <h3>How to play</h3>
          <p class="status-line" style="min-height:0">Destroy enemies for points. Tanks shoot back. Survive escalating waves.</p>
        </div>
      </aside>
    </div>
  </div>
`;

const canvas = app.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]')!;
const scoreEl = app.querySelector<HTMLElement>('[data-testid="score"]')!;
const livesEl = app.querySelector<HTMLElement>('[data-testid="lives"]')!;
const muteBtn = app.querySelector<HTMLButtonElement>('[data-testid="mute-button"]')!;
const startBtn = app.querySelector<HTMLButtonElement>('[data-testid="start-button"]')!;
const titleOverlay = app.querySelector<HTMLElement>('[data-overlay="title"]')!;
const gameOverOverlay = app.querySelector<HTMLElement>('[data-overlay="gameover"]')!;
const finalScoreEl = app.querySelector<HTMLElement>('[data-final-score]')!;
const scoreForm = app.querySelector<HTMLFormElement>('[data-score-form]')!;
const nameInput = app.querySelector<HTMLInputElement>('[data-testid="player-name"]')!;
const submitBtn = app.querySelector<HTMLButtonElement>('[data-testid="submit-score"]')!;
const submitStatus = app.querySelector<HTMLElement>('[data-submit-status]')!;
const restartBtn = app.querySelector<HTMLButtonElement>('[data-restart]')!;
const leaderboardEl = app.querySelector<HTMLOListElement>('[data-testid="leaderboard"]')!;
const lbStatus = app.querySelector<HTMLElement>('[data-lb-status]')!;

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context unavailable');
const drawCtx: CanvasRenderingContext2D = ctx;

resizeCanvas(canvas);

const game = new Game();
const audio = new AudioEngine();
const input: InputState = { up: false, down: false, left: false, right: false, fire: false };

const client = hasSupabaseConfig()
  ? createLeaderboardClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let last = performance.now();
let submitting = false;

function setOverlay(phase: Phase): void {
  titleOverlay.hidden = phase !== 'title';
  gameOverOverlay.hidden = phase !== 'gameover';
}

function syncHud(): void {
  scoreEl.textContent = String(game.score);
  livesEl.textContent = String(game.lives);
}

function renderLeaderboard(entries: LeaderboardEntry[]): void {
  if (entries.length === 0) {
    leaderboardEl.innerHTML = '<li><span class="rank">—</span><span>No scores yet</span><span class="score"></span></li>';
    return;
  }
  leaderboardEl.innerHTML = entries
    .map(
      (e, i) =>
        `<li><span class="rank">${i + 1}</span><span>${escapeHtml(e.player_name)}</span><span class="score">${e.score}</span></li>`,
    )
    .join('');
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function refreshLeaderboard(): Promise<void> {
  if (!client) {
    lbStatus.textContent = 'Leaderboard unavailable (missing config).';
    lbStatus.className = 'status-line error';
    leaderboardEl.innerHTML = '';
    return;
  }
  lbStatus.textContent = 'Loading leaderboard…';
  lbStatus.className = 'status-line';
  const result = await fetchTopScores(client, 10);
  if (result.error) {
    lbStatus.textContent = `Network error: ${result.error}`;
    lbStatus.className = 'status-line error';
    return;
  }
  renderLeaderboard(result.data ?? []);
  lbStatus.textContent = (result.data?.length ?? 0) === 0 ? 'Be the first on the board.' : 'Updated.';
  lbStatus.className = 'status-line ok';
}

async function unlockAudio(): Promise<void> {
  try {
    await audio.unlock();
  } catch {
    /* ignore autoplay restrictions until next gesture */
  }
}

function startGame(): void {
  void unlockAudio();
  audio.ui();
  game.reset();
  setOverlay('playing');
  submitStatus.textContent = '';
  submitStatus.className = 'status-line';
  nameInput.value = '';
  submitting = false;
  submitBtn.disabled = false;
  syncHud();
}

function showGameOver(score: number): void {
  setOverlay('gameover');
  finalScoreEl.textContent = `Final score: ${score}`;
  syncHud();
  audio.gameOver();
}

game.onScore = () => syncHud();
game.onLifeLost = () => {
  syncHud();
  audio.hurt();
};
game.onEnemyDestroyed = () => audio.explode();
game.onShoot = () => audio.shoot();
game.onGameOver = (score) => showGameOver(score);

startBtn.addEventListener('click', () => startGame());
restartBtn.addEventListener('click', () => startGame());

muteBtn.addEventListener('click', () => {
  void unlockAudio();
  const muted = audio.toggleMute();
  muteBtn.textContent = muted ? 'Sound Off' : 'Sound On';
  muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
});

scoreForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (submitting) return;
  if (!client) {
    submitStatus.textContent = 'Cannot submit: Supabase is not configured.';
    submitStatus.className = 'status-line error';
    return;
  }
  submitting = true;
  submitBtn.disabled = true;
  submitStatus.textContent = 'Submitting…';
  submitStatus.className = 'status-line';
  const result = await submitScore(client, nameInput.value, game.score);
  if (result.error) {
    submitStatus.textContent = result.error;
    submitStatus.className = 'status-line error';
    submitting = false;
    submitBtn.disabled = false;
    return;
  }
  submitStatus.textContent = 'Score saved!';
  submitStatus.className = 'status-line ok';
  await refreshLeaderboard();
  submitting = false;
  submitBtn.disabled = false;
});

function bindKey(code: string, pressed: boolean): void {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      input.up = pressed;
      break;
    case 'ArrowDown':
    case 'KeyS':
      input.down = pressed;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      input.left = pressed;
      break;
    case 'ArrowRight':
    case 'KeyD':
      input.right = pressed;
      break;
    case 'Space':
      input.fire = pressed;
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  bindKey(e.code, true);
});
window.addEventListener('keyup', (e) => bindKey(e.code, false));

function bindHold(el: Element, on: () => void, off: () => void): void {
  const start = (ev: Event) => {
    ev.preventDefault();
    on();
  };
  const end = (ev: Event) => {
    ev.preventDefault();
    off();
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', end);
}

app.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((btn) => {
  const dir = btn.dataset.dir as 'up' | 'down' | 'left' | 'right';
  bindHold(
    btn,
    () => {
      input[dir] = true;
    },
    () => {
      input[dir] = false;
    },
  );
});

const fireBtn = app.querySelector<HTMLButtonElement>('[data-fire]')!;
bindHold(
  fireBtn,
  () => {
    input.fire = true;
  },
  () => {
    input.fire = false;
  },
);

function frame(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt, input);
  renderGame(drawCtx, game, now / 1000);
  requestAnimationFrame(frame);
}

setOverlay('title');
syncHud();
void refreshLeaderboard();
requestAnimationFrame(frame);

window.__NEON_BARRAGE__ = {
  getState: () => game.getSnapshot(),
  endGameForTest: (score: number) => {
    game.endGameForTest(score);
  },
};
