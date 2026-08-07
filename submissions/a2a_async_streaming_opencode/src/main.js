import './styles.css';

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const MAX_NAME_LENGTH = 16;
const PLAYER_RADIUS = 17;
const INITIAL_LIVES = 3;
const LOCAL_SCORE_KEY = 'neon-barrage-local-scores-v1';

const canvas = document.querySelector('[data-testid="game-canvas"]');
const context = canvas.getContext('2d');
const gameStage = document.querySelector('#gameStage');
const startButton = document.querySelector('[data-testid="start-button"]');
const scoreElement = document.querySelector('[data-testid="score"]');
const livesElement = document.querySelector('[data-testid="lives"]');
const levelElement = document.querySelector('#level');
const phaseLabel = document.querySelector('#phaseLabel');
const threatLabel = document.querySelector('#threatLabel');
const runStatus = document.querySelector('#runStatus');
const actionHint = document.querySelector('#actionHint');
const readyOverlay = document.querySelector('#readyOverlay');
const gameOverOverlay = document.querySelector('#gameOverOverlay');
const finalScoreElement = document.querySelector('#finalScore');
const scoreForm = document.querySelector('#scoreForm');
const playerNameInput = document.querySelector('[data-testid="player-name"]');
const submitButton = document.querySelector('[data-testid="submit-score"]');
const submitStatus = document.querySelector('#submitStatus');
const muteButton = document.querySelector('[data-testid="mute-button"]');
const muteLabel = document.querySelector('#muteLabel');
const speakerIcon = document.querySelector('#speakerIcon');
const connectionDot = document.querySelector('#connectionDot');
const connectionLabel = document.querySelector('#connectionLabel');
const leaderboardElement = document.querySelector('[data-testid="leaderboard"]');
const leaderboardCount = document.querySelector('#leaderboardCount');
const refreshLeaderboardButton = document.querySelector('#refreshLeaderboard');
const touchControls = document.querySelector('[data-testid="touch-controls"]');

const publicSupabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const publicSupabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const hasSupabaseConfig = Boolean(publicSupabaseUrl && publicSupabaseKey);

const state = {
  phase: 'ready',
  score: 0,
  lives: INITIAL_LIVES,
  level: 1,
  elapsed: 0,
  visualTime: 0,
  spawnTimer: 0.65,
  fireTimer: 0,
  enemySerial: 0,
  player: {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT - 68,
    invulnerable: 0,
    thrust: 0,
  },
  keys: new Set(),
  touchKeys: new Set(),
  enemies: [],
  projectiles: [],
  particles: [],
  floatingText: [],
  muted: readMutePreference(),
  submitBusy: false,
};

const leaderboardState = {
  status: 'loading',
  entries: [],
  message: '',
};

const audioState = {
  context: null,
};

const stars = Array.from({ length: 96 }, (_, index) => ({
  x: seededRandom(index * 7 + 11) * WORLD_WIDTH,
  y: seededRandom(index * 13 + 19) * WORLD_HEIGHT,
  size: 0.5 + seededRandom(index * 17 + 23) * 1.8,
  speed: 7 + seededRandom(index * 29 + 31) * 25,
  alpha: 0.2 + seededRandom(index * 37 + 41) * 0.7,
}));

function seededRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function readMutePreference() {
  try {
    return window.localStorage.getItem('neon-barrage-muted') === 'true';
  } catch {
    return false;
  }
}

function saveMutePreference(value) {
  try {
    window.localStorage.setItem('neon-barrage-muted', String(value));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

function readLocalScores() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_SCORE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return normalizeEntries(parsed).slice(0, 10);
  } catch {
    return [];
  }
}

function writeLocalScore(entry) {
  const next = [entry, ...readLocalScores()];
  try {
    window.localStorage.setItem(LOCAL_SCORE_KEY, JSON.stringify(normalizeEntries(next).slice(0, 10)));
  } catch {
    // A network-backed leaderboard remains available when storage is blocked.
  }
}

function normalizeEntries(rows) {
  return rows
    .map((row) => ({
      name: String(row?.name ?? row?.player_name ?? '').trim().slice(0, MAX_NAME_LENGTH),
      score: Number(row?.score),
      createdAt: row?.created_at || row?.createdAt || '',
    }))
    .filter((row) => row.name && Number.isSafeInteger(row.score) && row.score >= 0)
    .sort((a, b) => b.score - a.score || String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(0, 10);
}

function formatScore(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function updateMuteUI() {
  const isMuted = state.muted;
  muteButton.setAttribute('aria-pressed', String(isMuted));
  muteButton.setAttribute('aria-label', isMuted ? 'Unmute sound' : 'Mute sound');
  muteLabel.textContent = isMuted ? 'SOUND OFF' : 'SOUND ON';
  speakerIcon.textContent = isMuted ? '--' : ')))';
  muteButton.classList.toggle('is-muted', isMuted);
}

function setConnectionStatus(kind, label) {
  connectionDot.className = `status-dot ${kind}`;
  connectionLabel.textContent = label;
}

function renderGameUI() {
  scoreElement.textContent = formatScore(state.score);
  livesElement.textContent = String(state.lives);
  livesElement.classList.toggle('critical', state.lives === 1);
  levelElement.textContent = String(state.level).padStart(2, '0');
  finalScoreElement.textContent = formatScore(state.score);
  gameStage.dataset.phase = state.phase;

  const phaseCopy = {
    ready: 'STANDBY',
    playing: 'ENGAGED',
    gameover: 'SIGNAL LOST',
  };
  phaseLabel.textContent = phaseCopy[state.phase];
  readyOverlay.hidden = state.phase !== 'ready';
  gameOverOverlay.hidden = state.phase !== 'gameover';
  startButton.hidden = state.phase === 'playing';
  startButton.textContent = state.phase === 'gameover' ? 'RESTART RUN' : 'LAUNCH MISSION';
  actionHint.textContent = state.phase === 'gameover' ? 'RETURN TO THE FRAY' : 'CLICK TO DEPLOY';
  submitButton.disabled = state.phase !== 'gameover' || state.submitBusy;
  if (state.phase === 'playing') {
    threatLabel.textContent = `${state.enemies.length} INBOUND`;
  } else if (state.phase === 'gameover') {
    threatLabel.textContent = 'CHANNEL LOST';
  } else {
    threatLabel.textContent = 'SCANNING';
  }
}

function setRunStatus(message, tone = '') {
  runStatus.textContent = message;
  runStatus.className = `run-status ${tone}`;
}

function setSubmitStatus(message, tone = '') {
  submitStatus.textContent = message;
  submitStatus.className = `form-status ${tone}`;
}

function unlockAudio() {
  if (state.muted || audioState.context) {
    if (audioState.context?.state === 'suspended') {
      void audioState.context.resume().catch(() => {});
    }
    return;
  }

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return;
  try {
    audioState.context = new AudioContextConstructor();
    void audioState.context.resume().catch(() => {});
  } catch {
    audioState.context = null;
  }
}

function playTone(frequency, duration, type = 'sine', volume = 0.035, slideTo = frequency) {
  if (state.muted || !audioState.context || audioState.context.state === 'closed') return;
  const audioContext = audioState.context;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const start = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function resetMission() {
  state.score = 0;
  state.lives = INITIAL_LIVES;
  state.level = 1;
  state.elapsed = 0;
  state.spawnTimer = 0.55;
  state.fireTimer = 0;
  state.player.x = WORLD_WIDTH / 2;
  state.player.y = WORLD_HEIGHT - 68;
  state.player.invulnerable = 0;
  state.player.thrust = 0;
  state.enemies.length = 0;
  state.projectiles.length = 0;
  state.particles.length = 0;
  state.floatingText.length = 0;
  setSubmitStatus('');
}

function startMission() {
  unlockAudio();
  resetMission();
  state.phase = 'playing';
  setRunStatus('Mission live. Keep the sky clear.', 'active');
  playTone(260, 0.16, 'sawtooth', 0.045, 720);
  renderGameUI();
}

function sanitiseTestScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1000000000, Math.floor(numeric)));
}

function finishMission(scoreOverride) {
  if (scoreOverride !== undefined) state.score = sanitiseTestScore(scoreOverride);
  state.phase = 'gameover';
  state.lives = 0;
  state.enemies.length = 0;
  state.projectiles.length = 0;
  state.touchKeys.clear();
  setRunStatus('Mission ended. Transmit your score or relaunch.', 'warning');
  setSubmitStatus('');
  renderGameUI();
  playTone(180, 0.35, 'triangle', 0.05, 55);
}

function createParticle(x, y, options = {}) {
  const angle = options.angle ?? Math.random() * Math.PI * 2;
  const speed = options.speed ?? 50 + Math.random() * 150;
  state.particles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: options.life ?? 0.5,
    maxLife: options.life ?? 0.5,
    size: options.size ?? 2 + Math.random() * 3,
    color: options.color ?? '#59f3ff',
    drag: options.drag ?? 0.95,
  });
}

function burst(x, y, color, count = 12, speed = 150) {
  for (let index = 0; index < count; index += 1) {
    createParticle(x, y, {
      color,
      speed: speed * (0.45 + Math.random() * 0.8),
      size: 1.5 + Math.random() * 3.5,
      life: 0.35 + Math.random() * 0.5,
    });
  }
}

function addFloatingText(text, x, y, color = '#f8fbff') {
  state.floatingText.push({ text, x, y, color, life: 0.8, maxLife: 0.8 });
}

function spawnEnemy() {
  if (state.enemies.length >= 20) return;
  const roll = Math.random();
  let type = 'scout';
  if (state.level >= 3 && roll > 0.72) type = 'weaver';
  if (state.level >= 2 && roll > 0.9) type = 'tank';
  const radius = type === 'tank' ? 25 : type === 'weaver' ? 18 : 15;
  const hp = type === 'tank' ? 3 : type === 'weaver' ? 2 : 1;
  const speed = (type === 'tank' ? 56 : type === 'weaver' ? 92 : 120) + state.level * 7;
  state.enemies.push({
    id: state.enemySerial++,
    type,
    x: 52 + Math.random() * (WORLD_WIDTH - 104),
    y: -radius - Math.random() * 45,
    radius,
    hp,
    maxHp: hp,
    speed,
    age: 0,
    phase: Math.random() * Math.PI * 2,
    shootTimer: type === 'tank' ? 1.2 : 999,
    hitFlash: 0,
  });
}

function firePlayer() {
  if (state.fireTimer > 0) return;
  state.fireTimer = Math.max(0.1, 0.18 - state.level * 0.006);
  const { x, y } = state.player;
  state.projectiles.push({
    kind: 'player',
    x,
    y: y - 24,
    vx: 0,
    vy: -650,
    radius: 4,
    damage: 1,
    color: '#6ef4ff',
  });
  createParticle(x, y - 23, { color: '#dffcff', speed: 40, size: 4, life: 0.16, angle: -Math.PI / 2 });
  playTone(420, 0.055, 'square', 0.018, 250);
}

function fireEnemy(enemy) {
  state.projectiles.push({
    kind: 'enemy',
    x: enemy.x,
    y: enemy.y + enemy.radius,
    vx: Math.sin(enemy.phase) * 38,
    vy: 210 + state.level * 12,
    radius: 5,
    damage: 1,
    color: '#ff5cba',
  });
}

function isPressed(action) {
  return state.keys.has(action) || state.touchKeys.has(action);
}

function updatePlayer(delta) {
  let horizontal = 0;
  let vertical = 0;
  if (isPressed('left')) horizontal -= 1;
  if (isPressed('right')) horizontal += 1;
  if (isPressed('up')) vertical -= 1;
  if (isPressed('down')) vertical += 1;
  const magnitude = Math.hypot(horizontal, vertical) || 1;
  const speed = 310;
  state.player.x += (horizontal / magnitude) * speed * delta;
  state.player.y += (vertical / magnitude) * speed * delta;
  state.player.x = Math.max(PLAYER_RADIUS + 8, Math.min(WORLD_WIDTH - PLAYER_RADIUS - 8, state.player.x));
  state.player.y = Math.max(80, Math.min(WORLD_HEIGHT - PLAYER_RADIUS - 14, state.player.y));
  state.player.thrust = horizontal || vertical ? 1 : Math.max(0, state.player.thrust - delta * 4);
  if (state.player.thrust > 0.1 && Math.random() < delta * 30) {
    createParticle(state.player.x + (Math.random() - 0.5) * 8, state.player.y + 21, {
      color: Math.random() > 0.35 ? '#ff4fb3' : '#ffe66d',
      speed: 25 + Math.random() * 55,
      size: 1.5 + Math.random() * 2.5,
      life: 0.22 + Math.random() * 0.15,
      angle: Math.PI / 2 + (Math.random() - 0.5) * 0.45,
    });
  }
  if (isPressed('fire')) firePlayer();
}

function damagePlayer() {
  if (state.player.invulnerable > 0 || state.phase !== 'playing') return;
  state.lives -= 1;
  state.player.invulnerable = 1.35;
  state.shake = 0.32;
  burst(state.player.x, state.player.y, '#ff5cba', 18, 190);
  addFloatingText('- 1 LIFE', state.player.x, state.player.y - 28, '#ff83c8');
  playTone(130, 0.2, 'sawtooth', 0.04, 60);
  renderGameUI();
  if (state.lives <= 0) finishMission();
}

function updateProjectiles(delta) {
  for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = state.projectiles[index];
    projectile.x += projectile.vx * delta;
    projectile.y += projectile.vy * delta;
    if (projectile.y < -30 || projectile.y > WORLD_HEIGHT + 30 || projectile.x < -30 || projectile.x > WORLD_WIDTH + 30) {
      state.projectiles.splice(index, 1);
      continue;
    }

    if (projectile.kind === 'player') {
      let hit = false;
      for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        const enemy = state.enemies[enemyIndex];
        if (!circlesOverlap(projectile, enemy)) continue;
        enemy.hp -= projectile.damage;
        enemy.hitFlash = 0.12;
        state.projectiles.splice(index, 1);
        hit = true;
        burst(projectile.x, projectile.y, enemy.type === 'tank' ? '#ffe66d' : '#59f3ff', 5, 70);
        if (enemy.hp <= 0) {
          const points = enemy.type === 'tank' ? 180 : enemy.type === 'weaver' ? 110 : 60;
          state.score += points;
          state.level = 1 + Math.floor(state.score / 500);
          burst(enemy.x, enemy.y, enemy.type === 'tank' ? '#ffe66d' : '#ff4fb3', enemy.type === 'tank' ? 24 : 14, 230);
          addFloatingText(`+${points}`, enemy.x, enemy.y - enemy.radius - 8, '#ffe66d');
          playTone(enemy.type === 'tank' ? 180 : 280, 0.12, 'triangle', 0.03, enemy.type === 'tank' ? 70 : 540);
          state.enemies.splice(enemyIndex, 1);
        } else {
          playTone(620, 0.04, 'sine', 0.012, 480);
        }
        break;
      }
      if (hit) renderGameUI();
    } else if (circlesOverlap(projectile, state.player)) {
      state.projectiles.splice(index, 1);
      damagePlayer();
    }
  }
}

function updateEnemies(delta) {
  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    enemy.age += delta;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
    enemy.y += enemy.speed * delta;
    if (enemy.type === 'weaver') {
      enemy.x += Math.sin(enemy.age * 3.4 + enemy.phase) * 74 * delta;
      enemy.x = Math.max(enemy.radius, Math.min(WORLD_WIDTH - enemy.radius, enemy.x));
    }
    if (enemy.type === 'tank') {
      enemy.shootTimer -= delta;
      if (enemy.shootTimer <= 0 && enemy.y > 20) {
        fireEnemy(enemy);
        enemy.shootTimer = Math.max(1.1, 2.6 - state.level * 0.08);
      }
    }
    if (enemy.y > WORLD_HEIGHT + enemy.radius) {
      state.enemies.splice(index, 1);
      damagePlayer();
      continue;
    }
    if (state.player.invulnerable <= 0 && circlesOverlap(enemy, state.player, -3)) {
      state.enemies.splice(index, 1);
      burst(enemy.x, enemy.y, '#ff5cba', 10, 120);
      damagePlayer();
    }
  }
}

function circlesOverlap(first, second, padding = 0) {
  const distanceX = first.x - second.x;
  const distanceY = first.y - second.y;
  const radius = (first.radius || 0) + (second.radius || 0) + padding;
  return distanceX * distanceX + distanceY * distanceY < radius * radius;
}

function updateParticles(delta) {
  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const particle = state.particles[index];
    particle.life -= delta;
    if (particle.life <= 0) {
      state.particles.splice(index, 1);
      continue;
    }
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= particle.drag;
    particle.vy *= particle.drag;
  }
  for (let index = state.floatingText.length - 1; index >= 0; index -= 1) {
    const floating = state.floatingText[index];
    floating.life -= delta;
    floating.y -= 28 * delta;
    if (floating.life <= 0) state.floatingText.splice(index, 1);
  }
}

function updateMission(delta) {
  state.elapsed += delta;
  state.level = Math.max(state.level, 1 + Math.floor(state.elapsed / 18), 1 + Math.floor(state.score / 500));
  state.fireTimer = Math.max(0, state.fireTimer - delta);
  state.player.invulnerable = Math.max(0, state.player.invulnerable - delta);
  state.spawnTimer -= delta;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    if (state.level >= 4 && Math.random() > 0.67) spawnEnemy();
    state.spawnTimer = Math.max(0.28, 1.15 - state.level * 0.07) * (0.75 + Math.random() * 0.35);
  }
  updatePlayer(delta);
  updateEnemies(delta);
  updateProjectiles(delta);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - delta);
  if (Math.floor(state.elapsed * 4) % 2 === 0) renderGameUI();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, rect.width || WORLD_WIDTH);
  const height = Math.max(180, rect.height || width * (WORLD_HEIGHT / WORLD_WIDTH));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.dataset.pixelRatio = String(pixelRatio);
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, '#090a25');
  gradient.addColorStop(0.58, '#11113a');
  gradient.addColorStop(1, '#090b1d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const glow = context.createRadialGradient(WORLD_WIDTH * 0.52, WORLD_HEIGHT * 0.75, 20, WORLD_WIDTH * 0.52, WORLD_HEIGHT * 0.75, 430);
  glow.addColorStop(0, 'rgba(47, 217, 255, 0.13)');
  glow.addColorStop(0.48, 'rgba(98, 53, 206, 0.07)');
  glow.addColorStop(1, 'rgba(9, 10, 30, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  context.save();
  context.globalAlpha = 0.46;
  context.strokeStyle = '#3e3d86';
  context.lineWidth = 1;
  for (let x = 0; x <= WORLD_WIDTH; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, WORLD_HEIGHT);
    context.stroke();
  }
  for (let y = 24; y <= WORLD_HEIGHT; y += 42) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD_WIDTH, y);
    context.stroke();
  }
  context.globalAlpha = 0.75;
  context.strokeStyle = '#4eebfa';
  context.beginPath();
  context.moveTo(0, WORLD_HEIGHT - 30);
  context.lineTo(WORLD_WIDTH, WORLD_HEIGHT - 30);
  context.stroke();
  context.restore();

  for (const star of stars) {
    const y = (star.y + state.visualTime * star.speed) % WORLD_HEIGHT;
    context.globalAlpha = star.alpha;
    context.fillStyle = star.size > 1.7 ? '#e5f9ff' : '#8e9aff';
    context.fillRect(star.x, y, star.size, star.size);
  }
  context.globalAlpha = 1;

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = '#ff4fb3';
  context.setLineDash([2, 10]);
  context.beginPath();
  context.arc(WORLD_WIDTH * 0.5, WORLD_HEIGHT + 120, 330, Math.PI * 1.12, Math.PI * 1.88);
  context.stroke();
  context.restore();
}

function drawPlayer() {
  const player = state.player;
  if (state.phase === 'playing' && player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0) return;
  const bob = state.phase === 'playing' ? Math.sin(state.visualTime * 5) * 1.5 : Math.sin(state.visualTime * 2.5) * 3;
  const x = player.x;
  const y = player.y + bob;
  context.save();
  context.translate(x, y);
  context.shadowColor = '#5bf4ff';
  context.shadowBlur = 22;
  context.fillStyle = '#58ecff';
  context.beginPath();
  context.moveTo(0, -25);
  context.lineTo(20, 17);
  context.lineTo(7, 12);
  context.lineTo(0, 23);
  context.lineTo(-7, 12);
  context.lineTo(-20, 17);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = '#12183d';
  context.beginPath();
  context.moveTo(0, -15);
  context.lineTo(8, 8);
  context.lineTo(0, 5);
  context.lineTo(-8, 8);
  context.closePath();
  context.fill();
  context.strokeStyle = '#f5feff';
  context.lineWidth = 1.4;
  context.stroke();
  context.fillStyle = '#ff4fb3';
  context.fillRect(-15, 13, 8, 3);
  context.fillRect(7, 13, 8, 3);
  context.globalAlpha = 0.8;
  context.fillStyle = '#ffe66d';
  context.beginPath();
  context.moveTo(-5, 20);
  context.lineTo(0, 30 + player.thrust * 10);
  context.lineTo(5, 20);
  context.fill();
  context.restore();
}

function drawEnemy(enemy) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(enemy.type === 'weaver' ? Math.sin(enemy.age * 4 + enemy.phase) * 0.2 : 0);
  context.shadowBlur = enemy.hitFlash > 0 ? 28 : 16;
  context.shadowColor = enemy.type === 'tank' ? '#ffe66d' : '#ff4fb3';
  context.fillStyle = enemy.hitFlash > 0 ? '#f7ffff' : enemy.type === 'tank' ? '#ffe66d' : '#ff4fb3';
  if (enemy.type === 'tank') {
    context.beginPath();
    context.moveTo(0, -enemy.radius);
    context.lineTo(enemy.radius, -enemy.radius * 0.35);
    context.lineTo(enemy.radius * 0.75, enemy.radius * 0.72);
    context.lineTo(0, enemy.radius);
    context.lineTo(-enemy.radius * 0.75, enemy.radius * 0.72);
    context.lineTo(-enemy.radius, -enemy.radius * 0.35);
    context.closePath();
    context.fill();
    context.fillStyle = '#221b45';
    context.fillRect(-7, -5, 14, 10);
    context.strokeStyle = '#fff1a5';
    context.lineWidth = 2;
    context.strokeRect(-7, -5, 14, 10);
  } else {
    context.beginPath();
    context.moveTo(0, -enemy.radius);
    context.lineTo(enemy.radius, 0);
    context.lineTo(0, enemy.radius);
    context.lineTo(-enemy.radius, 0);
    context.closePath();
    context.fill();
    context.fillStyle = '#22163b';
    context.beginPath();
    context.arc(0, 0, enemy.radius * 0.36, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffd8f0';
    context.lineWidth = 1.3;
    context.stroke();
    context.strokeStyle = enemy.type === 'weaver' ? '#8c7dff' : '#ffb8de';
    context.beginPath();
    context.moveTo(-enemy.radius - 5, 0);
    context.lineTo(enemy.radius + 5, 0);
    context.stroke();
  }
  context.restore();
}

function drawProjectiles() {
  for (const projectile of state.projectiles) {
    context.save();
    context.strokeStyle = projectile.color;
    context.fillStyle = projectile.color;
    context.shadowColor = projectile.color;
    context.shadowBlur = 15;
    context.lineWidth = projectile.kind === 'player' ? 3 : 4;
    context.beginPath();
    context.moveTo(projectile.x, projectile.y);
    context.lineTo(projectile.x - projectile.vx * 0.018, projectile.y - projectile.vy * 0.018);
    context.stroke();
    context.beginPath();
    context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawParticles() {
  for (const particle of state.particles) {
    context.save();
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color;
    context.shadowColor = particle.color;
    context.shadowBlur = 10;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  for (const floating of state.floatingText) {
    context.save();
    context.globalAlpha = Math.max(0, floating.life / floating.maxLife);
    context.fillStyle = floating.color;
    context.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.textAlign = 'center';
    context.shadowColor = floating.color;
    context.shadowBlur = 10;
    context.fillText(floating.text, floating.x, floating.y);
    context.restore();
  }
}

function draw() {
  if (!canvas.width || !canvas.height) return;
  const scaleX = canvas.width / WORLD_WIDTH;
  const scaleY = canvas.height / WORLD_HEIGHT;
  context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.save();
  if (state.shake > 0) {
    context.translate((Math.random() - 0.5) * state.shake * 10, (Math.random() - 0.5) * state.shake * 10);
  }
  drawBackground();
  drawParticles();
  drawProjectiles();
  for (const enemy of state.enemies) drawEnemy(enemy);
  drawPlayer();
  context.restore();
}

function frame(timestamp) {
  if (!frame.lastTimestamp) frame.lastTimestamp = timestamp;
  const delta = Math.min(0.04, Math.max(0, (timestamp - frame.lastTimestamp) / 1000));
  frame.lastTimestamp = timestamp;
  state.visualTime += delta;
  if (state.phase === 'playing') updateMission(delta);
  updateParticles(delta);
  draw();
  requestAnimationFrame(frame);
}

function renderLeaderboard() {
  leaderboardElement.replaceChildren();
  leaderboardCount.textContent = leaderboardState.entries.length ? `TOP ${leaderboardState.entries.length}` : 'TOP 10';

  if (leaderboardState.status === 'loading') {
    const loading = document.createElement('div');
    loading.className = 'leaderboard-state loading-state';
    loading.innerHTML = '<span class="loading-bar"></span><span class="loading-bar short"></span><span class="loading-bar"></span>';
    leaderboardElement.append(loading);
    return;
  }

  if (!leaderboardState.entries.length) {
    const empty = document.createElement('div');
    empty.className = 'leaderboard-state empty-state';
    empty.innerHTML = '<span class="empty-mark">+</span><strong>NO SIGNALS YET</strong><p>Be the first pilot on the channel.</p>';
    leaderboardElement.append(empty);
    if (leaderboardState.status === 'error' || leaderboardState.status === 'offline') {
      const note = document.createElement('p');
      note.className = `leaderboard-note ${leaderboardState.status}`;
      note.textContent = leaderboardState.message;
      leaderboardElement.append(note);
    }
    return;
  }

  const list = document.createElement('ol');
  list.className = 'leaderboard-list';
  leaderboardState.entries.forEach((entry, index) => {
    const row = document.createElement('li');
    row.className = `leaderboard-row ${index === 0 ? 'top-row' : ''}`;
    const rank = document.createElement('span');
    rank.className = 'leaderboard-rank';
    rank.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('span');
    name.className = 'leaderboard-name';
    name.textContent = entry.name;
    const score = document.createElement('span');
    score.className = 'leaderboard-score';
    score.textContent = formatScore(entry.score);
    row.append(rank, name, score);
    list.append(row);
  });
  leaderboardElement.append(list);

  if (leaderboardState.status === 'error' || leaderboardState.status === 'offline') {
    const note = document.createElement('p');
    note.className = `leaderboard-note ${leaderboardState.status}`;
    note.textContent = leaderboardState.message;
    leaderboardElement.append(note);
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(details || `Request failed (${response.status})`);
    }
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function supabaseHeaders(includeJson = false) {
  return {
    apikey: publicSupabaseKey,
    Authorization: `Bearer ${publicSupabaseKey}`,
    ...(includeJson ? { 'Content-Type': 'application/json', Prefer: 'return=representation' } : {}),
  };
}

async function loadLeaderboard() {
  leaderboardState.status = 'loading';
  leaderboardState.message = '';
  renderLeaderboard();

  if (!hasSupabaseConfig) {
    leaderboardState.entries = readLocalScores();
    leaderboardState.status = 'offline';
    leaderboardState.message = 'Local channel only. Add the public API config to sync scores.';
    setConnectionStatus('offline', 'LOCAL ARCADE MODE');
    renderLeaderboard();
    return;
  }

  setConnectionStatus('syncing', 'SYNCING SCORE CHANNEL');
  try {
    const query = '?select=player_name,score,created_at&order=score.desc,created_at.asc&limit=10';
    const rows = await fetchJson(`${publicSupabaseUrl}/rest/v1/leaderboard${query}`, {
      headers: supabaseHeaders(),
    });
    leaderboardState.entries = normalizeEntries(Array.isArray(rows) ? rows : []);
    leaderboardState.status = leaderboardState.entries.length ? 'ready' : 'empty';
    setConnectionStatus('ready', 'ARCADE LINK LIVE');
  } catch (error) {
    leaderboardState.entries = [];
    leaderboardState.status = 'error';
    leaderboardState.message = error?.name === 'AbortError' ? 'Channel timed out. Try a refresh.' : 'Channel unavailable. The arcade remains playable.';
    setConnectionStatus('error', 'LINK DEGRADED');
  }
  renderLeaderboard();
}

function validateName(rawName) {
  const name = rawName.trim().replace(/\s+/g, ' ');
  const characterCount = Array.from(name).length;
  if (!characterCount) return { error: 'Enter a pilot tag before transmitting.' };
  if (characterCount > MAX_NAME_LENGTH) return { error: `Pilot tags are limited to ${MAX_NAME_LENGTH} characters.` };
  if ([...name].some((character) => character.charCodeAt(0) < 32)) return { error: 'Use visible characters only.' };
  return { name };
}

async function submitScore(event) {
  event.preventDefault();
  if (state.phase !== 'gameover' || state.submitBusy) return;
  unlockAudio();
  const validation = validateName(playerNameInput.value);
  if (validation.error) {
    setSubmitStatus(validation.error, 'error');
    playerNameInput.focus();
    return;
  }

  state.submitBusy = true;
  submitButton.disabled = true;
  submitButton.textContent = 'SENDING...';
  setSubmitStatus('Opening the score channel...', 'active');
  const entry = { name: validation.name, score: sanitiseTestScore(state.score), createdAt: new Date().toISOString() };

  try {
    if (!hasSupabaseConfig) {
      writeLocalScore(entry);
      leaderboardState.entries = readLocalScores();
      leaderboardState.status = 'offline';
      leaderboardState.message = 'Saved on this device. Public sync is not configured.';
      setConnectionStatus('offline', 'LOCAL ARCADE MODE');
      renderLeaderboard();
      setSubmitStatus('Saved locally. Connect the public channel to share it.', 'success');
    } else {
      await fetchJson(`${publicSupabaseUrl}/rest/v1/leaderboard`, {
        method: 'POST',
        headers: supabaseHeaders(true),
        body: JSON.stringify({ player_name: entry.name, score: entry.score }),
      });
      setSubmitStatus('Score secured. Updating the channel...', 'success');
      await loadLeaderboard();
      setSubmitStatus('Score secured on the public channel.', 'success');
      playTone(620, 0.16, 'triangle', 0.035, 980);
    }
  } catch (error) {
    setSubmitStatus(error?.name === 'AbortError' ? 'The channel timed out. Try again.' : 'Transmission failed. Try again when the link stabilizes.', 'error');
    setConnectionStatus('error', 'LINK DEGRADED');
  } finally {
    state.submitBusy = false;
    submitButton.disabled = false;
    submitButton.textContent = 'TRANSMIT';
  }
}

function handleKeyDown(event) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target?.isContentEditable) return;
  const key = event.key.toLowerCase();
  const keyMap = {
    arrowleft: 'left',
    a: 'left',
    arrowright: 'right',
    d: 'right',
    arrowup: 'up',
    w: 'up',
    arrowdown: 'down',
    s: 'down',
    ' ': 'fire',
  };
  const action = keyMap[key];
  if (!action) return;
  event.preventDefault();
  state.keys.add(action);
  if (state.phase === 'ready' && action === 'fire') startMission();
  if (state.phase === 'playing') unlockAudio();
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  const keyMap = {
    arrowleft: 'left',
    a: 'left',
    arrowright: 'right',
    d: 'right',
    arrowup: 'up',
    w: 'up',
    arrowdown: 'down',
    s: 'down',
    ' ': 'fire',
  };
  const action = keyMap[key];
  if (action) state.keys.delete(action);
}

function bindTouchControl(button) {
  const action = button.dataset.control;
  const press = (event) => {
    event.preventDefault();
    unlockAudio();
    state.touchKeys.add(action);
    button.classList.add('is-pressed');
    if (button.setPointerCapture && event.pointerId !== undefined) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional on older mobile browsers.
      }
    }
  };
  const release = (event) => {
    event.preventDefault();
    state.touchKeys.delete(action);
    button.classList.remove('is-pressed');
  };
  button.addEventListener('pointerdown', press, { passive: false });
  button.addEventListener('pointerup', release, { passive: false });
  button.addEventListener('pointercancel', release, { passive: false });
  button.addEventListener('pointerleave', release, { passive: false });
}

function toggleMute() {
  state.muted = !state.muted;
  saveMutePreference(state.muted);
  updateMuteUI();
  if (!state.muted) {
    unlockAudio();
    playTone(520, 0.08, 'sine', 0.025, 700);
  }
}

startButton.addEventListener('click', startMission);
muteButton.addEventListener('click', toggleMute);
scoreForm.addEventListener('submit', submitScore);
refreshLeaderboardButton.addEventListener('click', () => {
  unlockAudio();
  void loadLeaderboard();
});
window.addEventListener('keydown', handleKeyDown, { passive: false });
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('blur', () => {
  state.keys.clear();
  state.touchKeys.clear();
  document.querySelectorAll('.touch-button, .touch-fire').forEach((button) => button.classList.remove('is-pressed'));
});
window.addEventListener('resize', resizeCanvas);
touchControls.querySelectorAll('[data-control]').forEach(bindTouchControl);

updateMuteUI();
renderGameUI();
resizeCanvas();
renderLeaderboard();
void loadLeaderboard();

window.__NEON_BARRAGE__ = {
  getState: () => ({
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    playerX: state.player.x,
    playerY: state.player.y,
    enemyCount: state.enemies.length,
    projectileCount: state.projectiles.length,
  }),
  endGameForTest: (score) => {
    finishMission(sanitiseTestScore(score));
  },
};

requestAnimationFrame(frame);
