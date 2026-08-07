import { NeonAudio } from './audio.js';
import { createNeonBarrageAdapter } from './adapter.js';
import { NeonGame } from './game.js';
import { createLeaderboardClient, LeaderboardError, normalizeConfig, normalizeScore, validateName } from './leaderboard.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('[data-testid="game-canvas"]');
const startButton = $('[data-testid="start-button"]');
const startButtonLabel = $('#start-button-label');
const scoreElement = $('[data-testid="score"]');
const livesElement = $('[data-testid="lives"]');
const overlay = $('#game-overlay');
const overlayTitle = $('#overlay-title');
const overlayCopy = $('#overlay-copy');
const finalScore = $('#final-score');
const finalScoreValue = $('#final-score-value');
const scoreForm = $('#score-form');
const playerNameInput = $('[data-testid="player-name"]');
const formMessage = $('#form-message');
const submitButton = $('[data-testid="submit-score"]');
const leaderboardList = $('[data-testid="leaderboard"]');
const leaderboardStatus = $('#leaderboard-status');
const runtimeStatus = $('#runtime-status');
const levelValue = $('#level-value');
const muteButton = $('[data-testid="mute-button"]');
const touchControls = $('[data-testid="touch-controls"]');

const audio = new NeonAudio();
const runtimeConfig = normalizeConfig(globalThis.__NEON_BARRAGE_CONFIG__ || globalThis.NEON_BARRAGE_CONFIG || {});
const leaderboard = createLeaderboardClient(runtimeConfig);
let currentGameState = null;
let hasSubmittedCurrentScore = false;

function formatScore(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0))).padStart(6, '0');
}

function renderLives(lives) {
  const safeLives = Math.max(0, Math.min(3, Number(lives) || 0));
  livesElement.innerHTML = Array.from({ length: 3 }, (_, index) => `<span class="life-pip${index < safeLives ? '' : ' spent'}"></span>`).join('');
  livesElement.setAttribute('aria-label', `${safeLives} lives remaining`);
}

function renderState(publicState, rawState = null) {
  currentGameState = publicState;
  scoreElement.textContent = formatScore(publicState.score);
  renderLives(publicState.lives);
  if (rawState) levelValue.textContent = String(rawState.level || 1).padStart(2, '0');
  overlay.dataset.phase = publicState.phase;
  if (publicState.phase === 'running') {
    runtimeStatus.textContent = `THREAT ${String(rawState?.level || 1).padStart(2, '0')} // ENGAGED`;
    startButton.disabled = true;
    touchControls?.classList.add('is-active');
    return;
  }
  startButton.disabled = false;
  touchControls?.classList.remove('is-active');
  if (publicState.phase === 'game-over') {
    runtimeStatus.textContent = 'CORE OFFLINE // TRANSMIT SCORE';
    overlayTitle.textContent = 'Signal lost.';
    overlayCopy.textContent = 'The barrage broke through. Your run is archived — transmit the score if you have the nerve.';
    startButtonLabel.textContent = 'RESTART MISSION';
    finalScore.hidden = false;
    finalScoreValue.textContent = formatScore(publicState.score);
    scoreForm.hidden = false;
    if (!hasSubmittedCurrentScore) playerNameInput.focus({ preventScroll: true });
    return;
  }
  runtimeStatus.textContent = 'SYSTEMS NOMINAL';
}

function setLeaderboardState(state, message = '') {
  leaderboardStatus.dataset.state = state;
  leaderboardStatus.textContent = message;
  leaderboardStatus.hidden = state === 'ready' && leaderboardList.children.length > 0;
  leaderboardList.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function renderLeaderboard(records) {
  leaderboardList.innerHTML = '';
  if (!records.length) {
    setLeaderboardState('empty', 'NO SIGNALS YET — BE THE FIRST PILOT');
    return;
  }
  records.slice(0, 10).forEach((record, index) => {
    const item = document.createElement('li');
    item.className = 'leaderboard-row';
    item.innerHTML = `<span class="rank rank-${index + 1}">${String(index + 1).padStart(2, '0')}</span><span class="pilot-name">${escapeHtml(record.name)}</span><strong>${formatScore(record.score)}</strong>`;
    leaderboardList.appendChild(item);
  });
  setLeaderboardState('ready');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

async function loadLeaderboard() {
  setLeaderboardState('loading', 'TUNING INTO THE FEED…');
  if (!leaderboard.configured) {
    setLeaderboardState('empty', 'NO FEED CONFIGURED — LOCAL RUN READY');
    return;
  }
  try {
    renderLeaderboard(await leaderboard.list());
  } catch {
    setLeaderboardState('error', 'SIGNAL FEED UNAVAILABLE — RETRY LATER');
  }
}

function showFormMessage(message, kind = '') {
  formMessage.textContent = message;
  formMessage.dataset.kind = kind;
  playerNameInput.setAttribute('aria-invalid', kind === 'error' ? 'true' : 'false');
}

async function submitCurrentScore(event) {
  event.preventDefault();
  const checkedName = validateName(playerNameInput.value);
  if (!checkedName.valid) {
    showFormMessage(checkedName.error, 'error');
    playerNameInput.focus();
    return;
  }
  const score = normalizeScore(currentGameState?.score);
  if (score === null) {
    showFormMessage('That score cannot be transmitted.', 'error');
    return;
  }
  if (!leaderboard.configured) {
    showFormMessage('Leaderboard is offline in this build. Your run is still safe locally.', 'error');
    setLeaderboardState('error', 'SIGNAL FEED NOT CONFIGURED');
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = 'TRANSMITTING…';
  showFormMessage('Opening an uplink to the global feed…', 'loading');
  try {
    await leaderboard.submit(checkedName.name, score);
    hasSubmittedCurrentScore = true;
    showFormMessage('Score transmitted. Welcome to the feed.', 'success');
    submitButton.textContent = 'SCORE SAVED';
    renderLeaderboard(await leaderboard.list());
  } catch (error) {
    submitButton.disabled = false;
    submitButton.textContent = 'SAVE SCORE';
    if (error instanceof LeaderboardError && error.code === 'validation') showFormMessage(error.message, 'error');
    else {
      showFormMessage('Transmission failed. Check the signal and try again.', 'error');
      setLeaderboardState('error', 'SIGNAL FEED UNAVAILABLE — RETRY LATER');
    }
  }
}

const game = new NeonGame(canvas, {
  onStateChange: renderState,
  onEvent(event) {
    if (event.type === 'start') audio.play('start');
    if (event.type === 'fire') audio.play('fire');
    if (event.type === 'hit') audio.play('hit');
    if (event.type === 'destroy') audio.play('destroy');
    if (event.type === 'danger') audio.play('danger');
    if (event.type === 'gameover-sound') audio.play('gameover');
  },
  onGameOver: renderState
});

function launchGame() {
  audio.unlock();
  hasSubmittedCurrentScore = false;
  playerNameInput.value = '';
  submitButton.disabled = false;
  submitButton.textContent = 'SAVE SCORE';
  playerNameInput.setAttribute('aria-invalid', 'false');
  showFormMessage('');
  finalScore.hidden = true;
  scoreForm.hidden = true;
  overlayTitle.textContent = 'Enter the barrage';
  overlayCopy.textContent = 'Pilot the last interceptor through a storm of hostile signals. Stay sharp. Stay moving.';
  startButtonLabel.textContent = 'LAUNCH MISSION';
  game.start();
  canvas.focus({ preventScroll: true });
}

startButton.addEventListener('click', launchGame);
scoreForm.addEventListener('submit', submitCurrentScore);

muteButton.addEventListener('click', () => {
  const nextMuted = !audio.muted;
  audio.setMuted(nextMuted);
  muteButton.setAttribute('aria-pressed', String(nextMuted));
  muteButton.setAttribute('aria-label', nextMuted ? 'Unmute sound' : 'Mute sound');
  muteButton.querySelector('.mute-label').textContent = nextMuted ? 'SOUND OFF' : 'SOUND ON';
  muteButton.querySelector('.sound-icon').textContent = nextMuted ? '◖×××' : '◖)))';
});

const keyMap = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowDown: 'down',
  s: 'down',
  S: 'down',
  ' ': 'fire',
  Spacebar: 'fire'
};

function isInteractiveTarget(target) {
  return typeof target?.closest === 'function'
    && Boolean(target.closest('button, input, textarea, select, a, [contenteditable="true"]'));
}

window.addEventListener('keydown', (event) => {
  if (isInteractiveTarget(event.target)) return;
  const input = keyMap[event.key];
  if (!input) return;
  event.preventDefault();
  game.setInput(input, true);
  if (event.key === ' ' && !audio.unlocked) audio.unlock();
});
window.addEventListener('keyup', (event) => {
  if (isInteractiveTarget(event.target)) return;
  const input = keyMap[event.key];
  if (input) {
    event.preventDefault();
    game.setInput(input, false);
  }
});

window.addEventListener('blur', () => {
  Object.keys(keyMap).forEach((key) => {
    const input = keyMap[key];
    if (input) game.setInput(input, false);
  });
});

document.querySelectorAll('[data-input]').forEach((button) => {
  const input = button.dataset.input;
  const release = () => {
    button.classList.remove('pressed');
    game.setInput(input, false);
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    audio.unlock();
    button.setPointerCapture?.(event.pointerId);
    button.classList.add('pressed');
    game.setInput(input, true);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', (event) => {
    if (event.buttons === 0) release();
  });
});

window.__NEON_BARRAGE__ = createNeonBarrageAdapter(game);

renderState(game.getPublicState(), game.state);
void loadLeaderboard();
