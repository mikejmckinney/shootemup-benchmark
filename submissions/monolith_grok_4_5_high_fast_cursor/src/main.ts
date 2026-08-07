import './style.css';
import { Game } from './game/Game';
import { LeaderboardService } from './leaderboard';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app missing');

const game = new Game();
const leaderboard = new LeaderboardService();

app.innerHTML = `
  <div class="shell">
    <header class="brand">
      <h1>NEON BARRAGE</h1>
      <p>Arcade interceptor · survive the swarm</p>
    </header>

    <section>
      <div class="stage">
        <div class="hud">
          <span>Score <strong data-testid="score">0</strong></span>
          <span>Lives <strong data-testid="lives">3</strong></span>
        </div>
        <canvas data-testid="game-canvas" aria-label="Neon Barrage game canvas"></canvas>
      </div>

      <div class="controls">
        <button type="button" data-testid="start-button">Start</button>
        <button type="button" data-testid="mute-button" aria-pressed="false">Sound On</button>
      </div>

      <div class="touch" data-testid="touch-controls">
        <div class="pad">
          <span></span>
          <button type="button" data-touch="up">Up</button>
          <span></span>
          <button type="button" data-touch="left">Left</button>
          <button type="button" data-touch="down">Down</button>
          <button type="button" data-touch="right">Right</button>
        </div>
        <button type="button" class="fire" data-touch="fire">Fire</button>
      </div>
    </section>

    <aside class="panel">
      <h2>Leaderboard</h2>
      <p class="hint">WASD / Arrows move · Space fires · Top 10 persists in Supabase.</p>
      <p class="status" data-role="lb-status">Loading scores…</p>
      <ol class="leaderboard" data-testid="leaderboard"></ol>

      <div class="form-row" style="margin-top: 1rem">
        <label for="player-name">Pilot callsign</label>
        <input
          id="player-name"
          data-testid="player-name"
          maxlength="16"
          minlength="1"
          placeholder="1–16 chars"
          autocomplete="username"
        />
        <button type="button" data-testid="submit-score" disabled>Submit Score</button>
        <p class="status" data-role="submit-status"></p>
      </div>
    </aside>
  </div>
`;

const canvas = app.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]')!;
const scoreEl = app.querySelector<HTMLElement>('[data-testid="score"]')!;
const livesEl = app.querySelector<HTMLElement>('[data-testid="lives"]')!;
const startBtn = app.querySelector<HTMLButtonElement>('[data-testid="start-button"]')!;
const muteBtn = app.querySelector<HTMLButtonElement>('[data-testid="mute-button"]')!;
const submitBtn = app.querySelector<HTMLButtonElement>('[data-testid="submit-score"]')!;
const nameInput = app.querySelector<HTMLInputElement>('[data-testid="player-name"]')!;
const boardEl = app.querySelector<HTMLOListElement>('[data-testid="leaderboard"]')!;
const lbStatus = app.querySelector<HTMLElement>('[data-role="lb-status"]')!;
const submitStatus = app.querySelector<HTMLElement>('[data-role="submit-status"]')!;

game.mount(canvas);

function renderHud(): void {
  const snap = game.getSnapshot();
  scoreEl.textContent = String(snap.score);
  livesEl.textContent = String(snap.lives);
  const canSubmit = snap.phase === 'gameover';
  submitBtn.disabled = !canSubmit;
  startBtn.textContent = snap.phase === 'playing' ? 'Restart' : snap.phase === 'gameover' ? 'Play Again' : 'Start';
}

function renderLeaderboard(): void {
  if (leaderboard.status === 'loading') {
    lbStatus.textContent = 'Loading scores…';
    lbStatus.className = 'status';
  } else if (leaderboard.status === 'empty') {
    lbStatus.textContent = 'No scores yet — be the first.';
    lbStatus.className = 'status';
  } else if (leaderboard.status === 'error') {
    lbStatus.textContent = `Leaderboard unavailable: ${leaderboard.errorMessage}`;
    lbStatus.className = 'status error';
  } else if (leaderboard.status === 'ready') {
    lbStatus.textContent = 'Top pilots';
    lbStatus.className = 'status';
  }

  boardEl.innerHTML = leaderboard.entries
    .map(
      (e, i) => `
      <li>
        <span class="rank">${i + 1}</span>
        <span class="name">${escapeHtml(e.player_name)}</span>
        <span class="score">${e.score}</span>
      </li>`,
    )
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

game.setOnChange(renderHud);
renderHud();

startBtn.addEventListener('click', () => {
  void game.start();
});

muteBtn.addEventListener('click', () => {
  void game.audio.ensureStarted();
  const muted = game.audio.toggleMute();
  muteBtn.textContent = muted ? 'Muted' : 'Sound On';
  muteBtn.setAttribute('aria-pressed', String(muted));
});

submitBtn.addEventListener('click', async () => {
  if (game.phase !== 'gameover') return;
  submitBtn.disabled = true;
  submitStatus.textContent = 'Submitting…';
  submitStatus.className = 'status';
  const result = await leaderboard.submitScore(nameInput.value, game.score);
  submitStatus.textContent = result.message;
  submitStatus.className = result.ok ? 'status ok' : 'status error';
  renderLeaderboard();
  submitBtn.disabled = game.phase !== 'gameover';
});

const touchRoot = app.querySelector('[data-testid="touch-controls"]')!;
touchRoot.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach((btn) => {
  const dir = btn.dataset.touch as 'left' | 'right' | 'up' | 'down' | 'fire';
  const set = (down: boolean) => (e: Event) => {
    e.preventDefault();
    game.input.setTouch(dir, down);
  };
  btn.addEventListener('pointerdown', set(true));
  btn.addEventListener('pointerup', set(false));
  btn.addEventListener('pointerleave', set(false));
  btn.addEventListener('pointercancel', set(false));
});

void leaderboard.fetchTop(10).then(renderLeaderboard);

declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => ReturnType<Game['getSnapshot']>;
      endGameForTest: (score: number) => void;
    };
  }
}

window.__NEON_BARRAGE__ = {
  getState: () => game.getSnapshot(),
  endGameForTest: (score: number) => {
    game.endGameForTest(score);
    renderHud();
  },
};
