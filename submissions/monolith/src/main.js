import { createClient } from "@supabase/supabase-js";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  clamp,
  circlesOverlap,
  difficultyFor,
  formatScore,
  isPlausibleScore,
  sanitizeName,
  scoreForEnemy,
  spawnDelayFor,
} from "./gameLogic.js";
import "./styles.css";

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Neon Barrage home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="brand-copy">
          <span class="brand-name">NEON BARRAGE</span>
          <span class="brand-subtitle">ORBITAL DEFENSE // SECTOR 07</span>
        </span>
      </a>
      <div class="topbar-actions">
        <span class="connection-pill" data-connection-status><span class="status-dot"></span><span data-connection-label>RANKINGS ONLINE</span></span>
        <button class="icon-button" type="button" data-testid="mute-button" aria-label="Mute sound" aria-pressed="false"><span data-mute-icon>◒</span><span data-mute-label>SOUND ON</span></button>
      </div>
    </header>

    <section class="hero-row">
      <div>
        <p class="eyebrow"><span class="eyebrow-line"></span> LIVE ARCADE // 01</p>
        <h1>Hold the line.<br /><em>Own the night.</em></h1>
      </div>
      <p class="hero-note">A hostile signal has entered the outer ring.<br /><strong>Every pulse counts.</strong></p>
    </section>

    <section class="game-layout">
      <section class="game-column" aria-label="Arcade game">
        <div class="hud-strip">
          <div class="hud-stat"><span class="hud-label">SCORE</span><strong data-testid="score">000000</strong></div>
          <div class="hud-divider"></div>
          <div class="hud-stat"><span class="hud-label">WAVE</span><strong data-wave>01</strong></div>
          <div class="hud-divider"></div>
          <div class="hud-stat lives-stat"><span class="hud-label">HULL</span><strong data-testid="lives">3</strong><span class="hull-pips" data-hull-pips aria-label="3 lives remaining"><i></i><i></i><i></i></span></div>
          <div class="hud-readout"><span class="pulse-dot"></span><span data-hud-message>AWAITING PILOT</span></div>
        </div>

        <div class="canvas-frame">
          <div class="frame-corner corner-tl"></div><div class="frame-corner corner-tr"></div><div class="frame-corner corner-bl"></div><div class="frame-corner corner-br"></div>
          <canvas data-testid="game-canvas" width="900" height="600" tabindex="0" aria-label="Neon Barrage arcade battlefield"></canvas>
          <div class="game-overlay" data-game-overlay>
            <div class="overlay-glow"></div>
            <div class="overlay-content">
              <p class="overlay-kicker" data-overlay-kicker>MISSION BRIEF // 07-AX</p>
              <h2 data-overlay-title>DEFEND THE<br /><span>NEON RING</span></h2>
              <p class="overlay-copy" data-overlay-copy>Thread the gaps. Break the swarm.<br />The ring is counting on you.</p>
              <button class="launch-button" type="button" data-testid="start-button"><span class="launch-icon">▶</span><span data-start-label>LAUNCH MISSION</span><span class="button-arrow">↗</span></button>
              <div class="overlay-controls"><span><kbd>WASD</kbd> / <kbd>ARROWS</kbd> MOVE</span><span><kbd>SPACE</kbd> FIRE</span></div>
              <div class="gameover-panel" data-gameover-panel hidden>
                <div class="final-score"><span>FINAL SCORE</span><strong data-final-score>000000</strong></div>
                <form class="score-form" data-score-form novalidate>
                  <label for="player-name">ENTER YOUR CALLSIGN <span>1–16 CHARS</span></label>
                  <div class="score-form-row"><input id="player-name" data-testid="player-name" name="player-name" maxlength="16" autocomplete="nickname" placeholder="e.g. NOVA" required /><button type="submit" data-testid="submit-score">UPLOAD SCORE <span>↗</span></button></div>
                  <p class="form-message" data-form-message role="status"></p>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div class="touch-controls" data-testid="touch-controls" aria-label="Touch controls">
          <div class="touch-pad">
            <button type="button" class="touch-key touch-up" data-touch="up" aria-label="Move up">↑</button>
            <button type="button" class="touch-key touch-left" data-touch="left" aria-label="Move left">←</button>
            <button type="button" class="touch-key touch-down" data-touch="down" aria-label="Move down">↓</button>
            <button type="button" class="touch-key touch-right" data-touch="right" aria-label="Move right">→</button>
          </div>
          <button type="button" class="fire-key" data-touch="fire" aria-label="Fire weapon"><span>✦</span> FIRE</button>
        </div>

        <div class="control-rail"><span class="control-rail-label">FLIGHT SYSTEMS</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> OR ARROWS TO MOVE</span><span><kbd>SPACE</kbd> TO FIRE</span><span class="control-rail-end">ESC TO PAUSE</span></div>
      </section>

      <aside class="leaderboard-panel">
        <div class="leaderboard-heading">
          <div><p class="eyebrow"><span class="eyebrow-line"></span> GLOBAL COMMS</p><h2>Top pilots</h2></div>
          <span class="top-ten-badge">TOP 10</span>
        </div>
        <p class="leaderboard-intro">The sector's sharpest shooters.<br />Make the list. Stay there.</p>
        <div class="leaderboard-status" data-leaderboard-status role="status">Syncing public rankings…</div>
        <ol class="leaderboard-list" data-testid="leaderboard" aria-label="Top ten pilots"></ol>
        <div class="leaderboard-footer"><span class="live-bars"><i></i><i></i><i></i><i></i><i></i></span><span>UPDATED LIVE</span></div>
      </aside>
    </section>

    <footer class="site-footer"><span>NB-07 // NEON BARRAGE</span><span class="footer-center">BUILT FOR THE LAST LIGHT</span><span>© <span data-year></span> ORBITAL ARCADE</span></footer>
  </main>
`;

const canvas = document.querySelector('[data-testid="game-canvas"]');
const context = canvas.getContext("2d");
const startButton = document.querySelector('[data-testid="start-button"]');
const startLabel = document.querySelector("[data-start-label]");
const scoreElement = document.querySelector('[data-testid="score"]');
const livesElement = document.querySelector('[data-testid="lives"]');
const waveElement = document.querySelector("[data-wave]");
const hullPips = document.querySelector("[data-hull-pips]");
const hudMessage = document.querySelector("[data-hud-message]");
const muteButton = document.querySelector('[data-testid="mute-button"]');
const muteLabel = document.querySelector("[data-mute-label]");
const muteIcon = document.querySelector("[data-mute-icon]");
const overlay = document.querySelector("[data-game-overlay]");
const overlayKicker = document.querySelector("[data-overlay-kicker]");
const overlayTitle = document.querySelector("[data-overlay-title]");
const overlayCopy = document.querySelector("[data-overlay-copy]");
const gameoverPanel = document.querySelector("[data-gameover-panel]");
const finalScore = document.querySelector("[data-final-score]");
const scoreForm = document.querySelector("[data-score-form]");
const playerName = document.querySelector('[data-testid="player-name"]');
const submitScore = document.querySelector('[data-testid="submit-score"]');
const formMessage = document.querySelector("[data-form-message]");
const leaderboard = document.querySelector('[data-testid="leaderboard"]');
const leaderboardStatus = document.querySelector("[data-leaderboard-status]");
const connectionPill = document.querySelector("[data-connection-status]");
const connectionLabel = document.querySelector("[data-connection-label]");

document.querySelector("[data-year]").textContent = String(new Date().getFullYear());

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const LEADERBOARD_CANDIDATE_ID = "monolith";

const input = {
  keys: new Set(),
  touch: { up: false, down: false, left: false, right: false, fire: false },
};

const game = {
  phase: "ready",
  score: 0,
  lives: 3,
  elapsed: 0,
  difficulty: 1,
  spawnTimer: 0,
  fireTimer: 0,
  hitFlash: 0,
  shake: 0,
  messageTimer: 0,
  submitted: false,
  player: { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT - 78, radius: 17, invulnerable: 0 },
  enemies: [],
  projectiles: [],
  particles: [],
  stars: [],
};

let muted = false;
let audioContext = null;
let animationFrame = 0;
let lastFrame = performance.now();
let leaderboardRows = [];

for (let index = 0; index < 110; index += 1) {
  game.stars.push({
    x: Math.random() * BOARD_WIDTH,
    y: Math.random() * BOARD_HEIGHT,
    size: Math.random() * 1.8 + 0.4,
    speed: Math.random() * 13 + 5,
    alpha: Math.random() * 0.65 + 0.15,
    phase: Math.random() * Math.PI * 2,
  });
}

function unlockAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function tone(frequency, duration = 0.08, type = "sine", volume = 0.025) {
  if (muted || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function resetGame() {
  game.phase = "playing";
  game.score = 0;
  game.lives = 3;
  game.elapsed = 0;
  game.difficulty = 1;
  game.spawnTimer = 800;
  game.fireTimer = 0;
  game.hitFlash = 0;
  game.shake = 0;
  game.messageTimer = 0;
  game.submitted = false;
  game.player = { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT - 78, radius: 17, invulnerable: 0 };
  game.enemies.length = 0;
  game.projectiles.length = 0;
  game.particles.length = 0;
  playerName.value = "";
  playerName.disabled = false;
  submitScore.disabled = false;
  formMessage.textContent = "";
  formMessage.className = "form-message";
  gameoverPanel.hidden = true;
  overlay.hidden = true;
  startLabel.textContent = "LAUNCH MISSION";
  hudMessage.textContent = "SECTOR HOT // ENGAGE";
  canvas.focus({ preventScroll: true });
  tone(220, 0.12, "sawtooth", 0.035);
  window.setTimeout(() => tone(440, 0.16, "triangle", 0.03), 80);
  renderHud();
}

function finishGame(scoreOverride = null) {
  const safeScore = scoreOverride === null ? game.score : scoreOverride;
  if (!isPlausibleScore(safeScore)) return false;
  game.score = safeScore;
  game.phase = "gameover";
  game.enemies.length = 0;
  game.projectiles.length = 0;
  game.shake = 0;
  game.submitted = false;
  finalScore.textContent = formatScore(game.score).padStart(6, "0");
  overlayKicker.textContent = "MISSION COMPLETE // SIGNAL LOST";
  overlayTitle.innerHTML = "THE NIGHT<br /><span>REMEMBERS</span>";
  overlayCopy.innerHTML = "Your run is logged. Claim your place<br />among the sector's best pilots.";
  startLabel.textContent = "FLY AGAIN";
  gameoverPanel.hidden = false;
  overlay.hidden = false;
  hudMessage.textContent = "RUN COMPLETE // UPLOAD SCORE";
  renderHud();
  tone(98, 0.28, "sawtooth", 0.035);
  window.setTimeout(() => tone(196, 0.32, "triangle", 0.028), 90);
  return true;
}

function renderHud() {
  scoreElement.textContent = formatScore(game.score).padStart(6, "0");
  livesElement.textContent = String(game.lives);
  waveElement.textContent = String(game.difficulty).padStart(2, "0");
  hullPips.setAttribute("aria-label", `${game.lives} lives remaining`);
  [...hullPips.children].forEach((pip, index) => pip.classList.toggle("is-live", index < game.lives));
}

function spawnEnemy() {
  const roll = Math.random();
  const type = game.difficulty >= 4 && roll > 0.78 ? "hunter" : game.difficulty >= 2 && roll > 0.58 ? "weaver" : "drone";
  const radius = type === "hunter" ? 22 : type === "weaver" ? 19 : 17;
  game.enemies.push({
    type,
    x: 45 + Math.random() * (BOARD_WIDTH - 90),
    y: -radius - 14,
    radius,
    speed: 74 + Math.random() * 45 + game.difficulty * 7,
    phase: Math.random() * Math.PI * 2,
    wave: 24 + Math.random() * 40,
    shotTimer: 900 + Math.random() * 2400,
  });
}

function burst(x, y, color, amount = 12, speed = 120) {
  for (let index = 0; index < amount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.35 + Math.random() * 0.85);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 1,
      decay: 0.8 + Math.random() * 1.2,
      size: 1.4 + Math.random() * 2.8,
      color,
    });
  }
}

function firePlayer() {
  if (game.fireTimer > 0) return;
  game.fireTimer = Math.max(105, 205 - game.difficulty * 5);
  game.projectiles.push({ x: game.player.x, y: game.player.y - 20, vx: 0, vy: -570, radius: 4, friendly: true });
  tone(620 + game.difficulty * 12, 0.045, "square", 0.018);
}

function fireEnemy(enemy) {
  game.projectiles.push({ x: enemy.x, y: enemy.y + enemy.radius, vx: (game.player.x - enemy.x) * 0.13, vy: 190 + game.difficulty * 13, radius: 5, friendly: false });
}

function damagePlayer() {
  if (game.player.invulnerable > 0 || game.phase !== "playing") return;
  game.lives -= 1;
  game.player.invulnerable = 1.15;
  game.hitFlash = 0.35;
  game.shake = 0.36;
  burst(game.player.x, game.player.y, "#ff4d8d", 22, 180);
  tone(120, 0.22, "sawtooth", 0.04);
  hudMessage.textContent = game.lives > 0 ? "HULL BREACH // STAY SHARP" : "HULL CRITICAL // SIGNAL LOST";
  renderHud();
  if (game.lives <= 0) finishGame();
}

function update(delta) {
  const seconds = delta / 1000;
  game.elapsed += seconds;
  game.difficulty = difficultyFor(game.score, game.elapsed);
  game.fireTimer = Math.max(0, game.fireTimer - delta);
  game.hitFlash = Math.max(0, game.hitFlash - seconds);
  game.shake = Math.max(0, game.shake - seconds);
  game.player.invulnerable = Math.max(0, game.player.invulnerable - seconds);

  const left = input.keys.has("ArrowLeft") || input.keys.has("KeyA") || input.touch.left;
  const right = input.keys.has("ArrowRight") || input.keys.has("KeyD") || input.touch.right;
  const up = input.keys.has("ArrowUp") || input.keys.has("KeyW") || input.touch.up;
  const down = input.keys.has("ArrowDown") || input.keys.has("KeyS") || input.touch.down;
  const horizontal = Number(right) - Number(left);
  const vertical = Number(down) - Number(up);
  const movement = 325 + game.difficulty * 4;
  game.player.x = clamp(game.player.x + horizontal * movement * seconds, 34, BOARD_WIDTH - 34);
  game.player.y = clamp(game.player.y + vertical * movement * seconds, BOARD_HEIGHT * 0.46, BOARD_HEIGHT - 38);
  if (input.keys.has("Space") || input.touch.fire) firePlayer();

  game.spawnTimer -= delta;
  if (game.spawnTimer <= 0) {
    spawnEnemy();
    if (game.difficulty >= 5 && Math.random() > 0.62) spawnEnemy();
    game.spawnTimer = spawnDelayFor(game.difficulty) * (0.76 + Math.random() * 0.42);
  }

  for (const star of game.stars) {
    star.y += star.speed * seconds * (1 + game.difficulty * 0.035);
    star.phase += seconds * 1.8;
    if (star.y > BOARD_HEIGHT + 4) {
      star.y = -4;
      star.x = Math.random() * BOARD_WIDTH;
    }
  }

  for (const projectile of game.projectiles) {
    projectile.x += projectile.vx * seconds;
    projectile.y += projectile.vy * seconds;
  }

  for (const enemy of game.enemies) {
    enemy.y += enemy.speed * seconds;
    enemy.phase += seconds * (enemy.type === "weaver" ? 3.2 : 1.6);
    if (enemy.type === "weaver") enemy.x += Math.sin(enemy.phase) * enemy.wave * seconds;
    if (enemy.type === "hunter") enemy.x += clamp(game.player.x - enemy.x, -80, 80) * 0.17 * seconds;
    enemy.x = clamp(enemy.x, enemy.radius + 8, BOARD_WIDTH - enemy.radius - 8);
    enemy.shotTimer -= delta;
    if (enemy.shotTimer <= 0 && game.difficulty >= 3 && enemy.y > 20 && enemy.y < BOARD_HEIGHT * 0.62) {
      fireEnemy(enemy);
      enemy.shotTimer = 2200 + Math.random() * 2600 - game.difficulty * 100;
    }
  }

  for (const particle of game.particles) {
    particle.x += particle.vx * seconds;
    particle.y += particle.vy * seconds;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    particle.life -= particle.decay * seconds;
  }

  for (let projectileIndex = game.projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
    const projectile = game.projectiles[projectileIndex];
    if (projectile.friendly) {
      let hit = false;
      for (let enemyIndex = game.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        const enemy = game.enemies[enemyIndex];
        if (circlesOverlap(projectile, enemy)) {
          game.projectiles.splice(projectileIndex, 1);
          game.enemies.splice(enemyIndex, 1);
          game.score = Math.min(2_147_483_647, game.score + scoreForEnemy(enemy.type));
          burst(enemy.x, enemy.y, enemy.type === "hunter" ? "#ff4d8d" : "#8afff0", 16, 145);
          tone(enemy.type === "hunter" ? 310 : 470, 0.09, "triangle", 0.028);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    } else if (circlesOverlap(projectile, game.player)) {
      game.projectiles.splice(projectileIndex, 1);
      damagePlayer();
      continue;
    }
    if (projectile.y < -40 || projectile.y > BOARD_HEIGHT + 40 || projectile.x < -40 || projectile.x > BOARD_WIDTH + 40) game.projectiles.splice(projectileIndex, 1);
  }

  for (let enemyIndex = game.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
    const enemy = game.enemies[enemyIndex];
    if (circlesOverlap(enemy, game.player)) {
      game.enemies.splice(enemyIndex, 1);
      damagePlayer();
    } else if (enemy.y - enemy.radius > BOARD_HEIGHT + 8) {
      game.enemies.splice(enemyIndex, 1);
      damagePlayer();
    }
  }

  game.projectiles = game.projectiles.filter((projectile) => projectile.y > -60 && projectile.y < BOARD_HEIGHT + 60);
  game.particles = game.particles.filter((particle) => particle.life > 0);
  if (game.messageTimer > 0) game.messageTimer -= delta;
  if (game.phase === "playing") {
    hudMessage.textContent = game.messageTimer > 0 ? hudMessage.textContent : `WAVE ${String(game.difficulty).padStart(2, "0")} // HOLD THE LINE`;
    renderHud();
  }
}

function drawBackground(time) {
  const gradient = context.createLinearGradient(0, 0, 0, BOARD_HEIGHT);
  gradient.addColorStop(0, "#0b1031");
  gradient.addColorStop(0.48, "#080d2a");
  gradient.addColorStop(1, "#06081a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const glow = context.createRadialGradient(450, 510, 0, 450, 510, 380);
  glow.addColorStop(0, "rgba(46, 227, 213, .12)");
  glow.addColorStop(1, "rgba(46, 227, 213, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  context.save();
  context.globalCompositeOperation = "screen";
  for (const star of game.stars) {
    const twinkle = star.alpha + Math.sin(time * 0.002 + star.phase) * 0.12;
    context.fillStyle = `rgba(179, 226, 255, ${Math.max(0.05, twinkle)})`;
    context.fillRect(star.x, star.y, star.size, star.size);
  }
  context.restore();

  context.save();
  context.strokeStyle = "rgba(95, 144, 194, .085)";
  context.lineWidth = 1;
  for (let x = 0; x <= BOARD_WIDTH; x += 45) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, BOARD_HEIGHT);
    context.stroke();
  }
  for (let y = 0; y <= BOARD_HEIGHT; y += 45) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(BOARD_WIDTH, y);
    context.stroke();
  }
  context.strokeStyle = "rgba(92, 236, 220, .18)";
  context.beginPath();
  context.arc(450, 675, 280, Math.PI * 1.11, Math.PI * 1.89);
  context.stroke();
  context.strokeStyle = "rgba(255, 78, 144, .13)";
  context.beginPath();
  context.arc(450, 668, 206, Math.PI * 1.1, Math.PI * 1.9);
  context.stroke();
  context.restore();
}

function drawPlayer(time) {
  const player = game.player;
  if (player.invulnerable > 0 && Math.floor(time / 80) % 2 === 0) return;
  context.save();
  context.translate(player.x, player.y);
  context.shadowBlur = 25;
  context.shadowColor = "#42f6df";
  context.fillStyle = "#42f6df";
  context.beginPath();
  context.moveTo(0, -23);
  context.lineTo(18, 16);
  context.lineTo(7, 12);
  context.lineTo(0, 23);
  context.lineTo(-7, 12);
  context.lineTo(-18, 16);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "#101936";
  context.beginPath();
  context.moveTo(0, -13);
  context.lineTo(8, 9);
  context.lineTo(0, 6);
  context.lineTo(-8, 9);
  context.closePath();
  context.fill();
  context.fillStyle = "#ffecb3";
  context.fillRect(-2, -16, 4, 8);
  context.fillStyle = "#ff4d90";
  context.shadowBlur = 14;
  context.shadowColor = "#ff4d90";
  context.fillRect(-9, 14 + Math.sin(time * 0.02) * 2, 5, 9);
  context.fillRect(4, 14 + Math.sin(time * 0.02 + 1) * 2, 5, 9);
  context.restore();
}

function drawEnemy(enemy, time) {
  const color = enemy.type === "hunter" ? "#ff4d8d" : enemy.type === "weaver" ? "#d383ff" : "#ffd166";
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(Math.sin(enemy.phase) * 0.08);
  context.shadowBlur = 22;
  context.shadowColor = color;
  context.strokeStyle = color;
  context.fillStyle = "rgba(12, 16, 48, .95)";
  context.lineWidth = 3;
  context.beginPath();
  if (enemy.type === "hunter") {
    context.moveTo(0, -enemy.radius);
    context.lineTo(enemy.radius, 0);
    context.lineTo(0, enemy.radius);
    context.lineTo(-enemy.radius, 0);
  } else if (enemy.type === "weaver") {
    context.moveTo(0, -enemy.radius);
    context.lineTo(enemy.radius * 0.9, -4);
    context.lineTo(enemy.radius * 0.55, enemy.radius);
    context.lineTo(-enemy.radius * 0.55, enemy.radius);
    context.lineTo(-enemy.radius * 0.9, -4);
  } else {
    context.moveTo(-enemy.radius, -7);
    context.lineTo(-7, -enemy.radius);
    context.lineTo(enemy.radius, -7);
    context.lineTo(7, enemy.radius);
    context.lineTo(-enemy.radius, 7);
    context.closePath();
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.beginPath();
  context.arc(0, 0, 4 + Math.sin(time * 0.01 + enemy.phase) * 1.5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawProjectiles() {
  for (const projectile of game.projectiles) {
    const color = projectile.friendly ? "#8afff0" : "#ff4d8d";
    context.save();
    context.strokeStyle = color;
    context.shadowBlur = 18;
    context.shadowColor = color;
    context.lineWidth = projectile.friendly ? 4 : 3;
    context.beginPath();
    context.moveTo(projectile.x, projectile.y);
    context.lineTo(projectile.x - projectile.vx * 0.03, projectile.y - projectile.vy * 0.035);
    context.stroke();
    context.restore();
  }
}

function drawParticles() {
  for (const particle of game.particles) {
    context.save();
    context.globalAlpha = Math.max(0, particle.life);
    context.fillStyle = particle.color;
    context.shadowBlur = 12;
    context.shadowColor = particle.color;
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
    context.restore();
  }
}

function draw(time) {
  context.save();
  if (game.shake > 0) context.translate((Math.random() - 0.5) * game.shake * 20, (Math.random() - 0.5) * game.shake * 20);
  drawBackground(time);
  drawParticles();
  drawProjectiles();
  for (const enemy of game.enemies) drawEnemy(enemy, time);
  drawPlayer(time);
  context.restore();
  if (game.hitFlash > 0) {
    context.fillStyle = `rgba(255, 77, 141, ${game.hitFlash * 0.18})`;
    context.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  }
}

function frame(now) {
  const delta = Math.min(50, now - lastFrame);
  lastFrame = now;
  if (game.phase === "playing") update(delta);
  draw(now);
  animationFrame = requestAnimationFrame(frame);
}

function startGame() {
  unlockAudio();
  resetGame();
}

function setFormMessage(message, toneName = "") {
  formMessage.textContent = message;
  formMessage.className = `form-message ${toneName}`.trim();
}

function renderLeaderboard(rows = leaderboardRows) {
  leaderboard.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "leaderboard-empty";
    empty.innerHTML = '<span class="empty-orbit">◎</span><span>NO PILOTS LOGGED YET</span><small>Be the first signal in the dark.</small>';
    leaderboard.append(empty);
    return;
  }
  rows.slice(0, 10).forEach((row, index) => {
    const item = document.createElement("li");
    item.className = `leaderboard-row ${index < 3 ? "is-top-three" : ""}`;
    const rank = document.createElement("span");
    rank.className = "rank-number";
    rank.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.className = "pilot-name";
    name.textContent = row.player_name;
    const points = document.createElement("strong");
    points.className = "pilot-score";
    points.textContent = formatScore(row.score);
    item.append(rank, name, points);
    leaderboard.append(item);
  });
}

async function loadLeaderboard() {
  if (!supabase) {
    connectionPill.classList.add("is-local");
    connectionLabel.textContent = "LOCAL PREVIEW";
    leaderboardStatus.textContent = "Leaderboard connection not configured.";
    renderLeaderboard([]);
    return;
  }
  leaderboardStatus.textContent = "Syncing public rankings…";
  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("id, player_name, score, created_at")
      .eq("candidate_id", LEADERBOARD_CANDIDATE_ID)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(10);
    if (error) throw error;
    leaderboardRows = data || [];
    leaderboardStatus.textContent = leaderboardRows.length ? "Live rankings // top ten" : "The signal is quiet. Take the first shot.";
    renderLeaderboard();
  } catch (error) {
    leaderboardStatus.textContent = "Rankings temporarily offline — game systems remain live.";
    connectionPill.classList.add("is-local");
    connectionLabel.textContent = "RANKINGS OFFLINE";
    renderLeaderboard([]);
    console.warn("Leaderboard read failed", error);
  }
}

async function submitLeaderboardScore(event) {
  event.preventDefault();
  unlockAudio();
  const name = sanitizeName(playerName.value);
  if (!name) {
    setFormMessage("Use a callsign from 1 to 16 characters.", "is-error");
    playerName.focus();
    return;
  }
  if (!isPlausibleScore(game.score)) {
    setFormMessage("This score could not be verified. Fly another run.", "is-error");
    return;
  }
  if (!supabase) {
    setFormMessage("Rankings are offline in this preview. Score kept on this screen.", "is-error");
    return;
  }
  submitScore.disabled = true;
  playerName.disabled = true;
  setFormMessage("Transmitting your signal…", "is-loading");
  try {
    const { error } = await supabase.from("leaderboard").insert({
      candidate_id: LEADERBOARD_CANDIDATE_ID,
      player_name: name,
      score: game.score,
    });
    if (error) throw error;
    game.submitted = true;
    setFormMessage("Score uploaded. Welcome to the signal.", "is-success");
    tone(660, 0.12, "triangle", 0.028);
    window.setTimeout(() => tone(990, 0.16, "triangle", 0.028), 90);
    await loadLeaderboard();
  } catch (error) {
    submitScore.disabled = false;
    playerName.disabled = false;
    setFormMessage("Upload failed. Check the signal and try again.", "is-error");
    console.warn("Leaderboard insert failed", error);
  }
}

function toggleMute() {
  unlockAudio();
  muted = !muted;
  muteButton.setAttribute("aria-pressed", String(muted));
  muteButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  muteLabel.textContent = muted ? "SOUND OFF" : "SOUND ON";
  muteIcon.textContent = muted ? "◌" : "◒";
  muteButton.classList.toggle("is-muted", muted);
}

function keyForButton(button) {
  return button.dataset.touch;
}

function setTouchState(button, active) {
  const key = keyForButton(button);
  input.touch[key] = active;
  button.classList.toggle("is-active", active);
}

startButton.addEventListener("click", startGame);
muteButton.addEventListener("click", toggleMute);
scoreForm.addEventListener("submit", submitLeaderboardScore);

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
  input.keys.add(event.code);
  if (event.code === "Escape" && game.phase === "playing") {
    game.phase = "paused";
    overlayKicker.textContent = "FLIGHT SYSTEM PAUSED";
    overlayTitle.innerHTML = "HOLD<br /><span>POSITION</span>";
    overlayCopy.innerHTML = "The ring is still turning.<br />Resume when ready.";
    startLabel.textContent = "RESUME MISSION";
    gameoverPanel.hidden = true;
    overlay.hidden = false;
  } else if (event.code === "Escape" && game.phase === "paused") {
    game.phase = "playing";
    overlay.hidden = true;
  }
  if (event.code === "Space" && (game.phase === "ready" || game.phase === "gameover")) startGame();
}, { passive: false });

window.addEventListener("keyup", (event) => input.keys.delete(event.code));

document.querySelectorAll("[data-touch]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    unlockAudio();
    if (game.phase !== "playing") startGame();
    button.setPointerCapture(event.pointerId);
    setTouchState(button, true);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => button.addEventListener(eventName, () => setTouchState(button, false)));
});

canvas.addEventListener("pointerdown", () => {
  if (game.phase === "ready" || game.phase === "gameover") startGame();
  unlockAudio();
});

window.__NEON_BARRAGE__ = {
  getState: () => ({
    phase: game.phase,
    score: game.score,
    lives: game.lives,
    playerX: Math.round(game.player.x),
    playerY: Math.round(game.player.y),
    enemyCount: game.enemies.length,
    projectileCount: game.projectiles.length,
  }),
  endGameForTest: (score) => {
    if (!isPlausibleScore(score)) return false;
    return finishGame(score);
  },
};

renderHud();
renderLeaderboard([]);
loadLeaderboard();
animationFrame = requestAnimationFrame(frame);

window.addEventListener("beforeunload", () => cancelAnimationFrame(animationFrame));
