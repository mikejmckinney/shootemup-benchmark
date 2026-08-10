import { Game, WORLD, validateName, type Input } from './game';
import { draw } from './render';
import { Sfx } from './audio';
import { fetchTop, submitScore, type ScoreRow } from './leaderboard';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('game-canvas');
const ctx = canvas.getContext('2d')!;
const scoreEl = $('score');
const livesEl = $('lives');
const waveEl = $('wave');
const overlayIdle = $('overlay-idle');
const overlayOver = $('overlay-over');
const overlayPause = $('overlay-pause');
const startBtn = $<HTMLButtonElement>('start-button');
const restartBtn = $<HTMLButtonElement>('restart-button');
const muteBtn = $<HTMLButtonElement>('mute-button');
const muteIcon = $('mute-icon');
const muteLabel = $('mute-label');
const nameInput = $<HTMLInputElement>('player-name');
const submitBtn = $<HTMLButtonElement>('submit-score');
const submitForm = $<HTMLFormElement>('submit-form');
const submitMsg = $('submit-msg');
const finalScore = $('final-score');
const boardEl = $<HTMLOListElement>('leaderboard');
const boardStatus = $('board-status');
const refreshBtn = $<HTMLButtonElement>('refresh-board');
const touchControls = $('touch-controls');

const game = new Game();
const sfx = new Sfx();
const input: Input = { left: false, right: false, up: false, down: false, fire: false };

let paused = false;
let submittedFor = -1;
let lastName = '';

/* ---------------------------------------------------------------- canvas */
function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WORLD.w * dpr;
  canvas.height = WORLD.h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

/* ------------------------------------------------------------------- HUD */
function bump(el: HTMLElement): void {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}
let shownScore = -1;
let shownLives = -1;
let shownWave = -1;
function syncHud(): void {
  if (game.score !== shownScore) {
    shownScore = game.score;
    scoreEl.textContent = String(game.score);
    bump(scoreEl);
  }
  if (game.lives !== shownLives) {
    shownLives = game.lives;
    livesEl.textContent = String(game.lives);
    bump(livesEl);
  }
  if (game.wave !== shownWave) {
    shownWave = game.wave;
    waveEl.textContent = String(game.wave);
    bump(waveEl);
  }
}

/* ------------------------------------------------------------ game flow */
function showOverlay(which: 'idle' | 'over' | 'pause' | 'none'): void {
  overlayIdle.classList.toggle('hidden', which !== 'idle');
  overlayOver.classList.toggle('hidden', which !== 'over');
  overlayPause.classList.toggle('hidden', which !== 'pause');
}

function startGame(): void {
  sfx.unlock();
  paused = false;
  submittedFor = -1;
  game.start();
  syncHud();
  showOverlay('none');
  canvas.focus();
}

function onGameOver(): void {
  finalScore.textContent = String(game.score);
  submitMsg.textContent = '';
  submitMsg.className = 'form-msg';
  submitBtn.disabled = false;
  nameInput.disabled = false;
  nameInput.value = lastName || localStorage.getItem('nb.name') || '';
  showOverlay('over');
  sfx.gameover();
  setTimeout(() => nameInput.focus(), 60);
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

/* --------------------------------------------------------------- audio */
function applyMute(m: boolean): void {
  sfx.setMuted(m);
  muteBtn.setAttribute('aria-pressed', String(m));
  muteBtn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
  muteIcon.textContent = m ? '🔇' : '🔊';
  muteLabel.textContent = m ? 'Muted' : 'Sound on';
  localStorage.setItem('nb.muted', m ? '1' : '0');
}
applyMute(localStorage.getItem('nb.muted') === '1');
muteBtn.addEventListener('click', () => {
  sfx.unlock();
  applyMute(!sfx.muted);
});

/* ------------------------------------------------------------- keyboard */
const keyMap: Record<string, keyof Input> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'fire',
};

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = keyMap[e.code];
  if (k) {
    input[k] = true;
    e.preventDefault();
    sfx.unlock();
    if (game.phase === 'idle' && e.code === 'Space') startGame();
    return;
  }
  if (e.code === 'KeyM') {
    sfx.unlock();
    applyMute(!sfx.muted);
  }
  if (e.code === 'KeyP' && game.phase === 'playing') {
    paused = !paused;
    showOverlay(paused ? 'pause' : 'none');
  }
  if (e.code === 'Enter' && game.phase === 'idle') startGame();
});
window.addEventListener('keyup', (e) => {
  const k = keyMap[e.code];
  if (k) {
    input[k] = false;
    e.preventDefault();
  }
});
window.addEventListener('blur', () => {
  input.left = input.right = input.up = input.down = input.fire = false;
});

/* ---------------------------------------------------------------- touch */
for (const btn of Array.from(touchControls.querySelectorAll<HTMLButtonElement>('.tbtn'))) {
  const dir = btn.dataset.dir as keyof Input;
  const set = (v: boolean) => (e: Event) => {
    e.preventDefault();
    input[dir] = v;
    btn.classList.toggle('active', v);
    if (v) sfx.unlock();
  };
  btn.addEventListener('pointerdown', set(true));
  btn.addEventListener('pointerup', set(false));
  btn.addEventListener('pointercancel', set(false));
  btn.addEventListener('pointerleave', set(false));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// drag-to-fly directly on the canvas (touch/pen), with autofire
let dragging = false;
canvas.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (e.pointerType === 'mouse') return;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  movePlayerTo(e);
  input.fire = true;
});
canvas.addEventListener('pointermove', (e) => {
  if (dragging) movePlayerTo(e);
});
const endDrag = () => {
  if (!dragging) return;
  dragging = false;
  input.fire = false;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function movePlayerTo(e: PointerEvent): void {
  if (game.phase !== 'playing') return;
  const r = canvas.getBoundingClientRect();
  game.player.x = Math.max(0, Math.min(WORLD.w, ((e.clientX - r.left) / r.width) * WORLD.w));
  game.player.y = Math.max(
    WORLD.h * 0.35,
    Math.min(WORLD.h - 20, ((e.clientY - r.top) / r.height) * WORLD.h - 28),
  );
}

/* ---------------------------------------------------------- leaderboard */
function renderBoard(rows: ScoreRow[], highlight?: string): void {
  boardEl.innerHTML = '';
  if (rows.length === 0) {
    boardStatus.textContent = 'No scores yet — be the first pilot on the board.';
    boardStatus.className = 'board-status';
    return;
  }
  boardStatus.className = 'board-status hidden';
  rows.forEach((row, i) => {
    const li = document.createElement('li');
    if (highlight && row.name === highlight && i < 10) li.className = 'mine';
    li.style.animationDelay = `${i * 25}ms`;
    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = `${i + 1}`;
    const name = document.createElement('span');
    name.className = 'pname';
    name.textContent = row.name;
    const pts = document.createElement('span');
    pts.className = 'pts';
    pts.textContent = row.score.toLocaleString();
    li.append(rank, name, pts);
    boardEl.append(li);
  });
}

async function loadBoard(highlight?: string): Promise<void> {
  boardStatus.className = 'board-status';
  if (boardEl.children.length === 0) boardStatus.textContent = 'Loading leaderboard…';
  refreshBtn.disabled = true;
  try {
    const rows = await fetchTop(10);
    renderBoard(rows, highlight);
  } catch (err) {
    boardStatus.className = 'board-status error';
    boardStatus.textContent =
      (err as Error).message + ' — the game still plays offline. Try refresh.';
  } finally {
    refreshBtn.disabled = false;
  }
}
refreshBtn.addEventListener('click', () => void loadBoard());
void loadBoard();

nameInput.addEventListener('input', () => {
  submitMsg.textContent = '';
  submitMsg.className = 'form-msg';
  nameInput.removeAttribute('aria-invalid');
});

submitForm.addEventListener('submit', (e) => {
  e.preventDefault();
  void doSubmit();
});

async function doSubmit(): Promise<void> {
  if (game.phase !== 'gameover') return;
  const v = validateName(nameInput.value);
  if (!v.ok) {
    nameInput.setAttribute('aria-invalid', 'true');
    submitMsg.className = 'form-msg error';
    submitMsg.textContent = v.error;
    nameInput.focus();
    return;
  }
  if (submittedFor === game.score && lastName === v.name) {
    submitMsg.className = 'form-msg';
    submitMsg.textContent = 'Already submitted for this run.';
    return;
  }
  submitBtn.disabled = true;
  submitMsg.className = 'form-msg';
  submitMsg.textContent = 'Uploading score…';
  try {
    await submitScore(v.name, game.score);
    lastName = v.name;
    submittedFor = game.score;
    localStorage.setItem('nb.name', v.name);
    submitMsg.className = 'form-msg ok';
    submitMsg.textContent = `Saved — ${v.name} · ${game.score.toLocaleString()}`;
    nameInput.disabled = true;
    await loadBoard(v.name);
  } catch (err) {
    submitMsg.className = 'form-msg error';
    submitMsg.textContent = (err as Error).message + ' Retry when you are back online.';
  } finally {
    submitBtn.disabled = nameInput.disabled;
  }
}

/* ------------------------------------------------------------- loop */
let last = performance.now();
let clock = 0;
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  clock += dt;

  const wasOver = game.phase === 'gameover';
  if (!paused) game.update(dt, input);

  for (const ev of game.drainEvents()) {
    if (ev.type === 'shoot') sfx.shoot();
    else if (ev.type === 'hit') sfx.hit();
    else if (ev.type === 'explosion') sfx.explosion();
    else if (ev.type === 'playerHit') sfx.playerHit();
    else if (ev.type === 'wave') sfx.wave();
  }
  if (!wasOver && game.phase === 'gameover') onGameOver();

  syncHud();
  draw(ctx, game, clock);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* --------------------------------------------------------- test adapter */
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
    const n = Number(score);
    const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    if (game.phase === 'idle') game.start();
    paused = false;
    game.endGame(safe);
    game.drainEvents();
    syncHud();
    onGameOver();
  },
};
