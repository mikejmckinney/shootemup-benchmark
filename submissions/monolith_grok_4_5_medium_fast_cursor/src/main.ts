import './style.css';
import { AudioSystem } from './audio';
import { GAME_HEIGHT, GAME_WIDTH, GameEngine } from './game/engine';
import type { InputState, Phase } from './game/types';
import { LeaderboardService, validatePlayerName } from './leaderboard';

const audio = new AudioSystem();
const leaderboard = new LeaderboardService();

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <div class="shell">
    <header class="brand">
      <div>
        <h1>NEON BARRAGE</h1>
        <p>Arcade shooter with a persistent neon leaderboard.</p>
      </div>
    </header>

    <section class="stage-wrap">
      <div class="hud">
        <div class="hud-stat">
          <div>SCORE <span data-testid="score">0</span></div>
          <div>LIVES <span data-testid="lives">3</span></div>
        </div>
        <button type="button" data-testid="mute-button" aria-pressed="false">SOUND ON</button>
      </div>

      <div class="canvas-frame">
        <canvas data-testid="game-canvas" width="${GAME_WIDTH}" height="${GAME_HEIGHT}"></canvas>
      </div>

      <div class="controls-row">
        <button type="button" class="primary" data-testid="start-button">START</button>
      </div>

      <div class="touch-controls" data-testid="touch-controls" aria-label="Touch controls">
        <div class="dpad">
          <div class="spacer"></div>
          <button type="button" class="touch-btn" data-dir="up" aria-label="Move up">▲</button>
          <div class="spacer"></div>
          <button type="button" class="touch-btn" data-dir="left" aria-label="Move left">◀</button>
          <div class="spacer"></div>
          <button type="button" class="touch-btn" data-dir="right" aria-label="Move right">▶</button>
          <div class="spacer"></div>
          <button type="button" class="touch-btn" data-dir="down" aria-label="Move down">▼</button>
          <div class="spacer"></div>
        </div>
        <button type="button" class="touch-btn fire" data-dir="fire" aria-label="Fire">FIRE</button>
      </div>
    </section>

    <aside class="side">
      <section class="panel">
        <h2>CONTROLS</h2>
        <p class="help">
          <strong>Move:</strong> Arrow keys / WASD<br />
          <strong>Fire:</strong> Space<br />
          On phones, use the on-screen pad.
        </p>
      </section>

      <section class="panel">
        <h2>LEADERBOARD</h2>
        <ol class="leaderboard" data-testid="leaderboard"></ol>
        <p class="status" data-role="leaderboard-status">Loading leaderboard…</p>

        <form class="score-form" data-role="score-form">
          <label for="player-name">Callsign (1-16 chars)</label>
          <input
            id="player-name"
            data-testid="player-name"
            maxlength="16"
            autocomplete="nickname"
            placeholder="ACE PILOT"
            disabled
          />
          <button type="submit" data-testid="submit-score" disabled>SUBMIT SCORE</button>
          <p class="status" data-role="submit-status"></p>
        </form>
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
const leaderboardStatus = app.querySelector<HTMLElement>('[data-role="leaderboard-status"]')!;
const submitStatus = app.querySelector<HTMLElement>('[data-role="submit-status"]')!;
const nameInput = app.querySelector<HTMLInputElement>('[data-testid="player-name"]')!;
const submitBtn = app.querySelector<HTMLButtonElement>('[data-testid="submit-score"]')!;
const scoreForm = app.querySelector<HTMLFormElement>('[data-role="score-form"]')!;

const input: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
};

function syncHud(): void {
  const snap = engine.getSnapshot();
  scoreEl.textContent = String(snap.score);
  livesEl.textContent = String(snap.lives);
}

function setSubmitEnabled(enabled: boolean): void {
  nameInput.disabled = !enabled;
  submitBtn.disabled = !enabled;
  if (enabled) {
    submitStatus.textContent = 'Enter a callsign to save your score.';
    submitStatus.className = 'status';
  }
}

function onPhaseChange(phase: Phase): void {
  if (phase === 'playing') {
    startBtn.textContent = 'RESTART';
    setSubmitEnabled(false);
    submitStatus.textContent = '';
    submitStatus.className = 'status';
  } else if (phase === 'gameover') {
    startBtn.textContent = 'PLAY AGAIN';
    setSubmitEnabled(true);
  } else {
    startBtn.textContent = 'START';
    setSubmitEnabled(false);
  }
  syncHud();
}

const engine = new GameEngine(audio, onPhaseChange);

function keyToDir(key: string): keyof InputState | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    case ' ':
    case 'Spacebar':
      return 'fire';
    default:
      return null;
  }
}

window.addEventListener('keydown', (e) => {
  const dir = keyToDir(e.key);
  if (!dir) return;
  e.preventDefault();
  input[dir] = true;
});

window.addEventListener('keyup', (e) => {
  const dir = keyToDir(e.key);
  if (!dir) return;
  e.preventDefault();
  input[dir] = false;
});

function bindTouch(btn: HTMLElement, dir: keyof InputState): void {
  const down = (e: Event) => {
    e.preventDefault();
    input[dir] = true;
  };
  const up = (e: Event) => {
    e.preventDefault();
    input[dir] = false;
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointercancel', up);
}

app.querySelectorAll<HTMLElement>('.touch-btn[data-dir]').forEach((btn) => {
  const dir = btn.dataset.dir as keyof InputState;
  bindTouch(btn, dir);
});

async function unlockAudio(): Promise<void> {
  await audio.unlock();
}

startBtn.addEventListener('click', async () => {
  await unlockAudio();
  engine.start();
  syncHud();
});

muteBtn.addEventListener('click', async () => {
  await unlockAudio();
  const muted = audio.toggleMute();
  muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  muteBtn.setAttribute('aria-pressed', String(muted));
});

function renderLeaderboardEmpty(message: string): void {
  leaderboardEl.innerHTML = '';
  const li = document.createElement('li');
  li.style.gridTemplateColumns = '1fr';
  li.textContent = message;
  leaderboardEl.appendChild(li);
}

async function refreshLeaderboard(): Promise<void> {
  leaderboardStatus.textContent = 'Loading leaderboard…';
  leaderboardStatus.className = 'status';
  const result = await leaderboard.fetchTop(10);
  if (!result.ok) {
    leaderboardStatus.textContent = `Network error: ${result.error}`;
    leaderboardStatus.className = 'status error';
    renderLeaderboardEmpty('Unable to load scores.');
    return;
  }
  if (result.data.length === 0) {
    leaderboardStatus.textContent = 'No scores yet — be the first.';
    leaderboardStatus.className = 'status';
    renderLeaderboardEmpty('Leaderboard is empty.');
    return;
  }
  leaderboardEl.innerHTML = '';
  result.data.forEach((entry, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="rank">#${index + 1}</span>
      <span class="name"></span>
      <span class="score"></span>
    `;
    li.querySelector('.name')!.textContent = entry.player_name;
    li.querySelector('.score')!.textContent = String(entry.score);
    leaderboardEl.appendChild(li);
  });
  leaderboardStatus.textContent = `Top ${result.data.length} pilots`;
  leaderboardStatus.className = 'status ok';
}

scoreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (engine.phase !== 'gameover') {
    submitStatus.textContent = 'Finish a run before submitting.';
    submitStatus.className = 'status error';
    return;
  }
  const name = nameInput.value;
  const nameError = validatePlayerName(name);
  if (nameError) {
    submitStatus.textContent = nameError;
    submitStatus.className = 'status error';
    return;
  }

  submitBtn.disabled = true;
  submitStatus.textContent = 'Submitting…';
  submitStatus.className = 'status';

  const result = await leaderboard.submitScore(name, engine.score);
  if (!result.ok) {
    submitStatus.textContent = result.error;
    submitStatus.className = 'status error';
    submitBtn.disabled = false;
    return;
  }

  submitStatus.textContent = `Saved ${result.data.player_name} — ${result.data.score}`;
  submitStatus.className = 'status ok';
  nameInput.value = '';
  await refreshLeaderboard();
});

let last = performance.now();
function frame(now: number): void {
  const dt = now - last;
  last = now;
  engine.update(dt, input);
  engine.render(ctx!);
  syncHud();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
void refreshLeaderboard();

declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => ReturnType<GameEngine['getSnapshot']>;
      endGameForTest: (score: number) => void;
    };
  }
}

window.__NEON_BARRAGE__ = {
  getState: () => engine.getSnapshot(),
  endGameForTest: (score: number) => {
    engine.endGameForTest(score);
    syncHud();
  },
};
