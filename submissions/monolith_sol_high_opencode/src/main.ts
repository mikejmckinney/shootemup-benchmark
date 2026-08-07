import './style.css';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './config';
import { boxesOverlap, difficultyFor, normalizeTestScore, spawnDelayFor } from './gameModel';

const WIDTH = 720;
const HEIGHT = 760;

type Phase = 'ready' | 'playing' | 'gameover';
type EnemyKind = 'dart' | 'weaver' | 'brute';
type Enemy = { x: number; y: number; width: number; height: number; hp: number; maxHp: number; speed: number; kind: EnemyKind; t: number; points: number; fireAt: number };
type Projectile = { x: number; y: number; width: number; height: number; vy: number; friendly: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number };
type Star = { x: number; y: number; speed: number; size: number; alpha: number };
type Leader = { name: string; score: number };

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="shell">
    <header class="masthead">
      <div class="brand-lockup">
        <span class="eyebrow">ORBITAL DEFENSE // SECTOR 09</span>
        <h1>NEON <i>BARRAGE</i></h1>
      </div>
      <button class="mute" type="button" data-testid="mute-button" aria-label="Mute sound"><span class="mute-icon">◖</span><span class="mute-label">SOUND ON</span></button>
    </header>

    <section class="game-layout">
      <div class="play-column">
        <div class="hud" aria-label="Game status">
          <div><span class="hud-label">SCORE</span><strong data-testid="score">000000</strong></div>
          <div class="threat"><span class="hud-label">THREAT</span><div class="threat-pips"><i></i><i></i><i></i><i></i><i></i></div></div>
          <div class="lives-wrap"><span class="hud-label">HULL</span><strong data-testid="lives">◆ ◆ ◆</strong></div>
        </div>
        <div class="screen-frame">
          <canvas width="720" height="760" data-testid="game-canvas" aria-label="Neon Barrage game arena"></canvas>
          <div class="scanlines"></div>
          <section class="game-overlay" data-overlay>
            <div class="overlay-ready" data-ready>
              <span class="signal">INCOMING SIGNAL</span>
              <h2>THE SKY<br><em>FIGHTS BACK</em></h2>
              <p>Break the siege. Chain eliminations.<br>Survive the rising barrage.</p>
              <button class="primary-button" type="button" data-testid="start-button"><span>LAUNCH RUN</span><b>SPACE</b></button>
              <small>MOVE <b>WASD / ARROWS</b> &nbsp;•&nbsp; FIRE <b>SPACE</b></small>
            </div>
            <div class="overlay-gameover" data-gameover hidden>
              <span class="signal danger">TRANSMISSION LOST</span>
              <h2>RUN <em>TERMINATED</em></h2>
              <div class="final-score"><span>FINAL SCORE</span><strong data-final-score>0</strong></div>
              <form data-score-form novalidate>
                <label for="player-name">PILOT CALLSIGN <span>1–16 characters</span></label>
                <div class="submit-row">
                  <input id="player-name" data-testid="player-name" name="name" maxlength="16" autocomplete="nickname" placeholder="ENTER NAME" pattern="[A-Za-z0-9][A-Za-z0-9 _-]{0,15}" />
                  <button type="submit" data-testid="submit-score">TRANSMIT</button>
                </div>
                <p class="form-status" data-form-status aria-live="polite"></p>
              </form>
              <button class="restart-button" type="button" data-restart>↻ RUN IT AGAIN</button>
            </div>
          </section>
        </div>

        <div class="touch-controls" data-testid="touch-controls" aria-label="Touch game controls">
          <div class="touch-pad">
            <button data-control="up" aria-label="Move up">▲</button>
            <button data-control="left" aria-label="Move left">◀</button>
            <button data-control="down" aria-label="Move down">▼</button>
            <button data-control="right" aria-label="Move right">▶</button>
          </div>
          <button class="fire-button" data-control="fire" aria-label="Fire"><span>FIRE</span></button>
        </div>
      </div>

      <aside class="leader-panel">
        <div class="panel-heading">
          <div><span class="eyebrow">GLOBAL UPLINK</span><h2>TOP PILOTS</h2></div>
          <span class="live-dot">LIVE</span>
        </div>
        <div class="leaderboard" data-testid="leaderboard" aria-live="polite">
          <p class="board-state">CONTACTING ORBITAL NETWORK…</p>
        </div>
        <button class="refresh-board" type="button" data-refresh>↻ REFRESH UPLINK</button>
        <div class="mission-card">
          <span class="mission-index">MISSION 01</span>
          <h3>HOLD THE LINE</h3>
          <p>Enemy velocity and wave density escalate with every sector. Heavy craft take multiple hits.</p>
          <div class="enemy-key"><span><i class="enemy dart"></i> DART</span><span><i class="enemy brute"></i> BRUTE</span></div>
        </div>
      </aside>
    </section>
    <footer><span>NB // 2088</span><p>NO DOWNLOADS. NO MERCY. JUST ONE MORE RUN.</p><span>SYS ONLINE</span></footer>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]')!;
const ctx = canvas.getContext('2d')!;
const overlay = document.querySelector<HTMLElement>('[data-overlay]')!;
const readyPanel = document.querySelector<HTMLElement>('[data-ready]')!;
const gameOverPanel = document.querySelector<HTMLElement>('[data-gameover]')!;
const startButton = document.querySelector<HTMLButtonElement>('[data-testid="start-button"]')!;
const scoreDisplay = document.querySelector<HTMLElement>('[data-testid="score"]')!;
const livesDisplay = document.querySelector<HTMLElement>('[data-testid="lives"]')!;
const muteButton = document.querySelector<HTMLButtonElement>('[data-testid="mute-button"]')!;
const leaderboard = document.querySelector<HTMLElement>('[data-testid="leaderboard"]')!;
const form = document.querySelector<HTMLFormElement>('[data-score-form]')!;
const nameInput = document.querySelector<HTMLInputElement>('[data-testid="player-name"]')!;
const submitButton = document.querySelector<HTMLButtonElement>('[data-testid="submit-score"]')!;
const formStatus = document.querySelector<HTMLElement>('[data-form-status]')!;
const finalScore = document.querySelector<HTMLElement>('[data-final-score]')!;

let phase: Phase = 'ready';
let score = 0;
let lives = 3;
let playerX = WIDTH / 2;
let playerY = HEIGHT - 100;
let enemies: Enemy[] = [];
let projectiles: Projectile[] = [];
let particles: Particle[] = [];
let elapsed = 0;
let spawnClock = 0;
let shotClock = 0;
let invulnerable = 0;
let lastFrame = performance.now();
let submitted = false;
let muted = false;
let audio: AudioContext | null = null;
const keys = new Set<string>();
const touchKeys = new Set<string>();
const stars: Star[] = Array.from({ length: 95 }, () => ({
  x: Math.random() * WIDTH,
  y: Math.random() * HEIGHT,
  speed: 18 + Math.random() * 85,
  size: Math.random() < 0.12 ? 2 : 1,
  alpha: 0.2 + Math.random() * 0.7,
}));

function initAudio(): void {
  if (!audio) audio = new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
}

function sound(frequency: number, duration: number, type: OscillatorType = 'square', volume = 0.035): void {
  if (muted || !audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(50, frequency * 0.58), audio.currentTime + duration);
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function updateHud(): void {
  scoreDisplay.textContent = score.toString().padStart(6, '0');
  livesDisplay.textContent = lives > 0 ? Array.from({ length: 3 }, (_, i) => i < lives ? '◆' : '◇').join(' ') : '◇ ◇ ◇';
  const level = difficultyFor(elapsed, score);
  document.querySelectorAll<HTMLElement>('.threat-pips i').forEach((pip, index) => pip.classList.toggle('active', index < Math.ceil(level / 2.4)));
}

function startGame(): void {
  initAudio();
  phase = 'playing';
  score = 0;
  lives = 3;
  playerX = WIDTH / 2;
  playerY = HEIGHT - 100;
  enemies = [];
  projectiles = [];
  particles = [];
  elapsed = 0;
  spawnClock = 500;
  shotClock = 0;
  invulnerable = 0;
  submitted = false;
  submitButton.disabled = false;
  nameInput.disabled = false;
  formStatus.textContent = '';
  overlay.classList.add('hidden');
  readyPanel.hidden = true;
  gameOverPanel.hidden = true;
  updateHud();
  sound(520, 0.18, 'sawtooth', 0.05);
}

function endGame(forcedScore?: number): void {
  if (forcedScore !== undefined) score = forcedScore;
  phase = 'gameover';
  keys.clear();
  touchKeys.clear();
  updateHud();
  finalScore.textContent = score.toLocaleString();
  overlay.classList.remove('hidden');
  readyPanel.hidden = true;
  gameOverPanel.hidden = false;
  sound(180, 0.6, 'sawtooth', 0.06);
  window.setTimeout(() => nameInput.focus(), 150);
}

function spawnEnemy(level: number): void {
  const roll = Math.random();
  const kind: EnemyKind = level > 3 && roll > 0.78 ? 'brute' : level > 1 && roll > 0.48 ? 'weaver' : 'dart';
  const size = kind === 'brute' ? 55 : kind === 'weaver' ? 38 : 30;
  const hp = kind === 'brute' ? 4 + Math.floor(level / 4) : kind === 'weaver' ? 2 : 1;
  enemies.push({
    x: 35 + Math.random() * (WIDTH - 70 - size), y: -size, width: size, height: size,
    hp, maxHp: hp, speed: (kind === 'brute' ? 52 : kind === 'weaver' ? 82 : 115) + level * 7,
    kind, t: Math.random() * 9, points: kind === 'brute' ? 450 : kind === 'weaver' ? 220 : 100,
    fireAt: 900 + Math.random() * 1500,
  });
}

function burst(x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 190;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 350 + Math.random() * 500, maxLife: 850, color, size: 1 + Math.random() * 4 });
  }
}

function hitPlayer(): void {
  if (invulnerable > 0 || phase !== 'playing') return;
  lives -= 1;
  invulnerable = 1600;
  burst(playerX, playerY, '#ff3f81', 28);
  sound(130, 0.35, 'sawtooth', 0.07);
  updateHud();
  if (lives <= 0) endGame();
}

function fire(): void {
  if (shotClock > 0) return;
  projectiles.push({ x: playerX - 3, y: playerY - 31, width: 6, height: 23, vy: -650, friendly: true });
  shotClock = 145;
  sound(620, 0.07, 'square', 0.018);
}

function update(dt: number): void {
  for (const star of stars) {
    star.y += star.speed * dt / 1000 * (phase === 'playing' ? 1 : 0.25);
    if (star.y > HEIGHT) { star.y = -4; star.x = Math.random() * WIDTH; }
  }
  particles = particles.filter((particle) => {
    particle.x += particle.vx * dt / 1000;
    particle.y += particle.vy * dt / 1000;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    particle.life -= dt;
    return particle.life > 0;
  });
  if (phase !== 'playing') return;

  elapsed += dt;
  shotClock = Math.max(0, shotClock - dt);
  invulnerable = Math.max(0, invulnerable - dt);
  const level = difficultyFor(elapsed, score);
  let dx = 0;
  let dy = 0;
  if (keys.has('arrowleft') || keys.has('a') || touchKeys.has('left')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d') || touchKeys.has('right')) dx += 1;
  if (keys.has('arrowup') || keys.has('w') || touchKeys.has('up')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s') || touchKeys.has('down')) dy += 1;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  playerX = Math.max(28, Math.min(WIDTH - 28, playerX + dx * 340 * dt / 1000));
  playerY = Math.max(80, Math.min(HEIGHT - 38, playerY + dy * 340 * dt / 1000));
  if (keys.has(' ') || touchKeys.has('fire')) fire();

  spawnClock += dt;
  if (spawnClock >= spawnDelayFor(level)) {
    spawnClock = 0;
    spawnEnemy(level);
    if (level >= 7 && Math.random() > 0.74) spawnEnemy(level);
  }

  for (const enemy of enemies) {
    enemy.t += dt / 1000;
    enemy.y += enemy.speed * dt / 1000;
    if (enemy.kind === 'weaver') enemy.x += Math.sin(enemy.t * 4.5) * 95 * dt / 1000;
    enemy.x = Math.max(8, Math.min(WIDTH - enemy.width - 8, enemy.x));
    enemy.fireAt -= dt;
    if (level > 2 && enemy.fireAt <= 0 && enemy.y > 30 && enemy.y < HEIGHT * 0.62) {
      projectiles.push({ x: enemy.x + enemy.width / 2 - 4, y: enemy.y + enemy.height, width: 8, height: 17, vy: 250 + level * 14, friendly: false });
      enemy.fireAt = 1300 + Math.random() * 1900;
    }
  }

  for (const projectile of projectiles) projectile.y += projectile.vy * dt / 1000;

  const deadEnemies = new Set<Enemy>();
  const deadProjectiles = new Set<Projectile>();
  for (const projectile of projectiles) {
    if (projectile.friendly) {
      for (const enemy of enemies) {
        if (!deadEnemies.has(enemy) && boxesOverlap(projectile, enemy)) {
          deadProjectiles.add(projectile);
          enemy.hp -= 1;
          burst(projectile.x, projectile.y, '#64f6ff', 4);
          if (enemy.hp <= 0) {
            deadEnemies.add(enemy);
            score += enemy.points * level;
            burst(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.kind === 'brute' ? '#ffb43f' : '#ff3f81', enemy.kind === 'brute' ? 30 : 15);
            sound(enemy.kind === 'brute' ? 90 : 210, 0.16, 'sawtooth', 0.035);
            updateHud();
          }
          break;
        }
      }
    } else if (boxesOverlap(projectile, { x: playerX - 18, y: playerY - 21, width: 36, height: 42 })) {
      deadProjectiles.add(projectile);
      hitPlayer();
    }
  }

  for (const enemy of enemies) {
    if (deadEnemies.has(enemy)) continue;
    if (boxesOverlap(enemy, { x: playerX - 19, y: playerY - 22, width: 38, height: 45 })) {
      deadEnemies.add(enemy);
      hitPlayer();
    } else if (enemy.y > HEIGHT + enemy.height) {
      deadEnemies.add(enemy);
      hitPlayer();
    }
  }
  enemies = enemies.filter((enemy) => !deadEnemies.has(enemy));
  projectiles = projectiles.filter((projectile) => !deadProjectiles.has(projectile) && projectile.y > -40 && projectile.y < HEIGHT + 40);
}

function drawShip(): void {
  if (phase !== 'playing') return;
  if (invulnerable > 0 && Math.floor(invulnerable / 90) % 2 === 0) return;
  ctx.save();
  ctx.translate(playerX, playerY);
  ctx.shadowColor = '#64f6ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#64f6ff';
  ctx.beginPath();
  ctx.moveTo(0, -29); ctx.lineTo(22, 21); ctx.lineTo(7, 14); ctx.lineTo(0, 24); ctx.lineTo(-7, 14); ctx.lineTo(-22, 21); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#12132c';
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(7, 13); ctx.lineTo(0, 8); ctx.lineTo(-7, 13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff3f81';
  ctx.fillRect(-4, 19, 8, 15 + Math.random() * 10);
  ctx.restore();
}

function drawEnemy(enemy: Enemy): void {
  const cx = enemy.x + enemy.width / 2;
  const cy = enemy.y + enemy.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  const color = enemy.kind === 'brute' ? '#ffb43f' : enemy.kind === 'weaver' ? '#a36bff' : '#ff3f81';
  ctx.strokeStyle = color;
  ctx.fillStyle = `${color}35`;
  ctx.lineWidth = enemy.kind === 'brute' ? 4 : 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  if (enemy.kind === 'brute') {
    ctx.moveTo(-enemy.width / 2, -12); ctx.lineTo(-20, 22); ctx.lineTo(0, 12); ctx.lineTo(20, 22); ctx.lineTo(enemy.width / 2, -12); ctx.lineTo(0, -enemy.height / 2); ctx.closePath();
  } else {
    ctx.moveTo(-enemy.width / 2, -enemy.height / 2); ctx.lineTo(0, -8); ctx.lineTo(enemy.width / 2, -enemy.height / 2); ctx.lineTo(15, enemy.height / 2); ctx.lineTo(0, 9); ctx.lineTo(-15, enemy.height / 2); ctx.closePath();
  }
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.fillRect(-5, -4, 10, 8);
  if (enemy.maxHp > 1) {
    ctx.fillStyle = '#24243d'; ctx.fillRect(-enemy.width / 2, -enemy.height / 2 - 10, enemy.width, 3);
    ctx.fillStyle = color; ctx.fillRect(-enemy.width / 2, -enemy.height / 2 - 10, enemy.width * enemy.hp / enemy.maxHp, 3);
  }
  ctx.restore();
}

function draw(): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#08081a');
  gradient.addColorStop(0.55, '#0d0922');
  gradient.addColorStop(1, '#120923');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = 'rgba(100,246,255,.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
  for (let y = 0; y <= HEIGHT; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = star.speed > 75 ? '#64f6ff' : '#ffffff';
    ctx.fillRect(star.x, star.y, star.size, star.size * (phase === 'playing' ? 2 : 1));
  }
  ctx.globalAlpha = 1;
  for (const projectile of projectiles) {
    const color = projectile.friendly ? '#64f6ff' : '#ff3f81';
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fillRect(projectile.x, projectile.y, projectile.width, projectile.height);
  }
  ctx.shadowBlur = 0;
  for (const enemy of enemies) drawEnemy(enemy);
  drawShip();
  for (const particle of particles) {
    ctx.globalAlpha = Math.min(1, particle.life / particle.maxLife * 1.8);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  if (phase === 'playing') {
    ctx.fillStyle = 'rgba(100,246,255,.55)';
    ctx.font = '600 14px ui-monospace, monospace';
    ctx.fillText(`SECTOR ${difficultyFor(elapsed, score).toString().padStart(2, '0')}`, 20, 29);
  }
}

function frame(now: number): void {
  const dt = Math.min(34, now - lastFrame);
  lastFrame = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

async function loadLeaderboard(): Promise<void> {
  leaderboard.replaceChildren(Object.assign(document.createElement('p'), { className: 'board-state', textContent: 'CONTACTING ORBITAL NETWORK…' }));
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/scores?select=name,score&order=score.desc,created_at.asc&limit=10`, {
      headers: { apikey: SUPABASE_PUBLIC_KEY },
    });
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status})`);
    const leaders = await response.json() as Leader[];
    leaderboard.replaceChildren();
    if (leaders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-board';
      empty.innerHTML = '<b>NO SIGNALS YET</b><span>Be the first pilot on the board.</span>';
      leaderboard.append(empty);
      return;
    }
    leaders.forEach((leader, index) => {
      const row = document.createElement('div');
      row.className = `leader-row${index < 3 ? ` rank-${index + 1}` : ''}`;
      const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = (index + 1).toString().padStart(2, '0');
      const name = document.createElement('strong'); name.textContent = leader.name;
      const points = document.createElement('span'); points.className = 'points'; points.textContent = leader.score.toLocaleString();
      row.append(rank, name, points);
      leaderboard.append(row);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network unavailable';
    leaderboard.replaceChildren(Object.assign(document.createElement('p'), { className: 'board-state error', textContent: `${message}. Your run is still playable.` }));
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (phase !== 'gameover' || submitted) return;
  const name = nameInput.value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,15}$/.test(name)) {
    formStatus.textContent = 'Use 1–16 letters, numbers, spaces, _ or -.';
    formStatus.className = 'form-status error';
    nameInput.focus();
    return;
  }
  submitButton.disabled = true;
  formStatus.textContent = 'TRANSMITTING…';
  formStatus.className = 'form-status';
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLIC_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ name, score }),
    });
    if (!response.ok) throw new Error(`Uplink rejected score (${response.status})`);
    submitted = true;
    nameInput.disabled = true;
    formStatus.textContent = 'SCORE TRANSMITTED';
    formStatus.className = 'form-status success';
    sound(880, 0.2, 'sine', 0.045);
    await loadLeaderboard();
  } catch (error) {
    submitButton.disabled = false;
    formStatus.textContent = `${error instanceof Error ? error.message : 'Network error'}. Retry when ready.`;
    formStatus.className = 'form-status error';
  }
});

startButton.addEventListener('click', startGame);
document.querySelector<HTMLButtonElement>('[data-restart]')!.addEventListener('click', startGame);
document.querySelector<HTMLButtonElement>('[data-refresh]')!.addEventListener('click', () => void loadLeaderboard());
muteButton.addEventListener('click', () => {
  initAudio();
  muted = !muted;
  muteButton.querySelector<HTMLElement>('.mute-label')!.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  muteButton.querySelector<HTMLElement>('.mute-icon')!.textContent = muted ? '○' : '◖';
  muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  if (!muted) sound(600, 0.1, 'sine');
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) event.preventDefault();
  if (phase === 'ready' && (key === ' ' || key === 'enter')) { startGame(); return; }
  if (phase === 'gameover' && key === 'r' && document.activeElement !== nameInput) { startGame(); return; }
  keys.add(key);
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach((button) => {
  const control = button.dataset.control!;
  const down = (event: PointerEvent): void => {
    event.preventDefault();
    initAudio();
    if (phase === 'ready') startGame();
    touchKeys.add(control);
    button.setPointerCapture(event.pointerId);
  };
  const up = (event: PointerEvent): void => { event.preventDefault(); touchKeys.delete(control); };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
});

declare global {
  interface Window {
    __NEON_BARRAGE__: {
      getState: () => { phase: Phase; score: number; lives: number; playerX: number; playerY: number; enemyCount: number; projectileCount: number };
      endGameForTest: (value: number) => void;
    };
  }
}

window.__NEON_BARRAGE__ = {
  getState: () => ({ phase, score, lives, playerX, playerY, enemyCount: enemies.length, projectileCount: projectiles.length }),
  endGameForTest: (value: number) => {
    const normalized = normalizeTestScore(value);
    if (normalized === null) return;
    endGame(normalized);
  },
};

updateHud();
void loadLeaderboard();
requestAnimationFrame(frame);
