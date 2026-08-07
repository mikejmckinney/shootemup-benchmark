import './style.css';
import { AudioEngine } from './audio';
import { NeonBarrageGame, type InputState, type Phase } from './game';
import { fetchTopScores, submitScore, type LeaderboardEntry } from './leaderboard';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <div class="shell">
    <header class="brand">
      <h1>NEON BARRAGE</h1>
      <p>Arcade swarm clearance — survive the magenta night.</p>
    </header>

    <section class="stage-wrap" aria-label="Game stage">
      <div class="hud">
        <div class="hud-group">
          <div>SCORE <span data-testid="score">0</span></div>
          <div>LIVES <span data-testid="lives">3</span></div>
        </div>
        <button type="button" data-testid="mute-button" aria-pressed="false">SOUND ON</button>
      </div>
      <div class="canvas-frame">
        <canvas data-testid="game-canvas" width="480" height="720" aria-label="Neon Barrage game canvas"></canvas>
      </div>
      <div class="controls-row">
        <button type="button" data-testid="start-button">START</button>
      </div>
      <div data-testid="touch-controls" aria-label="Touch controls">
        <div class="dpad">
          <span class="spacer"></span>
          <button type="button" class="touch-btn" data-dir="up" aria-label="Move up">▲</button>
          <span class="spacer"></span>
          <button type="button" class="touch-btn" data-dir="left" aria-label="Move left">◀</button>
          <span class="spacer"></span>
          <button type="button" class="touch-btn" data-dir="right" aria-label="Move right">▶</button>
          <span class="spacer"></span>
          <button type="button" class="touch-btn" data-dir="down" aria-label="Move down">▼</button>
          <span class="spacer"></span>
        </div>
        <button type="button" class="fire-btn" data-fire aria-label="Fire">FIRE</button>
      </div>
    </section>

    <aside class="side">
      <section class="panel">
        <h2>LEADERBOARD</h2>
        <p class="leaderboard-status" data-leaderboard-status>Loading…</p>
        <ol data-testid="leaderboard"></ol>
        <form class="score-form" data-score-form>
          <label for="player-name">Callsign (1–16 chars)</label>
          <input
            id="player-name"
            data-testid="player-name"
            name="player-name"
            maxlength="16"
            minlength="1"
            autocomplete="username"
            placeholder="ACE_PILOT"
            disabled
          />
          <button type="submit" data-testid="submit-score" disabled>SUBMIT SCORE</button>
        </form>
      </section>
      <section class="panel help">
        <h2>CONTROLS</h2>
        <ul>
          <li>Move: Arrow keys or WASD</li>
          <li>Fire: Space</li>
          <li>Touch: on-screen pad + FIRE</li>
          <li>Mute: SOUND toggle</li>
        </ul>
      </section>
    </aside>
  </div>
`;

const canvas = app.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]')!;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D unavailable');

const scoreEl = app.querySelector<HTMLElement>('[data-testid="score"]')!;
const livesEl = app.querySelector<HTMLElement>('[data-testid="lives"]')!;
const startBtn = app.querySelector<HTMLButtonElement>('[data-testid="start-button"]')!;
const muteBtn = app.querySelector<HTMLButtonElement>('[data-testid="mute-button"]')!;
const leaderboardEl = app.querySelector<HTMLOListElement>('[data-testid="leaderboard"]')!;
const statusEl = app.querySelector<HTMLElement>('[data-leaderboard-status]')!;
const nameInput = app.querySelector<HTMLInputElement>('[data-testid="player-name"]')!;
const submitBtn = app.querySelector<HTMLButtonElement>('[data-testid="submit-score"]')!;
const scoreForm = app.querySelector<HTMLFormElement>('[data-score-form]')!;

const audio = new AudioEngine();
const input: InputState = { left: false, right: false, up: false, down: false, fire: false };

let pendingScore = 0;
let canSubmit = false;
let submitting = false;

function setHud(score: number, lives: number): void {
  scoreEl.textContent = String(score);
  livesEl.textContent = String(lives);
}

function setScoreFormEnabled(enabled: boolean): void {
  canSubmit = enabled;
  nameInput.disabled = !enabled || submitting;
  submitBtn.disabled = !enabled || submitting;
}

function setPhaseUI(phase: Phase): void {
  if (phase === 'playing') {
    startBtn.textContent = 'RESTART';
    setScoreFormEnabled(false);
  } else if (phase === 'gameover') {
    startBtn.textContent = 'PLAY AGAIN';
    pendingScore = game.score;
    setScoreFormEnabled(true);
  } else {
    startBtn.textContent = 'START';
    setScoreFormEnabled(false);
  }
}

const game = new NeonBarrageGame({
  onHud: setHud,
  onPhase: setPhaseUI,
  onShoot: () => audio.shoot(),
  onExplosion: () => audio.explosion(),
  onHit: () => audio.hit(),
  onGameOver: () => audio.gameOver(),
});

function renderLeaderboard(entries: LeaderboardEntry[]): void {
  leaderboardEl.innerHTML = '';
  if (entries.length === 0) {
    statusEl.className = 'leaderboard-status';
    statusEl.textContent = 'No scores yet — be the first.';
    return;
  }
  statusEl.className = 'leaderboard-status ok';
  statusEl.textContent = 'Top pilots';
  entries.forEach((entry, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="rank">${index + 1}</span>
      <span class="name"></span>
      <span class="score"></span>
    `;
    li.querySelector('.name')!.textContent = entry.player_name;
    li.querySelector('.score')!.textContent = String(entry.score);
    leaderboardEl.appendChild(li);
  });
}

async function refreshLeaderboard(): Promise<void> {
  statusEl.className = 'leaderboard-status';
  statusEl.textContent = 'Loading…';
  const result = await fetchTopScores(10);
  if (!result.ok) {
    statusEl.className = 'leaderboard-status error';
    statusEl.textContent = result.error;
    leaderboardEl.innerHTML = '';
    return;
  }
  renderLeaderboard(result.entries);
}

async function beginGame(): Promise<void> {
  await audio.unlock();
  audio.start();
  game.start();
  setHud(game.score, game.lives);
  setPhaseUI(game.phase);
}

startBtn.addEventListener('click', () => {
  void beginGame();
});

muteBtn.addEventListener('click', () => {
  void audio.unlock();
  const muted = audio.toggleMute();
  muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  muteBtn.setAttribute('aria-pressed', String(muted));
});

scoreForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!canSubmit || submitting) return;

  submitting = true;
  setScoreFormEnabled(true);
  statusEl.className = 'leaderboard-status';
  statusEl.textContent = 'Submitting…';

  const result = await submitScore(nameInput.value, pendingScore);
  submitting = false;
  setScoreFormEnabled(true);

  if (!result.ok) {
    statusEl.className = 'leaderboard-status error';
    statusEl.textContent = result.error;
    return;
  }

  statusEl.className = 'leaderboard-status ok';
  statusEl.textContent = 'Score saved.';
  setScoreFormEnabled(false);
  await refreshLeaderboard();
});

function bindKey(code: string, down: boolean): void {
  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
      input.left = down;
      break;
    case 'ArrowRight':
    case 'KeyD':
      input.right = down;
      break;
    case 'ArrowUp':
    case 'KeyW':
      input.up = down;
      break;
    case 'ArrowDown':
    case 'KeyS':
      input.down = down;
      break;
    case 'Space':
      input.fire = down;
      break;
    default:
      break;
  }
}

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
  bindKey(e.code, true);
});

window.addEventListener('keyup', (e) => {
  bindKey(e.code, false);
});

function bindTouchButton(el: Element, on: () => void, off: () => void): void {
  const start = (event: Event) => {
    event.preventDefault();
    on();
  };
  const end = (event: Event) => {
    event.preventDefault();
    off();
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointerleave', end);
  el.addEventListener('pointercancel', end);
}

app.querySelectorAll<HTMLButtonElement>('.touch-btn[data-dir]').forEach((btn) => {
  const dir = btn.dataset.dir as 'up' | 'down' | 'left' | 'right';
  bindTouchButton(
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
bindTouchButton(
  fireBtn,
  () => {
    input.fire = true;
  },
  () => {
    input.fire = false;
  },
);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt, input);
  game.draw(ctx!);
  requestAnimationFrame(frame);
}

setHud(0, 3);
setPhaseUI('ready');
void refreshLeaderboard();
requestAnimationFrame(frame);

declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => ReturnType<NeonBarrageGame['getSnapshot']>;
      endGameForTest: (score: number) => void;
    };
  }
}

window.__NEON_BARRAGE__ = {
  getState: () => game.getSnapshot(),
  endGameForTest: (score: number) => {
    game.endGameForTest(score);
    pendingScore = game.score;
    setHud(game.score, game.lives);
    setPhaseUI(game.phase);
  },
};
