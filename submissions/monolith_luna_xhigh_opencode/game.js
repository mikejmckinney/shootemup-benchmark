import { circleHit, damageForEnemy, isValidName, isValidScore, nextSpawnDelay } from './game-logic.mjs';

const canvas = document.querySelector('[data-testid="game-canvas"]');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const scoreEl = document.querySelector('[data-testid="score"]');
const livesEl = document.querySelector('[data-testid="lives"]');
const phaseLabel = document.querySelector('#phase-label');
const startOverlay = document.querySelector('#start-overlay');
const gameoverOverlay = document.querySelector('#gameover-overlay');
const startButton = document.querySelector('[data-testid="start-button"]');
const restartButton = document.querySelector('#restart-button');
const form = document.querySelector('#score-form');
const nameInput = document.querySelector('[data-testid="player-name"]');
const formMessage = document.querySelector('#form-message');
const leaderboardEl = document.querySelector('[data-testid="leaderboard"]');
const leaderboardState = document.querySelector('#leaderboard-state');
const lastSync = document.querySelector('#last-sync');
const meter = document.querySelector('#difficulty-meter b');
const muteButton = document.querySelector('[data-testid="mute-button"]');
const muteLabel = document.querySelector('#mute-label');
const muteIcon = document.querySelector('#mute-icon');
const config = window.__SUPABASE_CONFIG__ || {};

const keys = new Set();
const stars = Array.from({ length: 100 }, (_, i) => ({ x: (i * 83) % W, y: (i * 137) % H, size: i % 9 === 0 ? 2 : 1, speed: 10 + (i % 5) * 8, alpha: .2 + (i % 6) * .1 }));
const state = { phase: 'ready', score: 0, lives: 3, playerX: W / 2, playerY: H - 72, enemyCount: 0, projectileCount: 0 };
let player;
let enemies = [];
let projectiles = [];
let enemyProjectiles = [];
let particles = [];
let lastFrame = 0;
let elapsed = 0;
let spawnClock = 0;
let fireClock = 0;
let shake = 0;
let muted = false;
let audioUnlocked = false;
let audioContext;

function resetEntities() {
  player = { x: W / 2, y: H - 72, radius: 17, invulnerable: 0 };
  enemies = [];
  projectiles = [];
  enemyProjectiles = [];
  particles = [];
  elapsed = 0;
  spawnClock = 0;
  fireClock = 0;
  shake = 0;
  syncHud();
}

function syncHud() {
  scoreEl.textContent = String(state.score).padStart(6, '0');
  livesEl.textContent = String(Math.max(0, state.lives)).padStart(2, '0');
  phaseLabel.textContent = state.phase === 'playing' ? 'LIVE / SECTOR 9' : state.phase === 'gameover' ? 'SIGNAL LOST' : 'STANDBY';
  meter.style.width = `${Math.min(100, 5 + elapsed * 2.2)}%`;
  state.playerX = Math.round(player?.x ?? W / 2);
  state.playerY = Math.round(player?.y ?? H - 72);
  state.enemyCount = enemies.length;
  state.projectileCount = projectiles.length + enemyProjectiles.length;
}

function beginAudio() {
  if (audioContext || muted || !audioUnlocked) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function unlockAudio() {
  audioUnlocked = true;
  beginAudio();
}

function sound(frequency, duration = .06, type = 'square', volume = .025) {
  if (muted) return;
  beginAudio();
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function startGame() {
  unlockAudio();
  resetEntities();
  state.phase = 'playing';
  state.score = 0;
  state.lives = 3;
  startOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  formMessage.textContent = '';
  phaseLabel.textContent = 'LIVE / SECTOR 9';
  sound(220, .12, 'sawtooth', .035);
  requestAnimationFrame(loop);
}

function endGame(score = state.score) {
  if (!isValidScore(score)) return;
  state.score = score;
  state.phase = 'gameover';
  syncHud();
  document.querySelector('#final-score').textContent = state.score.toLocaleString();
  gameoverOverlay.classList.remove('hidden');
  nameInput.focus();
  sound(100, .25, 'sawtooth', .04);
}

function spawnEnemy() {
  const roll = Math.random();
  const type = roll > .85 ? 'brute' : roll > .62 ? 'zigzag' : 'scout';
  const radius = type === 'brute' ? 23 : type === 'zigzag' ? 17 : 14;
  enemies.push({ x: 35 + Math.random() * (W - 70), y: -32, baseX: 35 + Math.random() * (W - 70), radius, type, hp: type === 'brute' ? 3 : 1, speed: 45 + Math.random() * 35 + elapsed * 1.6, phase: Math.random() * Math.PI * 2, shotClock: 1.4 + Math.random() * 2 });
}

function fire() {
  if (fireClock > 0) return;
  projectiles.push({ x: player.x, y: player.y - 22, radius: 4, speed: 610 });
  fireClock = .145;
  sound(510 + Math.random() * 100, .045, 'square', .018);
}

function burst(x, y, color, amount = 12) {
  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 150;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .45, maxLife: .8, color, size: 1 + Math.random() * 3 });
  }
}

function update(dt) {
  elapsed += dt;
  fireClock -= dt;
  spawnClock -= dt * 1000;
  if (spawnClock <= 0) { spawnEnemy(); spawnClock = nextSpawnDelay(elapsed); }
  const moveX = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  const moveY = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
  const vector = Math.hypot(moveX, moveY) || 1;
  player.x = Math.max(28, Math.min(W - 28, player.x + moveX / vector * 300 * dt));
  player.y = Math.max(65, Math.min(H - 30, player.y + moveY / vector * 260 * dt));
  if (keys.has('Space')) fire();
  player.invulnerable = Math.max(0, player.invulnerable - dt);

  projectiles.forEach((shot) => { shot.y -= shot.speed * dt; });
  projectiles = projectiles.filter((shot) => shot.y > -20);
  enemies.forEach((enemy) => {
    enemy.y += enemy.speed * dt;
    if (enemy.type === 'zigzag') enemy.x = enemy.baseX + Math.sin(elapsed * 2.2 + enemy.phase) * 72;
    enemy.shotClock -= dt;
    if (enemy.shotClock <= 0 && enemy.y > 40) { enemyProjectiles.push({ x: enemy.x, y: enemy.y + enemy.radius, radius: 5, speed: 170 + elapsed * 2 }); enemy.shotClock = 2.3 + Math.random() * 2.5; }
  });
  enemyProjectiles.forEach((shot) => { shot.y += shot.speed * dt; });
  enemyProjectiles = enemyProjectiles.filter((shot) => shot.y < H + 20);

  for (let ei = enemies.length - 1; ei >= 0; ei -= 1) {
    const enemy = enemies[ei];
    let destroyed = false;
    for (let pi = projectiles.length - 1; pi >= 0; pi -= 1) {
      if (circleHit({ x: enemy.x, y: enemy.y, radius: enemy.radius }, projectiles[pi])) {
        projectiles.splice(pi, 1); enemy.hp -= 1; burst(enemy.x, enemy.y, enemy.type === 'brute' ? '#ffca63' : '#ff4f9a', 5); sound(160, .035, 'triangle', .012);
        if (enemy.hp <= 0) { destroyed = true; state.score += enemy.type === 'brute' ? 80 : enemy.type === 'zigzag' ? 35 : 20; burst(enemy.x, enemy.y, enemy.type === 'brute' ? '#ffca63' : '#45f5e0', enemy.type === 'brute' ? 26 : 15); sound(enemy.type === 'brute' ? 80 : 240, .11, 'sawtooth', .025); }
        break;
      }
    }
    if (destroyed) enemies.splice(ei, 1);
    else if (circleHit({ x: enemy.x, y: enemy.y, radius: enemy.radius }, player) && player.invulnerable <= 0) { enemies.splice(ei, 1); damagePlayer(damageForEnemy(enemy)); }
    else if (enemy.y > H + 30) { enemies.splice(ei, 1); damagePlayer(1); }
  }
  for (let i = enemyProjectiles.length - 1; i >= 0; i -= 1) {
    if (circleHit(enemyProjectiles[i], player) && player.invulnerable <= 0) { enemyProjectiles.splice(i, 1); damagePlayer(1); }
  }
  particles.forEach((particle) => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 35 * dt; particle.life -= dt; });
  particles = particles.filter((particle) => particle.life > 0);
  shake = Math.max(0, shake - dt * 3);
  syncHud();
}

function damagePlayer(amount) {
  state.lives -= amount;
  player.invulnerable = 1.25;
  shake = .6;
  burst(player.x, player.y, '#ff4f9a', 18);
  sound(75, .2, 'sawtooth', .04);
  if (state.lives <= 0) endGame(state.score);
}

function drawGlowCircle(x, y, radius, color, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.shadowBlur = radius * 2; ctx.shadowColor = color; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function draw() {
  ctx.save();
  const jitterX = shake ? (Math.random() - .5) * shake * 12 : 0;
  const jitterY = shake ? (Math.random() - .5) * shake * 12 : 0;
  ctx.translate(jitterX, jitterY);
  const gradient = ctx.createLinearGradient(0, 0, 0, H); gradient.addColorStop(0, '#0c1732'); gradient.addColorStop(1, '#080b1b'); ctx.fillStyle = gradient; ctx.fillRect(-10, -10, W + 20, H + 20);
  ctx.strokeStyle = 'rgba(80,132,196,.1)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 60; y <= H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  stars.forEach((star) => { const y = (star.y + elapsed * star.speed) % H; ctx.fillStyle = `rgba(165,210,255,${star.alpha})`; ctx.fillRect(star.x, y, star.size, star.size); });
  ctx.strokeStyle = 'rgba(69,245,224,.12)'; ctx.setLineDash([2, 10]); ctx.beginPath(); ctx.moveTo(0, H * .72); ctx.lineTo(W, H * .72); ctx.stroke(); ctx.setLineDash([]);
  projectiles.forEach((shot) => { ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = '#45f5e0'; ctx.fillStyle = '#b9fff6'; ctx.fillRect(shot.x - 2, shot.y - 12, 4, 15); ctx.restore(); });
  enemyProjectiles.forEach((shot) => { drawGlowCircle(shot.x, shot.y, 4, '#ff4f9a'); });
  enemies.forEach((enemy) => {
    ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.type === 'zigzag' ? elapsed * 2 : Math.PI / 4); ctx.shadowBlur = 18; ctx.shadowColor = enemy.type === 'brute' ? '#ffca63' : '#ff4f9a'; ctx.strokeStyle = enemy.type === 'brute' ? '#ffca63' : '#ff4f9a'; ctx.fillStyle = enemy.type === 'brute' ? 'rgba(255,202,99,.16)' : 'rgba(255,79,154,.15)'; ctx.lineWidth = 2;
    ctx.beginPath(); const sides = enemy.type === 'brute' ? 6 : 4; for (let i = 0; i < sides; i += 1) { const a = i * Math.PI * 2 / sides; const r = enemy.radius * (i % 2 ? .8 : 1); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = enemy.type === 'brute' ? '#ffca63' : '#ff4f9a'; ctx.fillRect(-3, -3, 6, 6); if (enemy.hp > 1) { ctx.strokeStyle = '#ffca63'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, enemy.radius + 5, -.8, -.8 + Math.PI * 2 * (enemy.hp / 3)); ctx.stroke(); } ctx.restore();
  });
  particles.forEach((particle) => { drawGlowCircle(particle.x, particle.y, particle.size, particle.color, Math.max(0, particle.life / particle.maxLife)); });
  if (player) {
    ctx.save(); ctx.translate(player.x, player.y); if (player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0) ctx.globalAlpha = .35; ctx.shadowBlur = 22; ctx.shadowColor = '#45f5e0'; ctx.fillStyle = '#45f5e0'; ctx.strokeStyle = '#c8fff9'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(15, 17); ctx.lineTo(0, 11); ctx.lineTo(-15, 17); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff4f9a'; ctx.beginPath(); ctx.moveTo(-6, 13); ctx.lineTo(0, 26 + Math.random() * 7); ctx.lineTo(6, 13); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#081020'; ctx.beginPath(); ctx.arc(0, -7, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function loop(timestamp) {
  if (state.phase !== 'playing') { draw(); return; }
  const dt = Math.min(.034, (timestamp - lastFrame) / 1000 || .016); lastFrame = timestamp; update(dt); draw();
  if (state.phase === 'playing') requestAnimationFrame(loop);
}

function formatRows(rows) {
  leaderboardEl.innerHTML = '';
  rows.forEach((row, index) => {
    const li = document.createElement('li'); li.className = 'score-row';
    const rank = document.createElement('span'); rank.className = 'score-rank'; rank.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('span'); name.className = 'score-name'; name.textContent = row.name;
    const score = document.createElement('span'); score.className = 'score-value'; score.textContent = Number(row.score).toLocaleString();
    li.append(rank, name, score); leaderboardEl.append(li);
  });
}

function setLeaderboardState(text, className = '') { leaderboardState.className = `leaderboard-state ${className}`; leaderboardState.textContent = text; }

async function loadLeaderboard() {
  setLeaderboardState('SYNCING SCORES'); const loader = document.createElement('span'); loader.className = 'loader'; leaderboardState.append(loader);
  if (!config.url || config.url.startsWith('__') || !config.anonKey || config.anonKey.startsWith('__')) { setLeaderboardState('LEADERBOARD WILL SYNC AFTER DEPLOYMENT', 'empty'); return; }
  try {
    const response = await fetch(`${config.url}/rest/v1/scores?select=name,score&order=score.desc,created_at.asc&limit=10`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } });
    if (!response.ok) throw new Error('network');
    const rows = await response.json();
    if (!rows.length) { setLeaderboardState('NO SIGNALS YET. BE THE FIRST PILOT.', 'empty'); leaderboardEl.innerHTML = ''; return; }
    formatRows(rows); setLeaderboardState(''); lastSync.textContent = new Date().toLocaleTimeString([], { hour12: false });
  } catch { setLeaderboardState('FEED OFFLINE. GAMEPLAY REMAINS AVAILABLE.', 'error'); }
}

async function submitScore(event) {
  event.preventDefault();
  const name = nameInput.value.trim().toUpperCase();
  if (!isValidName(name)) { formMessage.textContent = 'CALLSIGN MUST BE 1–16 CHARACTERS.'; nameInput.focus(); return; }
  if (!isValidScore(state.score)) { formMessage.textContent = 'SCORE SIGNAL IS INVALID.'; return; }
  if (!config.url || config.url.startsWith('__') || !config.anonKey || config.anonKey.startsWith('__')) { formMessage.textContent = 'FEED UNAVAILABLE. SCORE KEPT LOCALLY.'; return; }
  const submit = form.querySelector('button'); submit.disabled = true; formMessage.textContent = 'TRANSMITTING...';
  try {
    const response = await fetch(`${config.url}/rest/v1/scores`, { method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ name, score: state.score }) });
    if (!response.ok) throw new Error('rejected');
    formMessage.textContent = 'SIGNAL RECEIVED. GOOD HUNT.'; submit.disabled = false; await loadLeaderboard();
  } catch { formMessage.textContent = 'TRANSMISSION FAILED. TRY AGAIN.'; submit.disabled = false; }
}

function keyDown(event) { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code) || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) { event.preventDefault(); unlockAudio(); keys.add(event.code); if (state.phase === 'ready' && event.code === 'Space') startGame(); } }
function keyUp(event) { keys.delete(event.code); }

startButton.addEventListener('click', startGame); restartButton.addEventListener('click', startGame); form.addEventListener('submit', submitScore);
muteButton.addEventListener('click', () => { muted = !muted; if (!muted) unlockAudio(); muteButton.setAttribute('aria-pressed', String(muted)); muteLabel.textContent = muted ? 'OFF' : 'ON'; muteIcon.textContent = muted ? '◌' : '◖'; });
window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', () => keys.clear());
document.querySelectorAll('.touch-controls [data-key]').forEach((button) => {
  const code = button.dataset.key;
  const release = (event) => { event.preventDefault(); keys.delete(code); button.classList.remove('active'); };
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); unlockAudio(); keys.add(code); button.classList.add('active'); });
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('pointerleave', release);
});

resetEntities(); draw(); loadLeaderboard();
window.__NEON_BARRAGE__ = { getState: () => ({ phase: state.phase, score: state.score, lives: state.lives, playerX: state.playerX, playerY: state.playerY, enemyCount: state.enemyCount, projectileCount: state.projectileCount }), endGameForTest: (score) => endGame(score) };
