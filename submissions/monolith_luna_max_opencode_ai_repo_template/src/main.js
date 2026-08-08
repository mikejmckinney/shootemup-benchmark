import {
  GAME_HEIGHT,
  GAME_WIDTH,
  clamp,
  difficultyForElapsed,
  entityRect,
  formatScore,
  isPlausibleScore,
  isValidPlayerName,
  rectanglesOverlap
} from "./game-core.mjs";

const elements = {
  canvas: document.querySelector("#game-canvas"),
  score: document.querySelector('[data-testid="score"]'),
  lives: document.querySelector('[data-testid="lives"]'),
  level: document.querySelector("#level-readout"),
  muteButton: document.querySelector('[data-testid="mute-button"]'),
  muteLabel: document.querySelector("#mute-label"),
  startScreen: document.querySelector("#start-screen"),
  startButton: document.querySelector('[data-testid="start-button"]'),
  gameOverScreen: document.querySelector("#game-over-screen"),
  finalScore: document.querySelector("#final-score"),
  scoreForm: document.querySelector("#score-form"),
  playerName: document.querySelector('[data-testid="player-name"]'),
  submitScore: document.querySelector('[data-testid="submit-score"]'),
  scoreFormStatus: document.querySelector("#score-form-status"),
  restartButton: document.querySelector("#restart-button"),
  gameStatus: document.querySelector("#game-status"),
  leaderboardStatus: document.querySelector("#leaderboard-status"),
  leaderboard: document.querySelector('[data-testid="leaderboard"]'),
  touchControls: document.querySelector('[data-testid="touch-controls"]')
};

const context = elements.canvas.getContext("2d");
const config = window.__NEON_CONFIG__ ?? {};
const supabaseUrl = String(config.supabaseUrl ?? "").replace(/\/$/u, "");
const supabaseKey = String(config.supabaseKey ?? "");

const state = {
  phase: "ready",
  score: 0,
  lives: 3,
  level: 1,
  elapsed: 0,
  spawnTimer: 0.65,
  fireTimer: 0,
  lastFrame: 0,
  muted: readMutePreference(),
  keys: new Set(),
  touch: { up: false, down: false, left: false, right: false, fire: false },
  player: {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 72,
    width: 30,
    height: 24,
    speed: 430,
    invulnerable: 0
  },
  projectiles: [],
  enemies: [],
  particles: [],
  stars: createStars(92)
};

let audioContext = null;

function readMutePreference() {
  try {
    return window.localStorage.getItem("neon-barrage-muted") === "true";
  } catch (error) {
    console.warn("Mute preference could not be read.", error);
    return false;
  }
}

function writeMutePreference(muted) {
  try {
    window.localStorage.setItem("neon-barrage-muted", String(muted));
  } catch (error) {
    console.warn("Mute preference could not be saved.", error);
  }
}

function createStars(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    size: 0.6 + Math.random() * 2.2,
    speed: 10 + Math.random() * 42,
    alpha: 0.2 + Math.random() * 0.6
  }));
}

function announce(message) {
  elements.gameStatus.textContent = message;
}

function setStatus(element, message, tone = "") {
  element.textContent = message;
  if (tone) {
    element.dataset.tone = tone;
  } else {
    delete element.dataset.tone;
  }
}

function setOverlay(element, visible) {
  element.classList.toggle("hidden", !visible);
}

function renderHud() {
  elements.score.textContent = formatScore(state.score);
  elements.lives.textContent = String(state.lives);
  elements.level.textContent = String(state.level).padStart(2, "0");
}

function renderMuteButton() {
  elements.muteButton.setAttribute("aria-pressed", String(state.muted));
  elements.muteButton.setAttribute("aria-label", state.muted ? "Unmute sound" : "Mute sound");
  elements.muteLabel.textContent = state.muted ? "Sound off" : "Sound on";
}

function resetRun() {
  state.phase = "playing";
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.elapsed = 0;
  state.spawnTimer = 0.65;
  state.fireTimer = 0;
  state.player.x = GAME_WIDTH / 2;
  state.player.y = GAME_HEIGHT - 72;
  state.player.invulnerable = 0;
  state.projectiles = [];
  state.enemies = [];
  state.particles = [];
  setOverlay(elements.startScreen, false);
  setOverlay(elements.gameOverScreen, false);
  setStatus(elements.scoreFormStatus, "");
  elements.playerName.value = "";
  elements.submitScore.disabled = false;
  renderHud();
  announce("Run active. Move with Arrow keys or WASD and fire with Space.");
}

function startRun() {
  ensureAudio();
  resetRun();
  elements.canvas.focus();
  playTone(440, 0.09, "triangle", 0.045);
}

function endGame(finalScore = state.score) {
  const safeScore = isPlausibleScore(finalScore) ? finalScore : 0;
  state.phase = "gameover";
  state.score = safeScore;
  state.keys.clear();
  Object.keys(state.touch).forEach((key) => {
    state.touch[key] = false;
  });
  elements.finalScore.textContent = formatScore(state.score);
  setOverlay(elements.startScreen, false);
  setOverlay(elements.gameOverScreen, true);
  renderHud();
  announce(`Game over. Final score ${safeScore}. Enter a callsign to upload it.`);
  playTone(110, 0.28, "sawtooth", 0.05);
  window.setTimeout(() => elements.playerName.focus(), 40);
}

function ensureAudio() {
  if (state.muted || audioContext) {
    if (audioContext?.state === "suspended") {
      audioContext.resume().catch((error) => console.warn("Audio context could not resume.", error));
    }
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  audioContext = new AudioContextClass();
}

function playTone(frequency, duration, type, volume) {
  if (state.muted || !audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function spawnProjectile() {
  state.projectiles.push({
    x: state.player.x,
    y: state.player.y - 18,
    width: 7,
    height: 22,
    speed: 650,
    dead: false
  });
  playTone(720, 0.055, "square", 0.024);
}

function spawnEnemy() {
  const kindRoll = Math.random();
  const kind = kindRoll > 0.83 && state.level > 1 ? "heavy" : kindRoll > 0.55 ? "zig" : "drone";
  const size = kind === "heavy" ? 34 : kind === "zig" ? 25 : 22;
  state.enemies.push({
    x: 38 + Math.random() * (GAME_WIDTH - 76),
    y: -34,
    width: size,
    height: size,
    speed: (kind === "heavy" ? 66 : 90) + state.level * 16 + Math.random() * 34,
    drift: kind === "zig" ? 1.4 + Math.random() * 1.2 : 0,
    phase: Math.random() * Math.PI * 2,
    health: kind === "heavy" ? 2 : 1,
    kind,
    dead: false
  });
}

function createBurst(x, y, color, count = 12) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 145;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.55,
      maxLife: 0.85,
      size: 1.5 + Math.random() * 3,
      color
    });
  }
}

function damagePlayer() {
  if (state.player.invulnerable > 0 || state.phase !== "playing") {
    return;
  }

  state.lives -= 1;
  state.player.invulnerable = 1.25;
  createBurst(state.player.x, state.player.y, "#ff718e", 22);
  playTone(150, 0.2, "sawtooth", 0.06);
  renderHud();

  if (state.lives <= 0) {
    endGame(state.score);
  } else {
    announce(`${state.lives} lives remaining. Keep moving.`);
  }
}

function movePlayer(delta) {
  const left = state.keys.has("ArrowLeft") || state.keys.has("KeyA") || state.touch.left;
  const right = state.keys.has("ArrowRight") || state.keys.has("KeyD") || state.touch.right;
  const up = state.keys.has("ArrowUp") || state.keys.has("KeyW") || state.touch.up;
  const down = state.keys.has("ArrowDown") || state.keys.has("KeyS") || state.touch.down;
  const horizontal = Number(right) - Number(left);
  const vertical = Number(down) - Number(up);
  const diagonal = horizontal !== 0 && vertical !== 0 ? 0.72 : 1;

  state.player.x = clamp(
    state.player.x + horizontal * state.player.speed * diagonal * delta,
    state.player.width / 2 + 10,
    GAME_WIDTH - state.player.width / 2 - 10
  );
  state.player.y = clamp(
    state.player.y + vertical * state.player.speed * diagonal * delta,
    GAME_HEIGHT * 0.48,
    GAME_HEIGHT - state.player.height / 2 - 18
  );
}

function updateGame(delta) {
  state.elapsed += delta;
  state.level = difficultyForElapsed(state.elapsed);
  state.player.invulnerable = Math.max(0, state.player.invulnerable - delta);
  movePlayer(delta);

  const firing = state.keys.has("Space") || state.touch.fire;
  state.fireTimer = Math.max(0, state.fireTimer - delta);
  if (firing && state.fireTimer === 0) {
    ensureAudio();
    spawnProjectile();
    state.fireTimer = 0.14;
  }

  state.spawnTimer -= delta;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = Math.max(0.27, 0.82 - state.level * 0.07) + Math.random() * 0.24;
  }

  for (const projectile of state.projectiles) {
    projectile.y -= projectile.speed * delta;
    if (projectile.y < -30) {
      projectile.dead = true;
    }
  }

  for (const enemy of state.enemies) {
    enemy.y += enemy.speed * delta;
    if (enemy.drift) {
      enemy.x += Math.sin(state.elapsed * enemy.drift + enemy.phase) * 55 * delta;
      enemy.x = clamp(enemy.x, enemy.width / 2 + 8, GAME_WIDTH - enemy.width / 2 - 8);
    }

    if (enemy.y > GAME_HEIGHT + 34) {
      enemy.dead = true;
      damagePlayer();
    } else if (state.player.invulnerable === 0 && rectanglesOverlap(entityRect(enemy), entityRect(state.player))) {
      enemy.dead = true;
      damagePlayer();
    }
  }

  for (const projectile of state.projectiles) {
    if (projectile.dead) {
      continue;
    }
    for (const enemy of state.enemies) {
      if (enemy.dead || !rectanglesOverlap(entityRect(projectile), entityRect(enemy))) {
        continue;
      }
      projectile.dead = true;
      enemy.health -= 1;
      if (enemy.health <= 0) {
        enemy.dead = true;
        const points = enemy.kind === "heavy" ? 260 : enemy.kind === "zig" ? 150 : 100;
        state.score = Math.min(2147483647, state.score + points * state.level);
        createBurst(enemy.x, enemy.y, enemy.kind === "heavy" ? "#f5df76" : "#ff4fba", enemy.kind === "heavy" ? 24 : 14);
        playTone(enemy.kind === "heavy" ? 260 : 380, 0.09, "triangle", 0.035);
      } else {
        createBurst(enemy.x, enemy.y, "#f5df76", 6);
      }
      break;
    }
  }

  state.projectiles = state.projectiles.filter((projectile) => !projectile.dead);
  state.enemies = state.enemies.filter((enemy) => !enemy.dead);
  for (const particle of state.particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 38 * delta;
    particle.life -= delta;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
  renderHud();
}

function updateStars(delta) {
  for (const star of state.stars) {
    star.y += star.speed * delta * (state.phase === "playing" ? 1.7 : 0.45);
    if (star.y > GAME_HEIGHT + 4) {
      star.y = -4;
      star.x = Math.random() * GAME_WIDTH;
    }
  }
}

function drawScene() {
  const background = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  background.addColorStop(0, "#0b1530");
  background.addColorStop(0.52, "#071326");
  background.addColorStop(1, "#040817");
  context.fillStyle = background;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const glow = context.createRadialGradient(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.82, 20, GAME_WIDTH * 0.5, GAME_HEIGHT * 0.82, 330);
  glow.addColorStop(0, "rgba(49, 206, 239, 0.12)");
  glow.addColorStop(1, "rgba(49, 206, 239, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  context.save();
  for (const star of state.stars) {
    context.globalAlpha = star.alpha;
    context.fillStyle = star.size > 2 ? "#9bf2ff" : "#6682aa";
    context.fillRect(star.x, star.y, star.size, star.size);
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.2;
  context.strokeStyle = "#5d83b6";
  context.lineWidth = 1;
  for (let y = 72; y < GAME_HEIGHT; y += 72) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(GAME_WIDTH, y);
    context.stroke();
  }
  context.restore();

  for (const projectile of state.projectiles) {
    drawProjectile(projectile);
  }
  for (const enemy of state.enemies) {
    drawEnemy(enemy);
  }
  for (const particle of state.particles) {
    drawParticle(particle);
  }
  if (state.phase !== "gameover") {
    drawPlayer();
  }

  context.save();
  context.strokeStyle = "rgba(80, 229, 255, 0.45)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(18, 18);
  context.lineTo(62, 18);
  context.moveTo(18, 18);
  context.lineTo(18, 62);
  context.moveTo(GAME_WIDTH - 18, GAME_HEIGHT - 18);
  context.lineTo(GAME_WIDTH - 62, GAME_HEIGHT - 18);
  context.moveTo(GAME_WIDTH - 18, GAME_HEIGHT - 18);
  context.lineTo(GAME_WIDTH - 18, GAME_HEIGHT - 62);
  context.stroke();
  context.restore();
}

function drawPlayer() {
  if (state.player.invulnerable > 0 && Math.floor(state.player.invulnerable * 12) % 2 === 0) {
    return;
  }

  const { x, y } = state.player;
  context.save();
  context.translate(x, y);
  context.shadowBlur = 24;
  context.shadowColor = "#50e5ff";
  context.fillStyle = "#50e5ff";
  context.beginPath();
  context.moveTo(0, -18);
  context.lineTo(17, 12);
  context.lineTo(5, 9);
  context.lineTo(0, 18);
  context.lineTo(-5, 9);
  context.lineTo(-17, 12);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "#081527";
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(5, 5);
  context.lineTo(0, 9);
  context.lineTo(-5, 5);
  context.closePath();
  context.fill();
  context.fillStyle = "#ff4fba";
  context.fillRect(-2, 12, 4, 7 + Math.random() * 5);
  context.restore();
}

function drawProjectile(projectile) {
  context.save();
  context.shadowBlur = 14;
  context.shadowColor = "#9bf2ff";
  context.fillStyle = "#effcff";
  context.fillRect(projectile.x - 2, projectile.y - projectile.height / 2, 4, projectile.height);
  context.restore();
}

function drawEnemy(enemy) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(enemy.kind === "zig" ? state.elapsed * 1.5 : 0);
  const color = enemy.kind === "heavy" ? "#f5df76" : enemy.kind === "zig" ? "#50e5ff" : "#ff4fba";
  context.shadowBlur = 18;
  context.shadowColor = color;
  context.strokeStyle = color;
  context.fillStyle = "rgba(8, 15, 31, 0.9)";
  context.lineWidth = 2;
  context.beginPath();
  if (enemy.kind === "heavy") {
    context.rect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
    context.moveTo(-enemy.width / 2, 0);
    context.lineTo(enemy.width / 2, 0);
  } else if (enemy.kind === "zig") {
    context.moveTo(0, -enemy.height / 2);
    context.lineTo(enemy.width / 2, 0);
    context.lineTo(0, enemy.height / 2);
    context.lineTo(-enemy.width / 2, 0);
    context.closePath();
  } else {
    context.arc(0, 0, enemy.width / 2, 0, Math.PI * 2);
    context.moveTo(-enemy.width / 2 - 5, 0);
    context.lineTo(enemy.width / 2 + 5, 0);
  }
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.fillRect(-2, -2, 4, 4);
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

function frame(timestamp) {
  const delta = state.lastFrame ? Math.min(0.05, (timestamp - state.lastFrame) / 1000) : 0;
  state.lastFrame = timestamp;
  updateStars(delta);
  if (state.phase === "playing") {
    updateGame(delta);
  }
  drawScene();
  window.requestAnimationFrame(frame);
}

async function readResponseError(response) {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body);
    return parsed.message || parsed.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseKey);
}

async function loadLeaderboard() {
  if (!hasSupabaseConfig()) {
    setStatus(elements.leaderboardStatus, "Leaderboard is not configured yet.", "error");
    announce("Leaderboard configuration is missing. Local play remains available.");
    return;
  }

  setStatus(elements.leaderboardStatus, "Loading signal data...");
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/leaderboard?select=id,player_name,score,created_at&order=score.desc,created_at.asc&limit=10`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        },
        cache: "no-store"
      }
    );
    if (!response.ok) {
      throw new Error(await readResponseError(response));
    }
    const rows = await response.json();
    renderLeaderboard(Array.isArray(rows) ? rows : []);
  } catch (error) {
    console.error(JSON.stringify({ message: "leaderboard_load_failed", error: String(error) }));
    elements.leaderboard.replaceChildren();
    setStatus(elements.leaderboardStatus, "Signal unavailable. You can still play; retry after your run.", "error");
  }
}

function renderLeaderboard(rows) {
  elements.leaderboard.replaceChildren();
  if (rows.length === 0) {
    setStatus(elements.leaderboardStatus, "No signal yet. Be the first pilot.", "success");
    return;
  }

  setStatus(elements.leaderboardStatus, `${rows.length} signal${rows.length === 1 ? "" : "s"} locked in.`, "success");
  rows.forEach((row, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-row";
    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = String(row.player_name ?? "UNKNOWN");
    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = formatScore(Number(row.score));
    item.append(rank, name, score);
    elements.leaderboard.append(item);
  });
}

async function uploadScore(name, score) {
  if (!hasSupabaseConfig()) {
    throw new Error("Leaderboard is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/leaderboard`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ player_name: name, score })
  });
  if (!response.ok) {
    throw new Error(await readResponseError(response));
  }
}

function clearInput() {
  state.keys.clear();
  Object.keys(state.touch).forEach((key) => {
    state.touch[key] = false;
  });
  document.querySelectorAll("[data-touch].is-active").forEach((button) => button.classList.remove("is-active"));
}

function configureKeyboard() {
  const codes = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "Space"]);
  window.addEventListener("keydown", (event) => {
    if (!codes.has(event.code)) {
      return;
    }
    if (event.target instanceof HTMLInputElement && event.code === "Space") {
      return;
    }
    event.preventDefault();
    state.keys.add(event.code);
    if (event.code === "Space") {
      ensureAudio();
    }
  });
  window.addEventListener("keyup", (event) => {
    state.keys.delete(event.code);
  });
  window.addEventListener("blur", clearInput);
}

function configureTouch() {
  elements.touchControls.querySelectorAll("[data-touch]").forEach((button) => {
    const action = button.dataset.touch;
    const setActive = (active) => {
      state.touch[action] = active;
      button.classList.toggle("is-active", active);
      if (active) {
        ensureAudio();
      }
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      setActive(true);
    });
    button.addEventListener("pointerup", (event) => {
      event.preventDefault();
      setActive(false);
    });
    button.addEventListener("pointercancel", () => setActive(false));
    button.addEventListener("pointerleave", () => setActive(false));
  });
}

function configureControls() {
  elements.startButton.addEventListener("click", startRun);
  elements.restartButton.addEventListener("click", startRun);
  elements.muteButton.addEventListener("click", () => {
    state.muted = !state.muted;
    writeMutePreference(state.muted);
    renderMuteButton();
    if (!state.muted) {
      ensureAudio();
      playTone(520, 0.08, "triangle", 0.035);
    }
    announce(state.muted ? "Sound muted." : "Sound enabled.");
  });
  elements.scoreForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = elements.playerName.value.trim();
    if (!isValidPlayerName(name)) {
      setStatus(elements.scoreFormStatus, "Use 1-16 characters with no line breaks.", "error");
      elements.playerName.focus();
      return;
    }
    if (!isPlausibleScore(state.score)) {
      setStatus(elements.scoreFormStatus, "This score is not valid.", "error");
      return;
    }

    elements.submitScore.disabled = true;
    setStatus(elements.scoreFormStatus, "Uploading your signal...");
    try {
      await uploadScore(name, state.score);
      setStatus(elements.scoreFormStatus, "Score locked. Check the top signal.", "success");
      announce("Score uploaded successfully.");
      await loadLeaderboard();
    } catch (error) {
      console.error(JSON.stringify({ message: "leaderboard_upload_failed", error: String(error) }));
      elements.submitScore.disabled = false;
      setStatus(elements.scoreFormStatus, "Upload failed. Check your connection and try again.", "error");
      announce("Score upload failed. You can retry without losing the run result.");
    }
  });
  configureKeyboard();
  configureTouch();
}

window.__NEON_BARRAGE__ = Object.freeze({
  getState: () => ({
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    playerX: Math.round(state.player.x),
    playerY: Math.round(state.player.y),
    enemyCount: state.enemies.length,
    projectileCount: state.projectiles.length
  }),
  endGameForTest: (score) => {
    const safeScore = Number.isInteger(score) && score >= 0 ? score : 0;
    endGame(safeScore);
  }
});

renderHud();
renderMuteButton();
configureControls();
loadLeaderboard();
window.requestAnimationFrame(frame);
