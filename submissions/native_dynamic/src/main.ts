import { LeaderboardClient, validatePlayerName, validateScore } from './leaderboard';
import { circlesOverlap, clamp, formatScore } from './game-math';

type Phase = 'ready' | 'playing' | 'paused' | 'gameover';
type Vec = { x: number; y: number };
type Enemy = Vec & { radius: number; speed: number; hue: number; phase: number; worth: number };
type Projectile = Vec & { radius: number; speed: number; hue: number };
type Particle = Vec & { vx: number; vy: number; life: number; maxLife: number; size: number; hue: number };

declare global {
  interface Window {
    __NEON_BARRAGE__?: {
      getState: () => {
        phase: Phase;
        score: number;
        lives: number;
        playerX: number;
        playerY: number;
        enemyCount: number;
        projectileCount: number;
      };
      endGameForTest: (score: number) => void;
    };
  }
}

const WIDTH = 960;
const HEIGHT = 640;
const PLAYER_RADIUS = 20;
const MAX_LIVES = 3;
const MAX_SCORE = 999_999_999;

const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]')!;
const startButton = document.querySelector<HTMLButtonElement>('[data-testid="start-button"]')!;
const scoreDisplay = document.querySelector<HTMLElement>('[data-testid="score"]')!;
const livesDisplay = document.querySelector<HTMLElement>('[data-testid="lives"]')!;
const livesCount = livesDisplay?.querySelector<HTMLElement>('.lives-count');
const lifePips = livesDisplay ? Array.from(livesDisplay.querySelectorAll<HTMLElement>('.life-pips i')) : [];
const muteButton = document.querySelector<HTMLButtonElement>('[data-testid="mute-button"]')!;
const leaderboardList = document.querySelector<HTMLOListElement>('[data-testid="leaderboard"]')!;
const playerNameInput = document.querySelector<HTMLInputElement>('[data-testid="player-name"]')!;
const submitButton = document.querySelector<HTMLButtonElement>('[data-testid="submit-score"]')!;
const touchControls = document.querySelector<HTMLElement>('[data-testid="touch-controls"]');
const overlay = document.querySelector<HTMLElement>('#game-over-panel');
const overlayEyebrow = overlay?.querySelector<HTMLElement>('.game-over-kicker');
const overlayTitle = overlay?.querySelector<HTMLElement>('h2');
const overlayCopy = overlay?.querySelector<HTMLElement>('.game-over-copy');
const overlayHint = overlay?.querySelector<HTMLElement>('#name-help');
const scorePanel = overlay;
const finalScore = document.querySelector<HTMLElement>('#final-score');
const scoreForm = document.querySelector<HTMLFormElement>('.score-form')!;
const restartButton = document.querySelector<HTMLButtonElement>('#restart-button');
const nameError = document.querySelector<HTMLElement>('#name-error');
const submitStatus = document.querySelector<HTMLElement>('#submit-status');
const inputCount = document.querySelector<HTMLElement>('.input-count');
const networkStatus = document.querySelector<HTMLElement>('#network-status');
const retryLeaderboard = document.querySelector<HTMLButtonElement>('[data-action="retry-leaderboard"]');
const loadingCard = document.querySelector<HTMLElement>('[data-state="loading"]');
const errorCard = document.querySelector<HTMLElement>('[data-state="error"]');
const emptyCard = document.querySelector<HTMLElement>('[data-state="empty"]');

if (!canvas || !startButton || !scoreDisplay || !livesDisplay || !muteButton || !leaderboardList || !playerNameInput || !submitButton || !scoreForm) {
  throw new Error('Neon Barrage could not find its required interface.');
}

const context = canvas.getContext('2d');
if (!context) throw new Error('Neon Barrage requires a 2D canvas context.');
context.imageSmoothingEnabled = true;

const ctx = context;
const keys = new Set<string>();
const touchDirections = new Set<string>();
const enemies: Enemy[] = [];
const projectiles: Projectile[] = [];
const particles: Particle[] = [];
const stars = Array.from({ length: 92 }, (_, index) => ({
  x: (index * 137.7 + 41) % WIDTH,
  y: (index * 83.1 + 19) % HEIGHT,
  radius: 0.6 + (index % 4) * 0.45,
  alpha: 0.25 + (index % 5) * 0.1,
  drift: 2 + (index % 7),
}));

let phase: Phase = 'ready';
let score = 0;
let lives = MAX_LIVES;
let playerX = WIDTH / 2;
let playerY = HEIGHT - 78;
let elapsed = 0;
let spawnClock = 0;
let fireClock = 0;
let lastFrame = performance.now();
let muted = false;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
const leaderboard = new LeaderboardClient();

function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (element) element.hidden = hidden;
}

function updateHud(): void {
  scoreDisplay.textContent = formatScore(score);
  livesCount?.replaceChildren(document.createTextNode(String(lives)));
  lifePips.forEach((pip, index) => pip.classList.toggle('is-spent', index >= lives));
}

function getState() {
  return {
    phase,
    score,
    lives,
    playerX: Math.round(playerX),
    playerY: Math.round(playerY),
    enemyCount: enemies.length,
    projectileCount: projectiles.length,
  };
}

function ensureAudio(): void {
  if (muted || audioContext) return;
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  audioContext = new AudioCtor();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.08;
  masterGain.connect(audioContext.destination);
}

function tone(frequency: number, duration: number, type: OscillatorType = 'sine', slide = 0): void {
  if (muted) return;
  if (!audioContext || !masterGain) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(masterGain);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function toggleMute(): void {
  muted = !muted;
  if (!muted) ensureAudio();
  if (masterGain && audioContext) masterGain.gain.setTargetAtTime(muted ? 0 : 0.08, audioContext.currentTime, 0.03);
  muteButton.setAttribute('aria-pressed', String(muted));
  muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  const label = muteButton.querySelector<HTMLElement>('.icon-button__label');
  if (label) label.textContent = muted ? 'Sound off' : 'Sound on';
}

function burst(x: number, y: number, hue: number, amount = 14): void {
  for (let index = 0; index < amount; index += 1) {
    const angle = (Math.PI * 2 * index) / amount + Math.random() * 0.3;
    const speed = 30 + Math.random() * 120;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45 + Math.random() * 0.45,
      maxLife: 0.9,
      size: 1.5 + Math.random() * 3,
      hue,
    });
  }
}

function resetRun(): void {
  phase = 'playing';
  score = 0;
  lives = MAX_LIVES;
  playerX = WIDTH / 2;
  playerY = HEIGHT - 78;
  elapsed = 0;
  spawnClock = 500;
  fireClock = 0;
  enemies.length = 0;
  projectiles.length = 0;
  particles.length = 0;
  keys.clear();
  touchDirections.clear();
  setHidden(overlay, true);
  setHidden(scorePanel, true);
  setHidden(nameError, true);
  if (submitStatus) submitStatus.textContent = '';
  playerNameInput.value = '';
  updateInputCount();
  updateHud();
  networkStatus && (networkStatus.textContent = 'Live grid');
  tone(330, 0.12, 'triangle', 260);
}

function showGameOver(): void {
  phase = 'gameover';
  keys.clear();
  touchDirections.clear();
  setHidden(overlay, false);
  if (overlay) overlay.dataset.screen = 'gameover';
  if (overlayEyebrow) overlayEyebrow.textContent = 'Signal lost // run complete';
  if (overlayTitle) overlayTitle.textContent = 'Barrage ended';
  if (overlayCopy) overlayCopy.textContent = `You held the line for ${Math.max(1, Math.floor(elapsed))} seconds. Archive the run or launch again.`;
  if (overlayHint) overlayHint.textContent = 'Tip: keep moving to turn enemy formations into openings.';
  const buttonLabel = startButton.querySelector('span');
  if (buttonLabel) buttonLabel.textContent = 'Start new run';
  const keyHint = startButton.querySelector('.primary-button__key');
  if (keyHint) keyHint.textContent = 'Enter';
  setHidden(scorePanel, false);
  if (finalScore) finalScore.textContent = formatScore(score);
  playerNameInput.focus({ preventScroll: true });
  tone(170, 0.4, 'sawtooth', -100);
}

function endGameForTest(testScore: number): void {
  if (!Number.isSafeInteger(testScore) || testScore < 0 || testScore > MAX_SCORE) return;
  score = testScore;
  lives = 0;
  enemies.length = 0;
  projectiles.length = 0;
  burst(playerX, playerY, 188, 20);
  showGameOver();
  updateHud();
}

function spawnEnemy(): void {
  const level = Math.floor(elapsed / 18);
  const radius = 16 + Math.random() * 9;
  enemies.push({
    x: 52 + Math.random() * (WIDTH - 104),
    y: -radius - 12,
    radius,
    speed: 44 + level * 11 + Math.random() * 22,
    hue: Math.random() > 0.5 ? 330 : 188,
    phase: Math.random() * Math.PI * 2,
    worth: 80 + level * 25,
  });
}

function fire(): void {
  if (phase !== 'playing' || fireClock > 0) return;
  fireClock = 170;
  projectiles.push({ x: playerX, y: playerY - 24, radius: 5, speed: 560, hue: 68 });
  burst(playerX, playerY - 25, 68, 3);
  tone(480, 0.07, 'square', 160);
}

function damagePlayer(enemy: Enemy): void {
  lives = Math.max(0, lives - 1);
  burst(playerX, playerY, 24, 22);
  tone(90, 0.22, 'sawtooth', -35);
  updateHud();
  if (lives === 0) showGameOver();
  else enemy.y = HEIGHT + enemy.radius + 1;
}

function update(dt: number): void {
  if (phase !== 'playing') return;
  elapsed += dt;
  fireClock = Math.max(0, fireClock - dt * 1000);
  const movement = new Set([...keys, ...touchDirections]);
  const dx = Number(movement.has('ArrowRight') || movement.has('d')) - Number(movement.has('ArrowLeft') || movement.has('a'));
  const dy = Number(movement.has('ArrowDown') || movement.has('s')) - Number(movement.has('ArrowUp') || movement.has('w'));
  const length = Math.hypot(dx, dy) || 1;
  const speed = 315 * dt;
  playerX = clamp(playerX + (dx / length) * speed, 34, WIDTH - 34);
  playerY = clamp(playerY + (dy / length) * speed, 48, HEIGHT - 42);
  if (movement.has(' ') || movement.has('Space')) fire();

  spawnClock -= dt * 1000;
  const spawnInterval = Math.max(250, 920 - elapsed * 7);
  if (spawnClock <= 0) {
    spawnEnemy();
    if (elapsed > 26 && Math.random() > 0.7) spawnEnemy();
    spawnClock = spawnInterval;
  }

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.y -= projectile.speed * dt;
    if (projectile.y < -30) projectiles.splice(index, 1);
  }

  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const enemy = enemies[index];
    enemy.y += enemy.speed * dt;
    enemy.x += Math.sin(elapsed * 1.7 + enemy.phase) * 10 * dt;
    let destroyed = false;
    for (let shotIndex = projectiles.length - 1; shotIndex >= 0; shotIndex -= 1) {
      const projectile = projectiles[shotIndex];
      if (circlesOverlap(projectile.x, projectile.y, projectile.radius, enemy.x, enemy.y, enemy.radius)) {
        projectiles.splice(shotIndex, 1);
        enemies.splice(index, 1);
        score = Math.min(MAX_SCORE, score + enemy.worth);
        burst(enemy.x, enemy.y, enemy.hue, 16);
        tone(220 + (score % 4) * 60, 0.08, 'triangle', 90);
        updateHud();
        destroyed = true;
        break;
      }
    }
    if (destroyed) continue;
    if (circlesOverlap(playerX, playerY, PLAYER_RADIUS, enemy.x, enemy.y, enemy.radius * 0.8)) {
      enemies.splice(index, 1);
      damagePlayer(enemy);
    } else if (enemy.y > HEIGHT + enemy.radius) {
      enemies.splice(index, 1);
      damagePlayer(enemy);
    }
  }

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(index, 1);
  }
}

function drawBackground(now: number): void {
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, '#090b20');
  background.addColorStop(0.52, '#10132d');
  background.addColorStop(1, '#180b24');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  stars.forEach((star) => {
    const y = (star.y + now * star.drift * 0.002) % HEIGHT;
    ctx.fillStyle = `rgba(182, 224, 255, ${star.alpha * (0.72 + Math.sin(now * 0.002 + star.x) * 0.28)})`;
    ctx.beginPath();
    ctx.arc(star.x, y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(120, 220, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 16; y <= HEIGHT; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.9, 20, WIDTH / 2, HEIGHT * 0.9, WIDTH * 0.7);
  glow.addColorStop(0, 'rgba(255, 72, 190, 0.16)');
  glow.addColorStop(1, 'rgba(255, 72, 190, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
}

function drawPlayer(now: number): void {
  const pulse = 0.7 + Math.sin(now * 0.006) * 0.15;
  ctx.save();
  ctx.translate(playerX, playerY);
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowBlur = 24;
  ctx.shadowColor = '#62f8ff';
  ctx.fillStyle = `rgba(98, 248, 255, ${0.22 * pulse})`;
  ctx.beginPath();
  ctx.arc(0, 4, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#72faff';
  ctx.fillStyle = '#0c213a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(22, 20);
  ctx.lineTo(0, 13);
  ctx.lineTo(-22, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff56cf';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(6, 7);
  ctx.lineTo(0, 4);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff7a1';
  ctx.beginPath();
  ctx.arc(0, -8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemies(now: number): void {
  enemies.forEach((enemy) => {
    const wobble = Math.sin(now * 0.004 + enemy.phase) * 3;
    ctx.save();
    ctx.translate(enemy.x, enemy.y + wobble);
    ctx.rotate(now * 0.0007 + enemy.phase);
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 18;
    ctx.shadowColor = `hsl(${enemy.hue} 100% 66%)`;
    ctx.fillStyle = `hsla(${enemy.hue}, 95%, 54%, 0.22)`;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `hsl(${enemy.hue} 100% 72%)`;
    ctx.fillStyle = `hsla(${enemy.hue}, 80%, 18%, 0.9)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius);
    ctx.lineTo(enemy.radius, 0);
    ctx.lineTo(0, enemy.radius);
    ctx.lineTo(-enemy.radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff4ff';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  });
}

function drawProjectiles(): void {
  projectiles.forEach((projectile) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#f6ff72';
    ctx.strokeStyle = '#f6ff72';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(projectile.x, projectile.y + 13);
    ctx.lineTo(projectile.x, projectile.y - 10);
    ctx.stroke();
    ctx.restore();
  });
}

function drawParticles(): void {
  particles.forEach((particle) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = `hsl(${particle.hue} 100% 70%)`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.restore();
  });
}

function draw(now: number): void {
  drawBackground(now);
  drawProjectiles();
  drawEnemies(now);
  drawParticles();
  drawPlayer(now);
  if (phase === 'ready' || phase === 'gameover') {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 18, 0.13)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();
  }
}

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  update(dt);
  draw(now);
  requestAnimationFrame(frame);
}

function updateInputCount(): void {
  if (inputCount) inputCount.textContent = `${Array.from(playerNameInput.value).length}/16`;
}

function showLeaderboardState(state: 'loading' | 'error' | 'empty' | 'success'): void {
  setHidden(loadingCard, state !== 'loading');
  setHidden(errorCard, state !== 'error');
  setHidden(emptyCard, state !== 'empty');
  setHidden(leaderboardList, state !== 'success');
}

function renderLeaderboard(entries: { name: string; score: number }[]): void {
  leaderboardList.replaceChildren();
  entries.slice(0, 10).forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'leaderboard__row';
    const rank = document.createElement('span');
    rank.className = 'leaderboard__rank';
    rank.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('span');
    name.className = 'leaderboard__name';
    name.textContent = entry.name;
    const value = document.createElement('strong');
    value.className = 'leaderboard__score';
    value.textContent = formatScore(entry.score);
    item.append(rank, name, value);
    leaderboardList.append(item);
  });
}

async function loadLeaderboard(): Promise<void> {
  showLeaderboardState('loading');
  const result = await leaderboard.loadTopScores();
  if (networkStatus) networkStatus.textContent = result.mode === 'supabase' && result.status !== 'error' ? 'Live grid' : 'Local archive';
  if (result.status === 'error') {
    if (errorCard) {
      const message = errorCard.querySelector('span:not(.status-icon)');
      if (message) message.textContent = 'Records are offline. You can still play.';
    }
    if (result.entries.length) {
      renderLeaderboard(result.entries);
      setHidden(loadingCard, true);
      setHidden(errorCard, false);
      setHidden(emptyCard, true);
    } else showLeaderboardState('error');
    return;
  }
  if (result.status === 'empty') {
    showLeaderboardState('empty');
    return;
  }
  renderLeaderboard(result.entries);
  showLeaderboardState('success');
}

function updateNameError(message: string | null): void {
  setHidden(nameError, !message);
  if (nameError && message) nameError.textContent = message;
  playerNameInput.setAttribute('aria-invalid', String(Boolean(message)));
}

function handleScoreSubmit(event: SubmitEvent): void {
  event.preventDefault();
  const name = validatePlayerName(playerNameInput.value);
  const validScore = validateScore(score);
  if (!name.ok) {
    updateNameError(name.message);
    playerNameInput.focus();
    return;
  }
  if (!validScore.ok) {
    updateNameError(validScore.message);
    return;
  }
  updateNameError(null);
  submitButton.disabled = true;
  if (submitStatus) submitStatus.textContent = 'Transmitting to the global grid…';
  void leaderboard.submitScore(name.value as string, validScore.value as number).then(async (result) => {
    if (result.status === 'error') {
      submitButton.disabled = false;
      if (submitStatus) submitStatus.textContent = result.message ?? 'The archive is unavailable. Try again.';
      return;
    }
    if (submitStatus) submitStatus.textContent = 'Score archived. Your signal is live.';
    submitButton.disabled = false;
    await loadLeaderboard();
  });
}

function setTouchDirection(direction: string, active: boolean): void {
  if (active) touchDirections.add(direction);
  else touchDirections.delete(direction);
}

function bindTouchControls(): void {
  if (!touchControls) return;
  touchControls.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach((button) => {
    const direction = button.dataset.direction;
    if (!direction) return;
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[direction];
    if (!key) return;
    const release = (): void => setTouchDirection(key, false);
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      ensureAudio();
      setTouchDirection(key, true);
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
  });
  const fireButton = touchControls.querySelector<HTMLButtonElement>('[data-action="fire"]');
  fireButton?.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    ensureAudio();
    touchDirections.add(' ');
    fire();
    fireButton.setPointerCapture?.(event.pointerId);
  });
  const releaseFire = (): void => {
    touchDirections.delete(' ');
  };
  fireButton?.addEventListener('pointerup', releaseFire);
  fireButton?.addEventListener('pointercancel', releaseFire);
  fireButton?.addEventListener('pointerleave', releaseFire);
}

startButton.addEventListener('click', () => {
  ensureAudio();
  resetRun();
});
restartButton?.addEventListener('click', () => {
  ensureAudio();
  resetRun();
});
muteButton.addEventListener('click', toggleMute);
scoreForm.addEventListener('submit', handleScoreSubmit);
playerNameInput.addEventListener('input', () => {
  updateInputCount();
  updateNameError(null);
});
retryLeaderboard?.addEventListener('click', () => void loadLeaderboard());

window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (phase === 'ready' || phase === 'gameover') && document.activeElement !== playerNameInput) {
    event.preventDefault();
    ensureAudio();
    resetRun();
    return;
  }
  if (event.key === 'Escape' && (phase === 'playing' || phase === 'paused')) {
    phase = phase === 'playing' ? 'paused' : 'playing';
    setHidden(document.querySelector<HTMLElement>('[data-state="paused"]'), phase !== 'paused');
    return;
  }
  if (phase !== 'playing') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space', 'w', 'a', 's', 'd'].includes(event.key)) {
    event.preventDefault();
    keys.add(event.key);
    ensureAudio();
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.key));
window.addEventListener('blur', () => {
  keys.clear();
  touchDirections.clear();
});

window.__NEON_BARRAGE__ = { getState, endGameForTest };
updateHud();
updateInputCount();
showLeaderboardState('loading');
bindTouchControls();
void loadLeaderboard();
requestAnimationFrame(frame);
