import {
  MAX_SCORE,
  circlesOverlap,
  difficultyFor,
  spawnIntervalFor,
  sortLeaderboard,
  validateName,
  validateScore
} from "./game-logic.js";

const canvas = document.querySelector('[data-testid="game-canvas"]');
const context = canvas.getContext("2d");
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const config = window.NEON_BARRAGE_CONFIG ?? {};

const elements = {
  readyOverlay: document.querySelector("#ready-overlay"),
  gameoverOverlay: document.querySelector("#gameover-overlay"),
  startButton: document.querySelector('[data-testid="start-button"]'),
  retryButton: document.querySelector("#retry-button"),
  score: document.querySelector('[data-testid="score"]'),
  lives: document.querySelector('[data-testid="lives"]'),
  lifePips: [...document.querySelectorAll("#life-pips i")],
  threat: document.querySelector("#threat-level"),
  finalScore: document.querySelector("#final-score"),
  scoreForm: document.querySelector("#score-form"),
  playerName: document.querySelector('[data-testid="player-name"]'),
  submitScore: document.querySelector('[data-testid="submit-score"]'),
  feedback: document.querySelector("#submit-feedback"),
  muteButton: document.querySelector('[data-testid="mute-button"]'),
  muteLabel: document.querySelector("#mute-label"),
  leaderboard: document.querySelector('[data-testid="leaderboard"]'),
  leaderboardStatus: document.querySelector("#leaderboard-status")
};

const state = {
  phase: "ready",
  score: 0,
  lives: 3,
  playerX: WIDTH / 2,
  playerY: HEIGHT - 78,
  enemyCount: 0,
  projectileCount: 0,
  elapsed: 0
};

const input = { left: false, right: false, fire: false };
const player = { radius: 17 };
const enemies = [];
const projectiles = [];
const particles = [];
const stars = Array.from({ length: 90 }, (_, index) => ({
  x: (index * 83) % WIDTH,
  y: (index * 137) % HEIGHT,
  size: 0.5 + (index % 3) * 0.45,
  speed: 10 + (index % 5) * 8,
  phase: index * 0.73
}));
const keys = new Set();
let lastTime = performance.now();
let spawnTimer = 0.5;
let fireTimer = 0;
let shake = 0;
let flash = 0;
let muted = readMutePreference();
let audioContext;
let audioUnlocked = false;

function readMutePreference() {
  try {
    return window.localStorage.getItem("neon-barrage-muted") === "true";
  } catch {
    return false;
  }
}

function updateMuteButton() {
  elements.muteButton.setAttribute("aria-pressed", String(muted));
  elements.muteLabel.textContent = muted ? "Sound off" : "Sound on";
}

function unlockAudio() {
  if (muted || audioContext) {
    audioUnlocked = Boolean(audioContext);
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext = new AudioContextClass();
  audioUnlocked = true;
  if (audioContext.state === "suspended") audioContext.resume();
}

function tone(frequency, duration = 0.06, type = "sine", volume = 0.035) {
  if (muted || !audioUnlocked || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function resetRun() {
  state.phase = "playing";
  state.score = 0;
  state.lives = 3;
  state.playerX = WIDTH / 2;
  state.playerY = HEIGHT - 78;
  state.elapsed = 0;
  spawnTimer = 0.45;
  fireTimer = 0;
  shake = 0;
  flash = 0;
  enemies.length = 0;
  projectiles.length = 0;
  particles.length = 0;
  elements.readyOverlay.hidden = true;
  elements.gameoverOverlay.hidden = true;
  elements.startButton.textContent = "Engage thrusters";
  elements.feedback.textContent = "";
  elements.feedback.className = "form-feedback";
  elements.playerName.value = "";
  elements.playerName.disabled = false;
  elements.submitScore.disabled = false;
  unlockAudio();
  tone(250, 0.12, "square", 0.04);
  updateHud();
  canvas.focus({ preventScroll: true });
}

function startGame() {
  resetRun();
}

function endGame(score = state.score) {
  const safeScore = Math.max(0, Math.min(MAX_SCORE, Math.floor(Number(score) || 0)));
  state.score = safeScore;
  state.phase = "gameover";
  input.left = false;
  input.right = false;
  input.fire = false;
  elements.finalScore.textContent = String(state.score).padStart(6, "0");
  elements.gameoverOverlay.hidden = false;
  elements.readyOverlay.hidden = true;
  elements.startButton.textContent = "Run it again";
  updateHud();
  tone(120, 0.22, "sawtooth", 0.05);
  setTimeout(() => elements.playerName.focus(), 0);
}

function updateHud() {
  elements.score.textContent = String(state.score).padStart(6, "0");
  elements.lives.textContent = String(Math.max(0, state.lives)).padStart(2, "0");
  elements.threat.textContent = String(difficultyFor(state.score, state.elapsed)).padStart(2, "0");
  elements.lifePips.forEach((pip, index) => pip.classList.toggle("spent", index >= state.lives));
  state.enemyCount = enemies.length;
  state.projectileCount = projectiles.length;
}

function spawnEnemy() {
  const difficulty = difficultyFor(state.score, state.elapsed);
  const radius = randomBetween(15, 23);
  enemies.push({
    x: randomBetween(45, WIDTH - 45),
    baseX: 0,
    y: -radius - 10,
    radius,
    speed: randomBetween(75, 110) + difficulty * 6,
    drift: randomBetween(-34, 34),
    phase: randomBetween(0, Math.PI * 2),
    spin: randomBetween(-2.5, 2.5),
    hue: Math.random() > 0.5 ? "pink" : "orange",
    rotation: 0
  });
  enemies[enemies.length - 1].baseX = enemies[enemies.length - 1].x;
}

function fire() {
  if (fireTimer > 0) return;
  projectiles.push({ x: state.playerX, y: state.playerY - 23, radius: 4, speed: 650 });
  fireTimer = 0.16;
  tone(540, 0.045, "square", 0.025);
}

function burst(x, y, color, count = 9) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + randomBetween(-0.2, 0.2);
    const speed = randomBetween(40, 150);
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: randomBetween(0.25, 0.6), maxLife: 0.6, size: randomBetween(1, 3), color });
  }
}

function loseLife(enemyIndex = -1) {
  if (enemyIndex >= 0) enemies.splice(enemyIndex, 1);
  state.lives -= 1;
  shake = 10;
  flash = 0.24;
  burst(state.playerX, state.playerY, "#ff4faf", 16);
  tone(90, 0.14, "sawtooth", 0.055);
  if (state.lives <= 0) endGame(state.score);
}

function update(delta) {
  state.elapsed += delta;
  fireTimer = Math.max(0, fireTimer - delta);
  shake = Math.max(0, shake - delta * 25);
  flash = Math.max(0, flash - delta);

  const moveLeft = input.left || keys.has("ArrowLeft") || keys.has("a");
  const moveRight = input.right || keys.has("ArrowRight") || keys.has("d");
  const movement = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
  state.playerX = Math.max(30, Math.min(WIDTH - 30, state.playerX + movement * 390 * delta));
  if (input.fire || keys.has(" ")) fire();

  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = spawnIntervalFor(state.score, state.elapsed);
  }

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.y -= projectile.speed * delta;
    if (projectile.y < -20) projectiles.splice(index, 1);
  }

  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const enemy = enemies[index];
    enemy.y += enemy.speed * delta;
    enemy.x = enemy.baseX + Math.sin(state.elapsed * 2 + enemy.phase) * enemy.drift;
    enemy.rotation += enemy.spin * delta;
    if (enemy.y > HEIGHT + 32) {
      loseLife(index);
      continue;
    }
    if (circlesOverlap(enemy, { x: state.playerX, y: state.playerY, radius: player.radius })) {
      loseLife(index);
      continue;
    }
    for (let projectileIndex = projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
      if (!circlesOverlap(enemy, projectiles[projectileIndex])) continue;
      projectiles.splice(projectileIndex, 1);
      enemies.splice(index, 1);
      state.score = Math.min(MAX_SCORE, state.score + 25 + difficultyFor(state.score, state.elapsed));
      burst(enemy.x, enemy.y, enemy.hue === "pink" ? "#ff4faf" : "#ff9b5b");
      tone(170 + difficultyFor(state.score, state.elapsed) * 8, 0.08, "triangle", 0.04);
      break;
    }
  }

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.97;
    particle.vy *= 0.97;
    particle.life -= delta;
    if (particle.life <= 0) particles.splice(index, 1);
  }
  updateHud();
}

function drawBackground(time) {
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#080d25");
  gradient.addColorStop(0.56, "#070a1d");
  gradient.addColorStop(1, "#10091e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.save();
  context.globalAlpha = 0.22;
  context.strokeStyle = "#1c4c73";
  context.lineWidth = 1;
  const offset = (time * 0.018) % 40;
  for (let x = -40 + offset; x < WIDTH + 40; x += 40) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, HEIGHT); context.stroke();
  }
  for (let y = offset; y < HEIGHT; y += 40) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(WIDTH, y); context.stroke();
  }
  context.restore();

  for (const star of stars) {
    const y = (star.y + time * 0.001 * star.speed) % HEIGHT;
    const alpha = 0.25 + (Math.sin(time * 0.002 + star.phase) + 1) * 0.18;
    context.fillStyle = `rgba(152, 222, 255, ${alpha})`;
    context.fillRect(star.x, y, star.size, star.size);
  }
  context.fillStyle = "rgba(255, 79, 175, 0.035)";
  context.beginPath(); context.arc(WIDTH * 0.82, HEIGHT * 0.2, 175, 0, Math.PI * 2); context.fill();
}

function drawPlayer(time) {
  const x = state.playerX;
  const y = state.playerY;
  context.save();
  context.translate(x, y);
  context.shadowColor = "#4ce6ee";
  context.shadowBlur = 18;
  context.fillStyle = "#4ce6ee";
  context.beginPath();
  context.moveTo(0, -23);
  context.lineTo(17, 17);
  context.lineTo(0, 11);
  context.lineTo(-17, 17);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "#07101e";
  context.beginPath(); context.moveTo(0, -13); context.lineTo(7, 10); context.lineTo(0, 6); context.lineTo(-7, 10); context.closePath(); context.fill();
  context.fillStyle = "#cbff66";
  context.globalAlpha = 0.65 + Math.sin(time * 0.02) * 0.25;
  context.beginPath(); context.moveTo(-6, 16); context.lineTo(0, 30 + Math.random() * 7); context.lineTo(6, 16); context.closePath(); context.fill();
  context.restore();
}

function drawEnemy(enemy) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(enemy.rotation);
  const color = enemy.hue === "pink" ? "#ff4faf" : "#ff9b5b";
  context.shadowColor = color;
  context.shadowBlur = 16;
  context.strokeStyle = color;
  context.fillStyle = "rgba(9, 12, 30, 0.9)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, -enemy.radius);
  context.lineTo(enemy.radius, 0);
  context.lineTo(0, enemy.radius);
  context.lineTo(-enemy.radius, 0);
  context.closePath();
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.beginPath(); context.arc(0, 0, 4, 0, Math.PI * 2); context.fill();
  context.restore();
}

function drawProjectiles() {
  context.save();
  context.shadowColor = "#cbff66";
  context.shadowBlur = 12;
  for (const projectile of projectiles) {
    context.fillStyle = "#cbff66";
    context.fillRect(projectile.x - 2, projectile.y - 13, 4, 18);
  }
  context.restore();
}

function drawParticles() {
  context.save();
  for (const particle of particles) {
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color;
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  context.restore();
}

function render(time) {
  drawBackground(time);
  context.save();
  if (shake > 0) context.translate(randomBetween(-shake, shake), randomBetween(-shake, shake));
  drawProjectiles();
  enemies.forEach(drawEnemy);
  drawParticles();
  drawPlayer(time);
  context.restore();
  if (flash > 0) {
    context.fillStyle = `rgba(255, 79, 175, ${flash * 0.35})`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

function renderLeaderboard(entries) {
  const ranked = sortLeaderboard(entries);
  elements.leaderboard.replaceChildren();
  if (!ranked.length) {
    const empty = document.createElement("li");
    empty.className = "leaderboard-empty";
    empty.textContent = "No signals yet. Be the first pilot in the channel.";
    elements.leaderboard.append(empty);
    return;
  }
  ranked.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-entry";
    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const identity = document.createElement("span");
    identity.className = "leaderboard-name";
    identity.textContent = entry.name;
    const date = document.createElement("small");
    date.className = "leaderboard-date";
    date.textContent = formatDate(entry.created_at);
    identity.append(date);
    const score = document.createElement("strong");
    score.className = "leaderboard-score";
    score.textContent = Number(entry.score).toLocaleString("en-US");
    item.append(rank, identity, score);
    elements.leaderboard.append(item);
  });
}

function formatDate(value) {
  if (!value) return "RECENT SIGNAL";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "RECENT SIGNAL";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function setLeaderboardStatus(message, type = "") {
  elements.leaderboardStatus.textContent = message;
  elements.leaderboardStatus.className = `leaderboard-status ${type}`.trim();
}

function hasLeaderboardConfig() {
  return typeof config.supabaseUrl === "string" && typeof config.supabaseAnonKey === "string" && config.supabaseUrl.startsWith("https://") && config.supabaseAnonKey.length > 20;
}

async function fetchLeaderboard() {
  if (!hasLeaderboardConfig()) {
    renderLeaderboard([]);
    setLeaderboardStatus("Public channel unavailable in local mode.");
    return;
  }
  setLeaderboardStatus("Syncing live signals...");
  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/leaderboard?select=id,name,score,created_at&order=score.desc,created_at.asc&limit=10`, {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status})`);
    const entries = await response.json();
    renderLeaderboard(entries);
    setLeaderboardStatus(entries.length ? "Live channel / top 10" : "Channel is clear. Claim the first signal.", "success");
  } catch (error) {
    renderLeaderboard([]);
    setLeaderboardStatus("Signal lost. Try refreshing the channel.", "error");
    console.warn(error);
  }
}

async function submitScore(event) {
  event.preventDefault();
  const nameResult = validateName(elements.playerName.value);
  if (!nameResult.valid) {
    elements.feedback.textContent = nameResult.error;
    elements.feedback.className = "form-feedback error";
    elements.playerName.focus();
    return;
  }
  if (!validateScore(state.score)) {
    elements.feedback.textContent = "That score could not be verified.";
    elements.feedback.className = "form-feedback error";
    return;
  }
  if (!hasLeaderboardConfig()) {
    elements.feedback.textContent = "Public channel is offline in local mode. Your run is still complete.";
    elements.feedback.className = "form-feedback error";
    return;
  }

  elements.submitScore.disabled = true;
  elements.playerName.disabled = true;
  elements.feedback.textContent = "Transmitting signal...";
  elements.feedback.className = "form-feedback";
  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/leaderboard`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ name: nameResult.value, score: state.score }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Score request failed (${response.status})`);
    elements.feedback.textContent = "Signal logged. Your run is now part of the grid.";
    elements.feedback.className = "form-feedback success";
    setLeaderboardStatus("New signal received. Refreshing ranks...", "success");
    await fetchLeaderboard();
  } catch (error) {
    elements.submitScore.disabled = false;
    elements.playerName.disabled = false;
    elements.feedback.textContent = "Transmission failed. Check your connection and try again.";
    elements.feedback.className = "form-feedback error";
    console.warn(error);
  }
}

function setControl(control, value, button) {
  input[control] = value;
  button.classList.toggle("active", value);
}

function bindInput() {
  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
    keys.add(event.key);
    if (event.key === "Enter" && state.phase !== "playing") startGame();
  });
  window.addEventListener("keyup", (event) => keys.delete(event.key));
  window.addEventListener("blur", () => {
    keys.clear();
    input.left = false; input.right = false; input.fire = false;
  });
  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    const press = (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      setControl(control, true, button);
    };
    const release = (event) => {
      event.preventDefault();
      setControl(control, false, button);
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });
}

function loop(time) {
  const delta = Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
  lastTime = time;
  if (state.phase === "playing") update(delta);
  render(time);
  window.requestAnimationFrame(loop);
}

elements.startButton.addEventListener("click", startGame);
elements.retryButton.addEventListener("click", startGame);
elements.scoreForm.addEventListener("submit", submitScore);
elements.muteButton.addEventListener("click", () => {
  muted = !muted;
  try { window.localStorage.setItem("neon-barrage-muted", String(muted)); } catch { /* storage is optional */ }
  updateMuteButton();
  if (!muted) {
    unlockAudio();
    tone(420, 0.08, "sine", 0.03);
  }
});

bindInput();
updateMuteButton();
updateHud();
render(0);
fetchLeaderboard();

window.__NEON_BARRAGE__ = {
  getState: () => ({
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    playerX: state.playerX,
    playerY: state.playerY,
    enemyCount: enemies.length,
    projectileCount: projectiles.length
  }),
  endGameForTest: (score) => {
    if (!Number.isSafeInteger(score) || score < 0) return false;
    endGame(Math.min(MAX_SCORE, score));
    return true;
  }
};

window.requestAnimationFrame(loop);
