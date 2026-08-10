import './style.css';
import { Game, WIDTH, HEIGHT } from './game';
import { AudioEngine } from './audio';
import { fetchTopScores, submitScore, type LeaderboardEntry } from './supabaseClient';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const scoreEl = document.getElementById('score') as HTMLElement;
const livesEl = document.getElementById('lives') as HTMLElement;
const muteBtn = document.getElementById('mute-button') as HTMLButtonElement;
const startBtn = document.getElementById('start-button') as HTMLButtonElement;
const startOverlay = document.getElementById('start-overlay') as HTMLElement;
const gameoverOverlay = document.getElementById('gameover-overlay') as HTMLElement;
const finalScoreEl = document.getElementById('final-score') as HTMLElement;
const scoreForm = document.getElementById('score-form') as HTMLFormElement;
const nameInput = document.getElementById('player-name') as HTMLInputElement;
const submitBtn = document.getElementById('submit-score') as HTMLButtonElement;
const submitStatus = document.getElementById('submit-status') as HTMLElement;
const restartBtn = document.getElementById('restart-button') as HTMLButtonElement;
const leaderboardEl = document.getElementById('leaderboard') as HTMLElement;
const leaderboardEl2 = document.getElementById('leaderboard-2') as HTMLElement;

const stickZone = document.getElementById('stick-zone') as HTMLElement;
const stickNub = document.getElementById('stick-nub') as HTMLElement;
const fireBtn = document.getElementById('fire-btn') as HTMLButtonElement;

const audio = new AudioEngine();
let lastScoreForSubmit = 0;

const game = new Game(canvas, audio, {
  onScoreChange: (score) => {
    scoreEl.textContent = String(score);
  },
  onLivesChange: (lives) => {
    livesEl.textContent = String(Math.max(0, lives));
  },
  onGameOver: (score) => {
    lastScoreForSubmit = score;
    finalScoreEl.textContent = String(score);
    gameoverOverlay.classList.remove('hidden');
    submitStatus.textContent = '';
    submitStatus.className = 'submit-status';
    nameInput.value = '';
    nameInput.focus();
    void renderLeaderboard(leaderboardEl2);
  },
});

function startUserGesture() {
  audio.ensureStarted();
}

startBtn.addEventListener('click', () => {
  startUserGesture();
  startOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  game.start();
});

restartBtn.addEventListener('click', () => {
  startUserGesture();
  gameoverOverlay.classList.add('hidden');
  game.start();
});

muteBtn.addEventListener('click', () => {
  startUserGesture();
  const muted = audio.toggleMuted();
  muteBtn.setAttribute('aria-pressed', String(muted));
});

// --- Score submission ---
scoreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (name.length < 1 || name.length > 16) {
    submitStatus.textContent = 'Name must be 1-16 characters.';
    submitStatus.className = 'submit-status error';
    return;
  }
  submitBtn.disabled = true;
  submitStatus.textContent = 'Submitting…';
  submitStatus.className = 'submit-status';
  try {
    await submitScore(name, lastScoreForSubmit);
    submitStatus.textContent = 'Score submitted!';
    submitStatus.className = 'submit-status ok';
    await renderLeaderboard(leaderboardEl2);
    await renderLeaderboard(leaderboardEl);
  } catch (err) {
    console.error(err);
    submitStatus.textContent = 'Network error — could not submit score. Try again.';
    submitStatus.className = 'submit-status error';
  } finally {
    submitBtn.disabled = false;
  }
});

// --- Leaderboard rendering ---
async function renderLeaderboard(target: HTMLElement) {
  target.innerHTML = '<p class="lb-loading">Loading leaderboard…</p>';
  try {
    const rows: LeaderboardEntry[] = await fetchTopScores(10);
    if (rows.length === 0) {
      target.innerHTML = '<p class="lb-empty">No scores yet. Be the first!</p>';
      return;
    }
    const list = document.createElement('ol');
    rows.forEach((row, idx) => {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.textContent = `#${idx + 1}`;
      const name = document.createElement('span');
      name.className = 'lb-name';
      name.textContent = row.player_name;
      const score = document.createElement('span');
      score.className = 'lb-score';
      score.textContent = String(row.score);
      li.append(rank, name, score);
      list.appendChild(li);
    });
    target.innerHTML = '';
    target.appendChild(list);
  } catch (err) {
    console.error(err);
    target.innerHTML = '<p class="lb-error">Could not load leaderboard (network error).</p>';
  }
}

void renderLeaderboard(leaderboardEl);

// --- Keyboard: start audio on first interaction, prevent page scroll on space/arrows ---
window.addEventListener(
  'keydown',
  (e) => {
    startUserGesture();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  },
  { passive: false }
);

// --- Touch controls ---
let stickActive = false;
let stickCenter = { x: 0, y: 0 };
const STICK_RADIUS = 50;

function handleStickStart(clientX: number, clientY: number) {
  startUserGesture();
  stickActive = true;
  const rect = stickZone.getBoundingClientRect();
  stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  updateStick(clientX, clientY);
}

function updateStick(clientX: number, clientY: number) {
  const dx = clientX - stickCenter.x;
  const dy = clientY - stickCenter.y;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, STICK_RADIUS);
  const angle = Math.atan2(dy, dx);
  const nx = Math.cos(angle) * clamped;
  const ny = Math.sin(angle) * clamped;
  stickNub.style.transform = `translate(${nx}px, ${ny}px)`;
  const normX = dist > 0 ? (Math.cos(angle) * clamped) / STICK_RADIUS : 0;
  const normY = dist > 0 ? (Math.sin(angle) * clamped) / STICK_RADIUS : 0;
  game.setTouchDirection(normX, normY);
}

function handleStickEnd() {
  stickActive = false;
  stickNub.style.transform = 'translate(0, 0)';
  game.setTouchDirection(0, 0);
}

stickZone.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  handleStickStart(t.clientX, t.clientY);
}, { passive: false });
stickZone.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!stickActive) return;
  const t = e.touches[0];
  updateStick(t.clientX, t.clientY);
}, { passive: false });
stickZone.addEventListener('touchend', (e) => {
  e.preventDefault();
  handleStickEnd();
}, { passive: false });
stickZone.addEventListener('touchcancel', () => handleStickEnd());

fireBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startUserGesture();
  game.setTouchFiring(true);
}, { passive: false });
fireBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  game.setTouchFiring(false);
}, { passive: false });
fireBtn.addEventListener('touchcancel', () => game.setTouchFiring(false));

// Mouse fallback for the fire button (desktop testing / hybrid devices)
fireBtn.addEventListener('mousedown', () => {
  startUserGesture();
  game.setTouchFiring(true);
});
window.addEventListener('mouseup', () => game.setTouchFiring(false));

// --- Test adapter (deterministic black-box testing) ---
declare global {
  interface Window {
    __NEON_BARRAGE__?: {
      getState: () => ReturnType<Game['getPublicState']>;
      endGameForTest: (score: number) => void;
    };
  }
}

window.__NEON_BARRAGE__ = {
  getState: () => game.getPublicState(),
  endGameForTest: (score: number) => {
    startOverlay.classList.add('hidden');
    game.endGameForTest(score);
  },
};

export { WIDTH, HEIGHT };
