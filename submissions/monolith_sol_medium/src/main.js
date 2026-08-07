import './style.css';
import { createGame, startGame, updateGame, stateView, endGame, WIDTH, HEIGHT } from './engine.js';

const $ = (s) => document.querySelector(s);
const canvas = $('[data-testid="game-canvas"]');
const ctx = canvas.getContext('2d');
const scoreEl = $('[data-testid="score"]');
const livesEl = $('[data-testid="lives"]');
const levelEl = $('#level');
const overlay = $('#overlay');
const titleEl = $('#overlay-title');
const kickerEl = $('#overlay-kicker');
const copyEl = $('#overlay-copy');
const startLabel = $('#start-label');
const startButton = $('[data-testid="start-button"]');
const muteButton = $('[data-testid="mute-button"]');
const nameInput = $('[data-testid="player-name"]');
const submitButton = $('[data-testid="submit-score"]');
const formStatus = $('#form-status');
const leaderboardEl = $('[data-testid="leaderboard"]');
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLIC_KEY;

let game = createGame();
let last = performance.now();
let audio = null;
let muted = false;
const input = { up: false, down: false, left: false, right: false, fire: false };
const stars = Array.from({ length: 95 }, (_, i) => ({ x: (i * 149) % WIDTH, y: (i * 83) % HEIGHT, z: 1 + (i % 3), a: .25 + (i % 5) * .11 }));

function ensureAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
}

function tone(freq, duration = .05, type = 'square', volume = .025, slide = 0) {
  if (muted || !audio) return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, audio.currentTime);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), audio.currentTime + duration);
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
  osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
}

function setGameOver() {
  overlay.classList.remove('hidden'); overlay.classList.add('game-over');
  kickerEl.textContent = 'TRANSMISSION ENDED';
  titleEl.innerHTML = `RUN <span>COMPLETE</span>`;
  copyEl.innerHTML = `Final score <strong>${game.score.toLocaleString()}</strong><br>Transmit your callsign to the global grid.`;
  startLabel.textContent = 'LAUNCH AGAIN';
  nameInput.disabled = false; submitButton.disabled = false;
  formStatus.textContent = 'Score ready. Enter a callsign to transmit.';
  tone(180, .45, 'sawtooth', .04, -120);
}

function launch() {
  ensureAudio(); startGame(game); overlay.classList.add('hidden'); overlay.classList.remove('game-over');
  nameInput.disabled = true; submitButton.disabled = true;
  formStatus.textContent = 'Complete a run to transmit your score.';
  tone(120, .22, 'sawtooth', .04, 420);
}

startButton.addEventListener('click', launch);
muteButton.addEventListener('click', () => {
  ensureAudio(); muted = !muted; muteButton.setAttribute('aria-pressed', String(muted));
  $('.sound-icon').textContent = muted ? '◖×' : '◖))'; $('.mute-label').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  if (!muted) tone(560, .07, 'sine', .03);
});

const keyMap = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire' };
addEventListener('keydown', (e) => { if (keyMap[e.code]) { input[keyMap[e.code]] = true; e.preventDefault(); ensureAudio(); } });
addEventListener('keyup', (e) => { if (keyMap[e.code]) { input[keyMap[e.code]] = false; e.preventDefault(); } });
addEventListener('blur', () => Object.keys(input).forEach(k => input[k] = false));

document.querySelectorAll('[data-control]').forEach(button => {
  const control = button.dataset.control;
  const on = (e) => { e.preventDefault(); input[control] = true; ensureAudio(); };
  const off = (e) => { e.preventDefault(); input[control] = false; };
  button.addEventListener('pointerdown', on); button.addEventListener('pointerup', off);
  button.addEventListener('pointercancel', off); button.addEventListener('pointerleave', off);
});

function polygon(cx, cy, sides, radius, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + i * Math.PI * 2 / sides;
    const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function render() {
  ctx.save();
  if (game.shake) ctx.translate((Math.random() - .5) * 10, (Math.random() - .5) * 10);
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT); bg.addColorStop(0, '#070525'); bg.addColorStop(1, '#03020e');
  ctx.fillStyle = bg; ctx.fillRect(-10, -10, WIDTH + 20, HEIGHT + 20);
  ctx.strokeStyle = 'rgba(73,234,255,.075)'; ctx.lineWidth = 1;
  const horizon = 190;
  for (let y = horizon; y < HEIGHT; y += Math.max(20, (y - horizon) * .17)) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
  for (let x = -700; x < 1500; x += 75) { ctx.beginPath(); ctx.moveTo(WIDTH / 2 + (x - WIDTH / 2) * .12, horizon); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
  for (const s of stars) {
    const y = (s.y + game.elapsed * 14 * s.z) % HEIGHT;
    ctx.globalAlpha = s.a; ctx.fillStyle = s.z === 3 ? '#ff55c7' : '#abfaff'; ctx.fillRect(s.x, y, s.z, s.z * 2);
  }
  ctx.globalAlpha = 1;
  for (const p of game.projectiles) {
    ctx.shadowBlur = 14; ctx.shadowColor = '#4efaff'; ctx.fillStyle = '#c5ffff'; ctx.fillRect(p.x - 2, p.y - 13, 4, 20);
  }
  for (const p of game.enemyShots) {
    ctx.shadowBlur = 15; ctx.shadowColor = '#ff3fb4'; ctx.fillStyle = '#ff70cf'; polygon(p.x, p.y, 4, 7, Math.PI / 4); ctx.fill();
  }
  for (const e of game.enemies) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.phase * .12);
    ctx.shadowBlur = 22; ctx.shadowColor = e.elite ? '#ffcf57' : '#ff3fb4';
    ctx.strokeStyle = e.elite ? '#ffcf57' : '#ff4ab8'; ctx.fillStyle = e.elite ? 'rgba(255,187,60,.14)' : 'rgba(255,50,171,.13)'; ctx.lineWidth = 3;
    polygon(0, 0, e.elite ? 6 : 4, e.radius, Math.PI / 4); ctx.fill(); ctx.stroke();
    ctx.rotate(-e.phase * .3); polygon(0, 0, 4, e.radius * .42, Math.PI / 4); ctx.strokeStyle = '#f5edff'; ctx.lineWidth = 1.5; ctx.stroke();
    if (e.elite) { ctx.fillStyle = '#ffcf57'; ctx.fillRect(-13, e.radius + 6, 8 * e.hp, 2); }
    ctx.restore();
  }
  for (const p of game.particles) {
    ctx.globalAlpha = Math.min(1, p.life * 2.8); ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  if (game.phase === 'playing' && (game.invulnerable <= 0 || Math.floor(game.invulnerable * 12) % 2)) {
    ctx.save(); ctx.translate(game.playerX, game.playerY);
    ctx.shadowBlur = 25; ctx.shadowColor = '#55efff';
    ctx.fillStyle = 'rgba(71,239,255,.14)'; ctx.strokeStyle = '#71f7ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(25, 24); ctx.lineTo(8, 18); ctx.lineTo(0, 27); ctx.lineTo(-8, 18); ctx.lineTo(-25, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ff57c2'; ctx.beginPath(); ctx.moveTo(-9, 8); ctx.lineTo(0, -18); ctx.lineTo(9, 8); ctx.stroke();
    ctx.fillStyle = '#e9ffff'; ctx.fillRect(-3, -7, 6, 16);
    ctx.fillStyle = '#ff5bc5'; ctx.globalAlpha = .7 + Math.random() * .3; ctx.beginPath(); ctx.moveTo(-6, 25); ctx.lineTo(0, 44 + Math.random() * 9); ctx.lineTo(6, 25); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function frame(now) {
  const previousPhase = game.phase;
  const beforeProjectiles = game.projectiles.length;
  updateGame(game, (now - last) / 1000, input); last = now;
  if (game.projectiles.length > beforeProjectiles) tone(780, .035, 'square', .012, -180);
  if (previousPhase === 'playing' && game.phase === 'gameover') setGameOver();
  scoreEl.textContent = String(game.score).padStart(6, '0');
  livesEl.textContent = Array.from({ length: 3 }, (_, i) => i < game.lives ? '◆' : '◇').join(' ');
  livesEl.setAttribute('aria-label', `${game.lives} lives`); levelEl.textContent = String(game.level).padStart(2, '0');
  render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function apiHeaders(prefer) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: prefer || '' };
}

async function loadLeaderboard() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    leaderboardEl.innerHTML = '<div class="board-state error">Leaderboard configuration unavailable.<small>The game is still ready to play.</small></div>'; return;
  }
  leaderboardEl.innerHTML = '<div class="board-state"><span class="loader"></span> CONTACTING OUTER GRID…</div>';
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard?select=player_name,score,created_at&candidate_id=eq.monolith_sol_medium&order=score.desc,created_at.asc&limit=10`, { headers: apiHeaders() });
    if (!response.ok) throw new Error(`Signal error ${response.status}`);
    const rows = await response.json();
    if (!rows.length) { leaderboardEl.innerHTML = '<div class="board-state empty">NO PILOTS LOGGED<small>Complete the first run and claim the grid.</small></div>'; return; }
    const best = Math.max(...rows.map(r => r.score), 1);
    leaderboardEl.innerHTML = rows.map((r, i) => `<div class="rank-row ${i < 3 ? 'top' : ''}"><b class="rank">${String(i + 1).padStart(2, '0')}</b><div class="pilot"><strong>${escapeHtml(r.player_name)}</strong><i style="--w:${Math.max(7, r.score / best * 100)}%"></i></div><span>${Number(r.score).toLocaleString()}</span></div>`).join('');
  } catch (error) {
    leaderboardEl.innerHTML = `<div class="board-state error">SIGNAL LOST<small>${escapeHtml(error.message)} · Game remains available.</small><button id="retry-board">RETRY LINK</button></div>`;
    $('#retry-board')?.addEventListener('click', loadLeaderboard);
  }
}

function escapeHtml(value) { const d = document.createElement('div'); d.textContent = String(value); return d.innerHTML; }

submitButton.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  if (game.phase !== 'gameover') return;
  if (!/^[A-Za-z0-9 _-]{1,16}$/.test(name)) { formStatus.textContent = 'Use 1–16 letters, numbers, spaces, _ or -.'; formStatus.className = 'form-status error-text'; return; }
  if (!SUPABASE_URL || !SUPABASE_KEY) { formStatus.textContent = 'Transmission system is not configured.'; return; }
  submitButton.disabled = true; nameInput.disabled = true; formStatus.textContent = 'Transmitting mission record…';
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, { method: 'POST', headers: apiHeaders('return=minimal'), body: JSON.stringify({ candidate_id: 'monolith_sol_medium', player_name: name, score: game.score }) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message || `Signal error ${response.status}`); }
    formStatus.textContent = 'Transmission confirmed. You are on the grid.'; formStatus.className = 'form-status success-text';
    tone(420, .16, 'sine', .04, 380); await loadLeaderboard();
  } catch (error) {
    formStatus.textContent = `Could not transmit: ${error.message}`; formStatus.className = 'form-status error-text'; submitButton.disabled = false; nameInput.disabled = false;
  }
});

window.__NEON_BARRAGE__ = {
  getState: () => stateView(game),
  endGameForTest: (score) => { const wasPlaying = game.phase === 'playing'; endGame(game, score); if (!wasPlaying || game.phase === 'gameover') setGameOver(); }
};

loadLeaderboard();
