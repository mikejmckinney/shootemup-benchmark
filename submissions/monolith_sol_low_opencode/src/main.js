import './style.css';
import { clamp, circlesCollide, difficultyFor, validName, validScore } from './engine.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLIC_KEY;
const canvas = document.querySelector('[data-testid="game-canvas"]');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('[data-testid="score"]');
const livesEl = document.querySelector('[data-testid="lives"]');
const threatEl = document.querySelector('#threat');
const overlay = document.querySelector('#overlay');
const titleEl = document.querySelector('#overlay-title');
const kickerEl = document.querySelector('#overlay-kicker');
const copyEl = document.querySelector('#overlay-copy');
const startButton = document.querySelector('[data-testid="start-button"]');
const submitPanel = document.querySelector('#submit-panel');
const nameInput = document.querySelector('[data-testid="player-name"]');
const submitButton = document.querySelector('[data-testid="submit-score"]');
const submitStatus = document.querySelector('#submit-status');
const leaderboard = document.querySelector('[data-testid="leaderboard"]');
const muteButton = document.querySelector('[data-testid="mute-button"]');
const keys = new Set();
let audio;
let muted = false;
let raf;
let last = 0;
let state = { phase: 'ready', score: 0, lives: 3, playerX: 360, playerY: 670, enemies: [], projectiles: [], sparks: [], elapsed: 0, spawnTimer: 0, fireTimer: 0, shake: 0 };

function tone(freq, duration = .06, type = 'square', volume = .025) {
  if (muted) return;
  audio ||= new AudioContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type; osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
  osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
}

function reset() {
  cancelAnimationFrame(raf);
  state = { phase: 'playing', score: 0, lives: 3, playerX: 360, playerY: 670, enemies: [], projectiles: [], sparks: [], elapsed: 0, spawnTimer: 0, fireTimer: 0, shake: 0 };
  submitPanel.hidden = true; submitStatus.textContent = ''; overlay.hidden = true;
  last = performance.now(); tone(220, .15, 'sawtooth', .04); updateHud(); raf = requestAnimationFrame(loop);
}

function endGame(score = state.score) {
  if (!validScore(score)) return;
  state.score = score; state.phase = 'gameover'; updateHud();
  kickerEl.textContent = 'TRANSMISSION LOST'; titleEl.innerHTML = 'RUN<br><em>TERMINATED</em>';
  copyEl.innerHTML = `FINAL SCORE <strong>${String(score).padStart(6, '0')}</strong><br>Log your callsign on the global signal.`;
  startButton.innerHTML = 'REINITIALIZE <span>↻</span>'; overlay.hidden = false; submitPanel.hidden = false;
  tone(75, .5, 'sawtooth', .05);
}

function spawnEnemy() {
  const d = difficultyFor(state.score, state.elapsed);
  const heavy = Math.random() < Math.min(.08 + d.level * .012, .3);
  state.enemies.push({ x: 35 + Math.random() * 650, y: -30, r: heavy ? 22 : 15, hp: heavy ? 3 : 1, speed: d.speed * (heavy ? .65 : .9 + Math.random() * .45), phase: Math.random() * 6, heavy });
}

function burst(x, y, color, count = 9) {
  for (let i = 0; i < count; i++) state.sparks.push({ x, y, vx: (Math.random() - .5) * 260, vy: (Math.random() - .5) * 260, life: .35 + Math.random() * .35, color });
}

function hitPlayer() {
  state.lives--; state.shake = 12; burst(state.playerX, state.playerY, '#ff3cac', 20);
  document.querySelector('.damage-flash').classList.remove('hit'); void document.body.offsetWidth; document.querySelector('.damage-flash').classList.add('hit');
  tone(90, .22, 'sawtooth', .06); updateHud(); if (state.lives <= 0) endGame();
}

function update(dt) {
  state.elapsed += dt; state.spawnTimer -= dt * 1000; state.fireTimer -= dt;
  const d = difficultyFor(state.score, state.elapsed);
  if (state.spawnTimer <= 0) { spawnEnemy(); state.spawnTimer = d.spawnEvery; }
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) dx--; if (keys.has('ArrowRight') || keys.has('KeyD')) dx++;
  if (keys.has('ArrowUp') || keys.has('KeyW')) dy--; if (keys.has('ArrowDown') || keys.has('KeyS')) dy++;
  const mag = Math.hypot(dx, dy) || 1; state.playerX = clamp(state.playerX + dx / mag * 300 * dt, 22, 698); state.playerY = clamp(state.playerY + dy / mag * 300 * dt, 370, 730);
  if ((keys.has('Space')) && state.fireTimer <= 0) { state.projectiles.push({ x: state.playerX, y: state.playerY - 23, r: 4 }); state.fireTimer = .14; tone(520, .045); }
  state.projectiles.forEach(p => p.y -= 610 * dt); state.projectiles = state.projectiles.filter(p => p.y > -20);
  state.enemies.forEach(e => { e.y += e.speed * dt; e.x += Math.sin(state.elapsed * 2.2 + e.phase) * 32 * dt; });
  for (const p of state.projectiles) for (const e of state.enemies) if (!p.dead && !e.dead && circlesCollide(p, e)) { p.dead = true; e.hp--; burst(p.x, p.y, '#36f1ff', 4); if (e.hp <= 0) { e.dead = true; state.score += e.heavy ? 175 : 100; state.shake = 4; burst(e.x, e.y, e.heavy ? '#8c52ff' : '#ff3cac', 14); tone(e.heavy ? 130 : 180, .09, 'triangle', .04); updateHud(); } }
  for (const e of state.enemies) if (!e.dead && (e.y > 790 || circlesCollide(e, { x: state.playerX, y: state.playerY, r: 17 }))) { e.dead = true; hitPlayer(); if (state.phase !== 'playing') break; }
  state.projectiles = state.projectiles.filter(p => !p.dead); state.enemies = state.enemies.filter(e => !e.dead);
  state.sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.vx *= .96; s.vy *= .96; }); state.sparks = state.sparks.filter(s => s.life > 0);
  state.shake *= .85; threatEl.textContent = String(d.level).padStart(2, '0');
}

function draw() {
  ctx.save(); ctx.clearRect(0, 0, 720, 760); ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
  const g = ctx.createLinearGradient(0, 0, 0, 760); g.addColorStop(0, '#0c1027'); g.addColorStop(1, '#050713'); ctx.fillStyle = g; ctx.fillRect(0, 0, 720, 760);
  ctx.strokeStyle = '#172143'; ctx.lineWidth = 1; const offset = (state.elapsed * 45) % 48;
  for (let y = -48 + offset; y < 760; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(720, y); ctx.stroke(); }
  for (let x = 0; x < 720; x += 60) { ctx.beginPath(); ctx.moveTo(360 + (x - 360) * .25, 0); ctx.lineTo(x, 760); ctx.stroke(); }
  ctx.fillStyle = '#fff'; for (let i = 0; i < 45; i++) { const y = (i * 173 + state.elapsed * (30 + i % 5 * 12)) % 760; ctx.globalAlpha = .18 + (i % 3) * .15; ctx.fillRect((i * 97) % 720, y, 1, 2); } ctx.globalAlpha = 1;
  state.projectiles.forEach(p => { ctx.shadowBlur = 14; ctx.shadowColor = '#36f1ff'; ctx.fillStyle = '#dfffff'; ctx.fillRect(p.x - 2, p.y - 12, 4, 20); }); ctx.shadowBlur = 0;
  state.enemies.forEach(e => { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(state.elapsed * (e.heavy ? -.8 : 1.5)); ctx.shadowBlur = 18; ctx.shadowColor = e.heavy ? '#8c52ff' : '#ff3cac'; ctx.strokeStyle = e.heavy ? '#a47aff' : '#ff3cac'; ctx.fillStyle = e.heavy ? '#24164a' : '#32112f'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < (e.heavy ? 6 : 4); i++) { const a = i * Math.PI * 2 / (e.heavy ? 6 : 4); const r = e.r; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-3, -3, 6, 6); ctx.restore(); });
  if (state.phase === 'playing') { ctx.save(); ctx.translate(state.playerX, state.playerY); ctx.shadowBlur = 22; ctx.shadowColor = '#36f1ff'; ctx.fillStyle = '#36f1ff'; ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(17, 18); ctx.lineTo(0, 11); ctx.lineTo(-17, 18); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ff3cac'; ctx.fillRect(-5, 13, 10, 12 + Math.random() * 10); ctx.fillStyle = '#081020'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.fill(); ctx.restore(); }
  state.sparks.forEach(s => { ctx.globalAlpha = Math.min(1, s.life * 2); ctx.fillStyle = s.color; ctx.fillRect(s.x, s.y, 3, 3); }); ctx.globalAlpha = 1; ctx.restore();
}

function loop(now) { if (state.phase !== 'playing') return; const dt = Math.min((now - last) / 1000, .033); last = now; update(dt); draw(); if (state.phase === 'playing') raf = requestAnimationFrame(loop); }
function updateHud() { scoreEl.textContent = String(state.score).padStart(6, '0'); livesEl.textContent = state.lives ? Array(state.lives).fill('◆').join(' ') : 'CRITICAL'; }

async function loadScores() {
  if (!SUPABASE_URL || !SUPABASE_KEY) { leaderboard.innerHTML = '<p class="board-state">Signal unavailable. Game remains operational.</p>'; return; }
  leaderboard.innerHTML = '<p class="board-state">Connecting to relay…</p>';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/scores?select=player_name,score&order=score.desc,created_at.asc&limit=10`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) throw new Error('Relay refused connection'); const rows = await res.json();
    leaderboard.innerHTML = rows.length ? rows.map((r, i) => `<div class="leader-row"><span class="rank">${String(i + 1).padStart(2, '0')}</span><span>${escapeHtml(r.player_name)}</span><strong>${Number(r.score).toLocaleString()}</strong></div>`).join('') : '<p class="board-state">No pilots logged. Claim the first position.</p>';
  } catch { leaderboard.innerHTML = '<p class="board-state">Global signal interrupted. Retry after your run.</p>'; }
}
function escapeHtml(value) { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }

async function submitScore() {
  const name = nameInput.value.trim(); if (!validName(name)) { submitStatus.textContent = 'Use 1-16 letters, numbers, spaces, _ or -.'; return; }
  if (state.phase !== 'gameover' || !validScore(state.score)) return;
  submitButton.disabled = true; submitStatus.textContent = 'Transmitting…';
  try { const res = await fetch(`${SUPABASE_URL}/rest/v1/scores`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ player_name: name, score: state.score }) }); if (!res.ok) throw new Error(); submitStatus.textContent = 'Score logged on the global signal.'; submitButton.textContent = 'LOGGED'; await loadScores(); } catch { submitStatus.textContent = 'Transmission failed. Check signal and retry.'; submitButton.disabled = false; }
}

document.addEventListener('keydown', e => { if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); keys.add(e.code); });
document.addEventListener('keyup', e => keys.delete(e.code));
document.querySelectorAll('[data-key]').forEach(button => { const down = e => { e.preventDefault(); keys.add(button.dataset.key); }; const up = e => { e.preventDefault(); keys.delete(button.dataset.key); }; button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up); });
startButton.addEventListener('click', reset); submitButton.addEventListener('click', submitScore);
muteButton.addEventListener('click', () => { muted = !muted; muteButton.textContent = `SOUND: ${muted ? 'OFF' : 'ON'}`; muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound'); if (!muted) tone(330); });
window.__NEON_BARRAGE__ = { getState: () => ({ phase: state.phase, score: state.score, lives: state.lives, playerX: state.playerX, playerY: state.playerY, enemyCount: state.enemies.length, projectileCount: state.projectiles.length }), endGameForTest: score => { if (validScore(score)) { cancelAnimationFrame(raf); endGame(score); } } };
draw(); updateHud(); loadScores();
