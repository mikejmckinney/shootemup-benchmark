// Wiring: canvas sizing, input, HUD, overlay, leaderboard and the test adapter.

import { createGame, PHASE, WORLD } from './game.js';
import { render } from './render.js';
import { createAudio } from './audio.js';
import { createLeaderboard, validateName } from './leaderboard.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEADERBOARD_SIZE } from './config.js';

const $ = (id) => document.getElementById(id);

const canvas = /** @type {HTMLCanvasElement} */ ($('game-canvas'));
const ctx = canvas.getContext('2d');
const overlay = $('overlay');
/** @type {Record<string, any>} */
const els = {
  score: $('score'),
  lives: $('lives'),
  wave: $('wave'),
  eyebrow: $('overlay-eyebrow'),
  title: $('overlay-title'),
  text: $('overlay-text'),
  startButton: $('start-button'),
  finalWrap: $('final-score-wrap'),
  finalScore: $('final-score'),
  form: $('submit-form'),
  nameInput: $('player-name'),
  submitButton: $('submit-score'),
  submitStatus: $('submit-status'),
  board: $('leaderboard'),
  boardStatus: $('board-status'),
  refresh: $('refresh-board'),
  mute: $('mute-button'),
  muteGlyph: $('mute-glyph'),
  muteLabel: $('mute-label'),
  touch: $('touch-controls'),
  stage: $('stage'),
};

const audio = createAudio();
const board = createLeaderboard({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  limit: LEADERBOARD_SIZE,
});

let paused = false;
let submittedForThisRun = false;
let lastSubmission = null;

const game = createGame({
  onEvent(event) {
    audio.play(event.type);
    if (event.type === 'playerHit') bump(els.lives, 'is-hurt');
    if (event.type === 'gameover') showGameOver();
    if (event.type === 'wave') bump(els.wave);
  },
});

/* ---------------- canvas sizing ---------------- */

let scale = 1;
function resize() {
  const rect = els.stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  scale = Math.min(canvas.width / WORLD.width, canvas.height / WORLD.height);
}
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(els.stage);
resize();

/* ---------------- HUD ---------------- */

function bump(el, extraClass) {
  el.classList.remove('is-bump');
  void el.offsetWidth;
  el.classList.add('is-bump');
  if (extraClass) {
    el.classList.add(extraClass);
    setTimeout(() => el.classList.remove(extraClass), 700);
  }
}

let shownScore = -1;
let shownLives = -1;
let shownWave = -1;
function syncHud() {
  const s = game.state;
  if (s.score !== shownScore) {
    if (s.score > shownScore && shownScore >= 0) bump(els.score);
    shownScore = s.score;
    els.score.textContent = String(s.score);
  }
  if (s.lives !== shownLives) {
    shownLives = s.lives;
    els.lives.textContent = String(Math.max(0, s.lives));
  }
  if (s.wave !== shownWave) {
    shownWave = s.wave;
    els.wave.textContent = String(s.wave);
  }
}

/* ---------------- overlay states ---------------- */

function showOverlay({ state, eyebrow, title, text, startLabel, showForm, finalScore = undefined }) {
  overlay.hidden = false;
  overlay.dataset.state = state;
  els.eyebrow.textContent = eyebrow;
  els.title.textContent = title;
  els.text.innerHTML = text;
  els.startButton.textContent = startLabel;
  els.startButton.hidden = false;
  els.form.hidden = !showForm;
  els.finalWrap.hidden = finalScore === undefined;
  if (finalScore !== undefined) els.finalScore.textContent = String(finalScore);
}

function showReady() {
  showOverlay({
    state: 'ready',
    eyebrow: 'Ready',
    title: 'Neon Barrage',
    text: 'Move with <kbd>WASD</kbd> / <kbd>arrows</kbd>, fire with <kbd>Space</kbd>. Chain kills for combo multipliers.',
    startLabel: 'Start game',
    showForm: false,
  });
}

function showGameOver() {
  const score = game.state.score;
  showOverlay({
    state: 'gameover',
    eyebrow: 'Run complete',
    title: 'Game over',
    text: `You reached wave <strong>${game.state.wave}</strong> with a best combo of <strong>${game.state.bestCombo}</strong>.`,
    startLabel: 'Play again',
    showForm: true,
    finalScore: score,
  });
  submittedForThisRun = false;
  els.submitButton.disabled = false;
  els.nameInput.disabled = false;
  setStatus('', null);
  els.nameInput.value = els.nameInput.value || localStorage.getItem('nb:name') || '';
  els.nameInput.focus({ preventScroll: true });
}

function hideOverlay() {
  overlay.hidden = true;
}

function setStatus(message, tone) {
  els.submitStatus.textContent = message;
  if (tone) els.submitStatus.dataset.tone = tone;
  else delete els.submitStatus.dataset.tone;
}

/* ---------------- leaderboard UI ---------------- */

function renderBoardMessage(message, isError = false) {
  els.board.innerHTML = '';
  const li = document.createElement('li');
  li.className = `board__state${isError ? ' board__state--error' : ''}`;
  li.textContent = message;
  els.board.appendChild(li);
}

function renderBoard(rows, highlight) {
  if (!rows.length) {
    renderBoardMessage('No scores yet — be the first pilot on the board.');
    return;
  }
  els.board.innerHTML = '';
  rows.forEach((row, index) => {
    const li = document.createElement('li');
    li.className = 'board__row';
    if (highlight && row.name === highlight.name && row.score === highlight.score) {
      li.classList.add('is-new');
    }
    const rank = document.createElement('span');
    rank.className = 'board__rank';
    rank.textContent = `${index + 1}`;
    const name = document.createElement('span');
    name.className = 'board__name';
    name.textContent = row.name;
    const score = document.createElement('span');
    score.className = 'board__score';
    score.textContent = Number(row.score).toLocaleString('en-US');
    li.append(rank, name, score);
    els.board.appendChild(li);
  });
}

let loading = false;
async function loadBoard(highlight) {
  if (loading) return;
  loading = true;
  els.refresh.disabled = true;
  els.boardStatus.textContent = 'Syncing…';
  delete els.boardStatus.dataset.tone;
  try {
    const rows = await board.top(LEADERBOARD_SIZE);
    renderBoard(rows, highlight);
    els.boardStatus.textContent = `Top ${Math.min(rows.length, LEADERBOARD_SIZE)} · updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    renderBoardMessage("Couldn't load the leaderboard. The game still works — retry below.", true);
    els.boardStatus.textContent = error.message;
    els.boardStatus.dataset.tone = 'error';
  } finally {
    loading = false;
    els.refresh.disabled = false;
  }
}

els.refresh.addEventListener('click', () => loadBoard(lastSubmission));

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submittedForThisRun) {
    setStatus('This run has already been submitted.', 'error');
    return;
  }
  const check = validateName(els.nameInput.value);
  if (!check.ok) {
    els.nameInput.setAttribute('aria-invalid', 'true');
    setStatus(check.error, 'error');
    els.nameInput.focus();
    return;
  }
  els.nameInput.removeAttribute('aria-invalid');
  els.submitButton.disabled = true;
  setStatus('Submitting…', null);
  try {
    const saved = await board.submit(check.value, game.state.score);
    submittedForThisRun = true;
    els.nameInput.disabled = true;
    lastSubmission = { name: check.value, score: game.state.score };
    localStorage.setItem('nb:name', check.value);
    setStatus(`Saved! ${saved?.name ?? check.value} — ${game.state.score}`, 'success');
    await loadBoard(lastSubmission);
  } catch (error) {
    els.submitButton.disabled = false;
    setStatus(`${error.message} Try again.`, 'error');
  }
});

els.nameInput.addEventListener('input', () => {
  els.nameInput.removeAttribute('aria-invalid');
  if (els.submitStatus.dataset.tone === 'error') setStatus('', null);
});

/* ---------------- controls ---------------- */

const KEY_MAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ' ': 'fire', Spacebar: 'fire',
};

function isTyping(target) {
  return target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(target.tagName);
}

window.addEventListener('keydown', (event) => {
  if (isTyping(event.target)) return;
  const action = KEY_MAP[event.key];
  if (action) {
    event.preventDefault();
    audio.unlock();
    game.setInput(action, true);
    return;
  }
  if (event.key === 'm' || event.key === 'M') { toggleMute(); return; }
  if (event.key === 'p' || event.key === 'P') { togglePause(); return; }
  if (event.key === 'Enter' && game.state.phase !== PHASE.PLAYING) startRun();
});

window.addEventListener('keyup', (event) => {
  const action = KEY_MAP[event.key];
  if (action) game.setInput(action, false);
});

window.addEventListener('blur', () => {
  for (const action of ['left', 'right', 'up', 'down', 'fire']) game.setInput(action, false);
});

for (const button of /** @type {NodeListOf<HTMLElement>} */ (els.touch.querySelectorAll('[data-dir]'))) {
  const action = button.dataset.dir;
  const press = (event) => {
    event.preventDefault();
    audio.unlock();
    button.classList.add('is-active');
    game.setInput(action, true);
    if (game.state.phase !== PHASE.PLAYING && action === 'fire') startRun();
  };
  const release = (event) => {
    event.preventDefault();
    button.classList.remove('is-active');
    game.setInput(action, false);
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Drag anywhere on the canvas to steer on touch devices.
let dragPointer = null;
canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') return;
  dragPointer = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  steer(event);
});
canvas.addEventListener('pointermove', (event) => {
  if (event.pointerId === dragPointer) steer(event);
});
canvas.addEventListener('pointerup', () => { dragPointer = null; });

function steer(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WORLD.width;
  const y = ((event.clientY - rect.top) / rect.height) * WORLD.height;
  game.state.player.x = Math.min(WORLD.width - 15, Math.max(15, x));
  game.state.player.y = Math.min(WORLD.height - 13, Math.max(WORLD.height * 0.35, y));
}

function toggleMute() {
  audio.setMuted(!audio.muted);
  els.mute.setAttribute('aria-pressed', String(audio.muted));
  els.mute.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  els.muteGlyph.textContent = audio.muted ? '🔇' : '♪';
  els.muteLabel.textContent = audio.muted ? 'Sound off' : 'Sound on';
  localStorage.setItem('nb:muted', String(audio.muted));
}
els.mute.addEventListener('click', () => { audio.unlock(); toggleMute(); });
if (localStorage.getItem('nb:muted') === 'true') toggleMute();

function togglePause() {
  if (game.state.phase !== PHASE.PLAYING) return;
  paused = !paused;
  if (paused) {
    showOverlay({
      state: 'paused',
      eyebrow: 'Paused',
      title: 'Stand by',
      text: 'Press <kbd>P</kbd> or resume to jump back in.',
      startLabel: 'Resume',
      showForm: false,
    });
  } else {
    hideOverlay();
  }
}

function startRun() {
  if (paused && game.state.phase === PHASE.PLAYING) {
    paused = false;
    hideOverlay();
    return;
  }
  audio.unlock();
  submittedForThisRun = false;
  game.start();
  shownScore = -1; shownLives = -1; shownWave = -1;
  syncHud();
  hideOverlay();
}
els.startButton.addEventListener('click', startRun);

/* ---------------- loop ---------------- */

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!paused) game.update(dt);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate((canvas.width - WORLD.width * scale) / 2, (canvas.height - WORLD.height * scale) / 2);
  ctx.scale(scale, scale);
  render(ctx, game.state, now);

  syncHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

showReady();
loadBoard();

/* ---------------- test adapter ---------------- */

/** @type {any} */ (window).__NEON_BARRAGE__ = {
  getState: () => game.snapshot(),
  endGameForTest: (score) => {
    const value = Math.max(0, Math.floor(Number(score) || 0));
    paused = false;
    if (game.state.phase !== PHASE.PLAYING) game.start();
    game.endGame(value); // same code path as losing your last life -> showGameOver()
    return game.snapshot();
  },
};
