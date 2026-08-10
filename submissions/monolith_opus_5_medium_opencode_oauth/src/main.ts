import './styles.css';
import { Game, validateName } from './engine';
import { Renderer } from './render';
import { Sound } from './audio';
import { LeaderboardClient, LeaderboardError, type LeaderboardEntry } from './leaderboard';

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
};

const canvas = $<HTMLCanvasElement>('#game-canvas');
const overlay = $<HTMLDivElement>('#overlay');
const panels = {
  menu: $<HTMLDivElement>('#panel-menu'),
  paused: $<HTMLDivElement>('#panel-paused'),
  over: $<HTMLDivElement>('#panel-over'),
};
const scoreEl = $<HTMLElement>('#score');
const livesEl = $<HTMLElement>('#lives');
const waveEl = $<HTMLElement>('#wave');
const finalScoreEl = $<HTMLElement>('#final-score');
const finalSubEl = $<HTMLElement>('#final-sub');
const startBtn = $<HTMLButtonElement>('#start-button');
const restartBtn = $<HTMLButtonElement>('#restart-button');
const resumeBtn = $<HTMLButtonElement>('#resume-button');
const muteBtn = $<HTMLButtonElement>('#mute-button');
const muteIcon = $<HTMLElement>('#mute-icon');
const muteText = $<HTMLElement>('#mute-text');
const boardEl = $<HTMLOListElement>('#leaderboard');
const boardFoot = $<HTMLElement>('#board-foot');
const refreshBtn = $<HTMLButtonElement>('#refresh-board');
const nameInput = $<HTMLInputElement>('#player-name');
const submitBtn = $<HTMLButtonElement>('#submit-score');
const submitForm = $<HTMLFormElement>('#submit-form');
const formMsg = $<HTMLElement>('#form-msg');
const toastEl = $<HTMLElement>('#toast');
const touchEl = $<HTMLElement>('#touch-controls');

const sound = new Sound();
const leaderboard = new LeaderboardClient({
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  key: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '',
});

const game = new Game({
  onShoot: () => sound.shoot(),
  onExplode: (big) => sound.explode(big),
  onHurt: () => sound.hurt(),
  onWave: (w) => {
    sound.wave();
    toast(`Wave ${w} — incoming`);
  },
  onGameOver: () => handleGameOver(),
});

const renderer = new Renderer(canvas);

/* ---------------- HUD ---------------- */

let lastScore = -1;
let lastLives = -1;
let lastWave = -1;

function bump(el: HTMLElement): void {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function syncHud(): void {
  if (game.score !== lastScore) {
    lastScore = game.score;
    scoreEl.textContent = String(game.score);
    bump(scoreEl);
  }
  if (game.lives !== lastLives) {
    lastLives = game.lives;
    livesEl.textContent = '♥'.repeat(Math.max(0, game.lives)) || '—';
    bump(livesEl);
  }
  if (game.wave !== lastWave) {
    lastWave = game.wave;
    waveEl.textContent = String(game.wave);
  }
}

let toastTimer = 0;
function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1600);
}

function showPanel(which: keyof typeof panels | null): void {
  for (const [key, el] of Object.entries(panels)) {
    el.classList.toggle('hidden', key !== which);
  }
  overlay.dataset.phase = which === null ? 'playing' : which;
}

/* ---------------- Leaderboard UI ---------------- */

let highlightId: string | null = null;

function renderBoardState(text: string, isError = false): void {
  boardEl.innerHTML = '';
  const li = document.createElement('li');
  li.className = `lb-state${isError ? ' error' : ''}`;
  li.textContent = text;
  boardEl.appendChild(li);
}

function renderBoard(rows: LeaderboardEntry[]): void {
  if (!rows.length) {
    renderBoardState('No scores yet — be the first pilot on the board.');
    return;
  }
  boardEl.innerHTML = '';
  for (const row of rows) {
    const li = document.createElement('li');
    li.className = 'lb-row' + (row.id === highlightId ? ' mine' : '');
    const name = document.createElement('span');
    name.className = 'lb-name';
    name.textContent = row.name;
    const score = document.createElement('span');
    score.className = 'lb-score';
    score.textContent = row.score.toLocaleString('en-US');
    li.append(name, score);
    boardEl.appendChild(li);
  }
}

let boardLoading = false;
async function loadBoard(): Promise<void> {
  if (boardLoading) return;
  boardLoading = true;
  if (!boardEl.querySelector('.lb-row')) renderBoardState('Loading leaderboard…');
  try {
    const rows = await leaderboard.top(10);
    renderBoard(rows);
    boardFoot.textContent = `Top ${rows.length} · stored in Supabase`;
  } catch (err) {
    const e = err as LeaderboardError;
    renderBoardState(
      e.kind === 'config'
        ? 'Leaderboard offline (not configured). The game still plays.'
        : `Could not load leaderboard: ${e.message} The game still plays.`,
      true,
    );
    boardFoot.textContent = 'Retry with the ⟳ button.';
  } finally {
    boardLoading = false;
  }
}

/* ---------------- Game over + submit ---------------- */

let submittedThisRun = false;

function handleGameOver(): void {
  sound.gameOver();
  submittedThisRun = false;
  syncHud();
  finalScoreEl.textContent = game.score.toLocaleString('en-US');
  finalSubEl.textContent = `Wave ${game.wave} · ${game.kills} kills`;
  formMsg.textContent = '';
  formMsg.className = 'form-msg';
  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit Score';
  nameInput.removeAttribute('aria-invalid');
  showPanel('over');
  try {
    const saved = localStorage.getItem('nb:name');
    if (saved && !nameInput.value) nameInput.value = saved;
  } catch {
    /* ignore */
  }
  window.setTimeout(() => nameInput.focus(), 60);
}

submitForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  void submitScore();
});

async function submitScore(): Promise<void> {
  if (submittedThisRun) {
    formMsg.textContent = 'Score already submitted for this run.';
    formMsg.className = 'form-msg';
    return;
  }
  const check = validateName(nameInput.value);
  if (!check.ok) {
    nameInput.setAttribute('aria-invalid', 'true');
    formMsg.textContent = check.error;
    formMsg.className = 'form-msg error';
    nameInput.focus();
    return;
  }
  nameInput.removeAttribute('aria-invalid');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';
  formMsg.textContent = 'Uploading score…';
  formMsg.className = 'form-msg';
  try {
    const row = await leaderboard.submit(check.name, game.score);
    submittedThisRun = true;
    highlightId = row.id;
    try {
      localStorage.setItem('nb:name', check.name);
    } catch {
      /* ignore */
    }
    formMsg.textContent = `Saved! ${row.name} · ${row.score.toLocaleString('en-US')}`;
    formMsg.className = 'form-msg ok';
    submitBtn.textContent = 'Submitted';
    await loadBoard();
  } catch (err) {
    const e = err as LeaderboardError;
    formMsg.textContent = e.message;
    formMsg.className = 'form-msg error';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Retry Submit';
  }
}

/* ---------------- Controls ---------------- */

function startRun(): void {
  sound.unlock();
  sound.ui();
  game.start();
  syncHud();
  showPanel(null);
  toast('Wave 1 — incoming');
}

startBtn.addEventListener('click', startRun);
restartBtn.addEventListener('click', startRun);
resumeBtn.addEventListener('click', () => {
  sound.unlock();
  game.resume();
  showPanel(null);
});

function applyMute(): void {
  muteBtn.setAttribute('aria-pressed', sound.muted ? 'true' : 'false');
  muteBtn.setAttribute('aria-label', sound.muted ? 'Unmute sound' : 'Mute sound');
  muteIcon.textContent = sound.muted ? '🔇' : '🔊';
  muteText.textContent = sound.muted ? 'Sound Off' : 'Sound On';
}
applyMute();

muteBtn.addEventListener('click', () => {
  sound.unlock();
  sound.setMuted(!sound.muted);
  applyMute();
  if (!sound.muted) sound.ui();
});

refreshBtn.addEventListener('click', () => void loadBoard());

const KEYMAP: Record<string, keyof typeof game.input> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'fire',
};

window.addEventListener(
  'keydown',
  (ev) => {
    const target = ev.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const action = KEYMAP[ev.code];
    if (action) {
      game.input[action] = true;
      ev.preventDefault();
      sound.unlock();
      if (game.phase === 'menu' && ev.code === 'Space') startRun();
      return;
    }
    if (ev.code === 'KeyP' || ev.code === 'Escape') {
      if (game.phase === 'playing') {
        game.pause();
        showPanel('paused');
      } else if (game.phase === 'paused') {
        game.resume();
        showPanel(null);
      }
    }
    if (ev.code === 'KeyM') {
      sound.unlock();
      sound.setMuted(!sound.muted);
      applyMute();
    }
    if (ev.code === 'Enter' && (game.phase === 'menu' || game.phase === 'gameover')) {
      if (game.phase === 'menu') startRun();
    }
  },
  { passive: false },
);

window.addEventListener('keyup', (ev) => {
  const action = KEYMAP[ev.code];
  if (action) {
    game.input[action] = false;
    ev.preventDefault();
  }
});

window.addEventListener('blur', () => {
  game.input = { up: false, down: false, left: false, right: false, fire: false };
  if (game.phase === 'playing') {
    game.pause();
    showPanel('paused');
  }
});

// Touch controls
const TOUCH_MAP: Record<string, keyof typeof game.input> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  fire: 'fire',
};

for (const btn of Array.from(touchEl.querySelectorAll<HTMLButtonElement>('.tbtn'))) {
  const action = TOUCH_MAP[btn.dataset.dir ?? ''];
  if (!action) continue;
  const set = (on: boolean) => (ev: Event) => {
    ev.preventDefault();
    sound.unlock();
    game.input[action] = on;
    btn.classList.toggle('active', on);
    if (on && game.phase === 'menu' && action === 'fire') startRun();
  };
  btn.addEventListener('pointerdown', set(true));
  btn.addEventListener('pointerup', set(false));
  btn.addEventListener('pointercancel', set(false));
  btn.addEventListener('pointerleave', set(false));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Drag on canvas to steer + auto-fire (mobile friendly)
let dragPointer: number | null = null;
canvas.addEventListener('pointerdown', (ev) => {
  sound.unlock();
  if (game.phase !== 'playing') return;
  dragPointer = ev.pointerId;
  canvas.setPointerCapture(ev.pointerId);
  steer(ev);
  game.input.fire = true;
});
canvas.addEventListener('pointermove', (ev) => {
  if (dragPointer === ev.pointerId) steer(ev);
});
const endDrag = (ev: PointerEvent) => {
  if (dragPointer === ev.pointerId) {
    dragPointer = null;
    game.input.fire = false;
  }
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function steer(ev: PointerEvent): void {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / 480, rect.height / 720);
  const ox = (rect.width - 480 * scale) / 2;
  const oy = (rect.height - 720 * scale) / 2;
  const x = (ev.clientX - rect.left - ox) / scale;
  const y = (ev.clientY - rect.top - oy) / scale;
  game.player.x = Math.max(17, Math.min(463, x));
  game.player.y = Math.max(252, Math.min(695, y));
}

/* ---------------- Loop ---------------- */

let last = performance.now();
function frame(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  game.update(dt);
  renderer.draw(game, now / 1000);
  syncHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const ro = new ResizeObserver(() => renderer.resize());
ro.observe(canvas);
window.addEventListener('resize', () => renderer.resize());

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'playing') {
    game.pause();
    showPanel('paused');
  }
});

/* ---------------- Test adapter ---------------- */

declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => ReturnType<Game['snapshot']>;
      endGameForTest: (score: number) => void;
    };
  }
}

window.__NEON_BARRAGE__ = {
  getState: () => game.snapshot(),
  endGameForTest: (score: number) => {
    const safe = Math.max(0, Math.floor(Number(score) || 0));
    if (game.phase === 'menu') game.start();
    // Drives the exact same game-over path (and therefore the same submit UI)
    // that normal gameplay uses; no direct Supabase access here.
    game.endGame(safe);
  },
};

showPanel('menu');
syncHud();
void loadBoard();
