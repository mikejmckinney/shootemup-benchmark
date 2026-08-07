import './style.css';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  circleHit,
  clamp,
  createInitialState,
  getDifficulty,
  getWaveForScore,
  isPlausibleScore,
  isValidName,
} from './game-logic.js';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './config.js';

const canvas = document.querySelector('[data-testid="game-canvas"]');
const context = canvas.getContext('2d');
const scoreElement = document.querySelector('[data-testid="score"]');
const livesElement = document.querySelector('[data-testid="lives"]');
const waveElement = document.querySelector('#wave-value');
const gameOverlay = document.querySelector('#game-overlay');
const readyCard = document.querySelector('#ready-card');
const gameoverCard = document.querySelector('#gameover-card');
const finalScoreElement = document.querySelector('#final-score');
const startButton = document.querySelector('[data-testid="start-button"]');
const restartButton = document.querySelector('#restart-button');
const muteButton = document.querySelector('[data-testid="mute-button"]');
const muteLabel = document.querySelector('.mute-label');
const scoreForm = document.querySelector('#score-form');
const nameInput = document.querySelector('[data-testid="player-name"]');
const submitButton = document.querySelector('[data-testid="submit-score"]');
const formMessage = document.querySelector('#name-error');
const leaderboardStatus = document.querySelector('#leaderboard-status');
const leaderboardElement = document.querySelector('[data-testid="leaderboard"]');

const keys = new Set();
const touchState = { left: false, right: false, fire: false };
const enemies = [];
const projectiles = [];
const particles = [];
const stars = createStars();
let state = createInitialState();
let spawnTimer = 0.25;
let fireTimer = 0;
let hitTimer = 0;
let shakeTimer = 0;
let lastFrame = 0;
let ambientTime = 0;

class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
  }

  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return true;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = 0.16;
    this.master.connect(this.context.destination);
    return true;
  }

  tone(frequency, duration, type = 'square', volume = 0.3, slideTo = frequency) {
    if (this.muted || !this.ensure()) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.015);
  }

  launch() {
    this.tone(180, 0.18, 'sawtooth', 0.22, 410);
  }

  shoot() {
    this.tone(520, 0.07, 'square', 0.1, 300);
  }

  hit() {
    this.tone(110, 0.12, 'triangle', 0.2, 48);
    window.setTimeout(() => this.tone(260, 0.08, 'square', 0.1, 170), 24);
  }

  damage() {
    this.tone(105, 0.26, 'sawtooth', 0.2, 42);
  }

  gameOver() {
    if (!this.context || this.muted) return;
    this.tone(220, 0.4, 'triangle', 0.19, 70);
  }
}

const audio = new AudioEngine();

function createStars() {
  return Array.from({ length: 105 }, (_, index) => ({
    x: (index * 83.17 + 17) % WORLD_WIDTH,
    y: (index * 47.23 + 9) % WORLD_HEIGHT,
    size: 0.45 + (index % 4) * 0.35,
    speed: 4 + (index % 7) * 3,
    alpha: 0.22 + (index % 5) * 0.1,
  }));
}

function resetGame() {
  state = { ...createInitialState(), phase: 'playing' };
  enemies.length = 0;
  projectiles.length = 0;
  particles.length = 0;
  spawnTimer = 0.25;
  fireTimer = 0;
  hitTimer = 0;
  shakeTimer = 0;
  gameOverlay.hidden = true;
  readyCard.hidden = true;
  gameoverCard.hidden = true;
  formMessage.textContent = '';
  formMessage.classList.remove('success');
  nameInput.value = '';
  audio.ensure();
  audio.launch();
  updateHud();
}

function setGameOver() {
  state.phase = 'gameover';
  state.lives = 0;
  enemies.length = 0;
  projectiles.length = 0;
  gameOverlay.hidden = false;
  readyCard.hidden = true;
  gameoverCard.hidden = false;
  finalScoreElement.textContent = formatScore(state.score);
  updateHud();
  audio.gameOver();
}

function formatScore(score) {
  return String(Math.max(0, Math.trunc(score))).padStart(6, '0');
}

function updateHud() {
  scoreElement.textContent = formatScore(state.score);
  livesElement.textContent = String(Math.max(0, state.lives)).padStart(2, '0');
  waveElement.textContent = String(getWaveForScore(state.score)).padStart(2, '0');
}

function spawnEnemy() {
  const roll = Math.random();
  const type = roll > 0.86 ? 'brute' : roll > 0.62 ? 'needle' : 'drone';
  const typeData = {
    drone: { radius: 16, speed: 1, points: 100, color: '#51f4e8' },
    needle: { radius: 12, speed: 1.35, points: 150, color: '#fc5ba7' },
    brute: { radius: 24, speed: 0.68, points: 250, color: '#ffb25d' },
  }[type];
  enemies.push({
    x: 34 + Math.random() * (WORLD_WIDTH - 68),
    y: -35,
    vx: (Math.random() - 0.5) * 52,
    phase: Math.random() * Math.PI * 2,
    radius: typeData.radius,
    speed: typeData.speed,
    points: typeData.points,
    color: typeData.color,
    type,
  });
}

function spawnPlayerShot() {
  projectiles.push({ x: state.playerX, y: state.playerY - 24, vx: 0, vy: -610, radius: 4, enemy: false });
  audio.shoot();
}

function spawnEnemyShot(enemy) {
  projectiles.push({ x: enemy.x, y: enemy.y + enemy.radius, vx: 0, vy: 230 + getWaveForScore(state.score) * 5, radius: 5, enemy: true });
}

function addBurst(x, y, color, amount = 12) {
  for (let index = 0; index < amount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 180;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.45,
      maxLife: 0.8,
      size: 1 + Math.random() * 3,
      color,
    });
  }
}

function damagePlayer() {
  if (hitTimer > 0 || state.phase !== 'playing') return;
  state.lives -= 1;
  hitTimer = 1.05;
  shakeTimer = 0.28;
  addBurst(state.playerX, state.playerY, '#fc5ba7', 18);
  audio.damage();
  updateHud();
  if (state.lives <= 0) setGameOver();
}

function updateGame(delta) {
  ambientTime += delta;
  hitTimer = Math.max(0, hitTimer - delta);
  shakeTimer = Math.max(0, shakeTimer - delta);
  const speed = 315;
  const horizontal = (keys.has('ArrowRight') || keys.has('d') || touchState.right ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') || touchState.left ? 1 : 0);
  const vertical = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
  state.playerX = clamp(state.playerX + horizontal * speed * delta, 36, WORLD_WIDTH - 36);
  state.playerY = clamp(state.playerY + vertical * speed * delta, WORLD_HEIGHT * 0.55, WORLD_HEIGHT - 39);

  fireTimer -= delta;
  const firing = keys.has(' ') || touchState.fire;
  if (firing && fireTimer <= 0) {
    spawnPlayerShot();
    fireTimer = 0.17;
  }

  const wave = getWaveForScore(state.score);
  const difficulty = getDifficulty(wave);
  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = difficulty.spawnDelay / 1000 * (0.7 + Math.random() * 0.6);
  }

  for (const enemy of enemies) {
    enemy.y += difficulty.enemySpeed * enemy.speed * delta;
    enemy.x += enemy.vx * delta;
    enemy.phase += delta * (2 + enemy.speed);
    if (enemy.x < enemy.radius || enemy.x > WORLD_WIDTH - enemy.radius) enemy.vx *= -1;
    if (enemy.y > 38 && enemy.y < WORLD_HEIGHT * 0.68 && Math.random() < difficulty.fireChance * 60 * delta) spawnEnemyShot(enemy);
  }

  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const enemy = enemies[index];
    if (enemy.y > WORLD_HEIGHT + enemy.radius) {
      enemies.splice(index, 1);
      damagePlayer();
    } else if (circleHit({ x: state.playerX, y: state.playerY, radius: 18 }, enemy)) {
      enemies.splice(index, 1);
      addBurst(enemy.x, enemy.y, enemy.color, 15);
      damagePlayer();
    }
  }

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.x += projectile.vx * delta;
    projectile.y += projectile.vy * delta;
    if (projectile.y < -25 || projectile.y > WORLD_HEIGHT + 25) {
      projectiles.splice(index, 1);
      continue;
    }
    if (projectile.enemy) {
      if (hitTimer <= 0 && circleHit({ x: state.playerX, y: state.playerY, radius: 17 }, projectile)) {
        projectiles.splice(index, 1);
        damagePlayer();
      }
      continue;
    }
    let hitEnemy = -1;
    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      if (circleHit(projectile, enemies[enemyIndex])) {
        hitEnemy = enemyIndex;
        break;
      }
    }
    if (hitEnemy >= 0) {
      const enemy = enemies[hitEnemy];
      projectiles.splice(index, 1);
      enemies.splice(hitEnemy, 1);
      state.score += enemy.points;
      addBurst(enemy.x, enemy.y, enemy.color, enemy.type === 'brute' ? 24 : 13);
      audio.hit();
      updateHud();
    }
  }

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    if (particle.life <= 0) particles.splice(index, 1);
  }
}

function drawScene() {
  context.save();
  if (shakeTimer > 0) context.translate((Math.random() - 0.5) * 7 * shakeTimer, (Math.random() - 0.5) * 7 * shakeTimer);
  drawBackground();
  for (const projectile of projectiles) drawProjectile(projectile);
  for (const enemy of enemies) drawEnemy(enemy);
  for (const particle of particles) drawParticle(particle);
  drawPlayer();
  context.restore();
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, '#091d2d');
  gradient.addColorStop(0.55, '#071421');
  gradient.addColorStop(1, '#120d25');
  context.fillStyle = gradient;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const glow = context.createRadialGradient(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.84, 2, WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.84, 360);
  glow.addColorStop(0, 'rgba(42, 215, 211, 0.15)');
  glow.addColorStop(1, 'rgba(42, 215, 211, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (const star of stars) {
    const y = (star.y + ambientTime * star.speed) % WORLD_HEIGHT;
    const pulse = star.alpha + Math.sin(ambientTime * 2 + star.x) * 0.08;
    context.fillStyle = `rgba(171, 244, 239, ${Math.max(0.08, pulse)})`;
    context.fillRect(star.x, y, star.size, star.size);
  }

  context.save();
  context.strokeStyle = 'rgba(66, 166, 180, 0.12)';
  context.lineWidth = 1;
  for (let x = 0; x <= WORLD_WIDTH; x += 64) {
    context.beginPath();
    context.moveTo(x, WORLD_HEIGHT * 0.55);
    context.lineTo(x + (x - WORLD_WIDTH / 2) * 0.35, WORLD_HEIGHT);
    context.stroke();
  }
  for (let y = WORLD_HEIGHT * 0.58; y < WORLD_HEIGHT; y += 27 + (y - WORLD_HEIGHT * 0.58) * 0.035) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD_WIDTH, y);
    context.stroke();
  }
  context.restore();

  context.strokeStyle = 'rgba(81, 244, 232, 0.23)';
  context.beginPath();
  context.moveTo(0, WORLD_HEIGHT * 0.55);
  context.lineTo(WORLD_WIDTH, WORLD_HEIGHT * 0.55);
  context.stroke();
}

function drawPlayer() {
  if (hitTimer > 0 && Math.floor(hitTimer * 14) % 2 === 0) return;
  const x = state.playerX;
  const y = state.playerY;
  context.save();
  context.translate(x, y);
  context.shadowBlur = 22;
  context.shadowColor = '#51f4e8';
  context.fillStyle = '#51f4e8';
  context.beginPath();
  context.moveTo(0, -24);
  context.lineTo(18, 17);
  context.lineTo(6, 13);
  context.lineTo(0, 25);
  context.lineTo(-6, 13);
  context.lineTo(-18, 17);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = '#081a29';
  context.beginPath();
  context.moveTo(0, -15);
  context.lineTo(7, 9);
  context.lineTo(0, 6);
  context.lineTo(-7, 9);
  context.closePath();
  context.fill();
  context.fillStyle = '#fc5ba7';
  context.globalAlpha = 0.75 + Math.sin(ambientTime * 24) * 0.2;
  context.beginPath();
  context.moveTo(-5, 16);
  context.lineTo(0, 29 + Math.random() * 5);
  context.lineTo(5, 16);
  context.closePath();
  context.fill();
  context.restore();
}

function drawEnemy(enemy) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(Math.sin(enemy.phase) * 0.08);
  context.shadowBlur = 18;
  context.shadowColor = enemy.color;
  context.strokeStyle = enemy.color;
  context.fillStyle = 'rgba(7, 20, 33, 0.9)';
  context.lineWidth = 2;
  context.beginPath();
  if (enemy.type === 'brute') {
    context.moveTo(0, -enemy.radius);
    context.lineTo(enemy.radius * 0.85, -enemy.radius * 0.38);
    context.lineTo(enemy.radius * 0.7, enemy.radius * 0.72);
    context.lineTo(0, enemy.radius);
    context.lineTo(-enemy.radius * 0.7, enemy.radius * 0.72);
    context.lineTo(-enemy.radius * 0.85, -enemy.radius * 0.38);
  } else if (enemy.type === 'needle') {
    context.moveTo(0, -enemy.radius * 1.25);
    context.lineTo(enemy.radius, enemy.radius * 0.82);
    context.lineTo(0, enemy.radius * 0.36);
    context.lineTo(-enemy.radius, enemy.radius * 0.82);
  } else {
    context.moveTo(0, -enemy.radius);
    context.lineTo(enemy.radius, 0);
    context.lineTo(0, enemy.radius);
    context.lineTo(-enemy.radius, 0);
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = enemy.color;
  context.globalAlpha = 0.75;
  context.fillRect(-2, -2, 4, 4);
  context.restore();
}

function drawProjectile(projectile) {
  context.save();
  context.translate(projectile.x, projectile.y);
  context.shadowBlur = 15;
  context.shadowColor = projectile.enemy ? '#fc5ba7' : '#51f4e8';
  context.fillStyle = projectile.enemy ? '#fc5ba7' : '#bffff8';
  context.fillRect(-projectile.radius / 2, -projectile.radius * 2, projectile.radius, projectile.radius * 4);
  context.restore();
}

function drawParticle(particle) {
  context.save();
  context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
  context.fillStyle = particle.color;
  context.shadowBlur = 10;
  context.shadowColor = particle.color;
  context.fillRect(particle.x, particle.y, particle.size, particle.size);
  context.restore();
}

function gameLoop(timestamp) {
  if (!lastFrame) lastFrame = timestamp;
  const delta = Math.min(0.04, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp;
  if (state.phase === 'playing') updateGame(delta);
  else ambientTime += delta * 0.4;
  drawScene();
  requestAnimationFrame(gameLoop);
}

function handleKeyDown(event) {
  if (event.target instanceof HTMLInputElement) return;
  const key = event.key === ' ' ? ' ' : event.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd', ' '].includes(key)) {
    event.preventDefault();
    keys.add(key);
    if (key === ' ' && state.phase === 'ready') startGame();
  }
}

function handleKeyUp(event) {
  keys.delete(event.key === ' ' ? ' ' : event.key);
}

function bindTouchControl(button, control) {
  const release = () => {
    touchState[control] = false;
    button.classList.remove('active');
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    touchState[control] = true;
    button.classList.add('active');
    if (state.phase === 'ready') startGame();
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

function setLeaderboardStatus(message, kind = '') {
  leaderboardStatus.textContent = message;
  leaderboardStatus.className = `leaderboard-status${kind ? ` ${kind}` : ''}`;
}

function renderLeaderboard(rows) {
  leaderboardElement.replaceChildren();
  rows.slice(0, 10).forEach((row) => {
    const item = document.createElement('li');
    item.className = 'leaderboard-row';
    const name = document.createElement('span');
    name.className = 'pilot-name';
    name.textContent = row.player_name;
    const score = document.createElement('span');
    score.className = 'pilot-score';
    score.textContent = formatScore(row.score);
    item.append(name, score);
    leaderboardElement.append(item);
  });
}

async function loadLeaderboard() {
  setLeaderboardStatus('Loading sector records...');
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard?select=player_name,score,created_at&candidate_id=eq.monolith_opencode&order=score.desc,created_at.asc&limit=10`, {
      headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status})`);
    const rows = await response.json();
    renderLeaderboard(rows);
    setLeaderboardStatus(rows.length ? 'Live global standings' : 'No scores yet. Be the first pilot.', rows.length ? '' : 'empty');
  } catch (error) {
    renderLeaderboard([]);
    const empty = document.createElement('li');
    empty.className = 'leaderboard-row empty-row';
    empty.textContent = 'Records are offline. Your run is still playable.';
    leaderboardElement.append(empty);
    setLeaderboardStatus('Unable to reach sector records.', 'error');
    console.warn(error);
  }
}

async function submitScore(event) {
  event.preventDefault();
  const playerName = nameInput.value.trim();
  formMessage.classList.remove('success');
  if (!isValidName(playerName)) {
    formMessage.textContent = 'Use 1-16 letters, numbers, spaces, - or _.';
    nameInput.focus();
    return;
  }
  if (!isPlausibleScore(state.score)) {
    formMessage.textContent = 'That score cannot be transmitted.';
    return;
  }
  submitButton.disabled = true;
  formMessage.textContent = 'Transmitting score...';
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLIC_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLIC_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ candidate_id: 'monolith_opencode', player_name: playerName, score: state.score }),
    });
    if (!response.ok) throw new Error(`Score submission failed (${response.status})`);
    formMessage.textContent = 'Score locked in. Welcome to the record.';
    formMessage.classList.add('success');
    await loadLeaderboard();
  } catch (error) {
    formMessage.textContent = 'Transmission failed. Check your connection and retry.';
    console.warn(error);
  } finally {
    submitButton.disabled = false;
  }
}

function toggleMute() {
  audio.muted = !audio.muted;
  if (!audio.muted) audio.ensure();
  muteButton.classList.toggle('is-muted', audio.muted);
  muteButton.setAttribute('aria-pressed', String(audio.muted));
  muteButton.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound');
  muteLabel.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
}

startButton.addEventListener('click', resetGame);
restartButton.addEventListener('click', resetGame);
muteButton.addEventListener('click', toggleMute);
scoreForm.addEventListener('submit', submitScore);
window.addEventListener('keydown', handleKeyDown, { passive: false });
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('blur', () => {
  keys.clear();
  Object.keys(touchState).forEach((control) => { touchState[control] = false; });
});
document.querySelectorAll('[data-control]').forEach((button) => bindTouchControl(button, button.dataset.control));

window.__NEON_BARRAGE__ = {
  getState: () => ({
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    playerX: state.playerX,
    playerY: state.playerY,
    enemyCount: enemies.length,
    projectileCount: projectiles.length,
  }),
  endGameForTest: (score) => {
    if (!isPlausibleScore(score)) throw new TypeError('Test score must be a non-negative integer.');
    state.score = score;
    setGameOver();
  },
};

updateHud();
loadLeaderboard();
requestAnimationFrame(gameLoop);
