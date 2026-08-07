import {
  createGame,
  forceGameOver,
  resetGame,
  stepGame
} from "/src/game-engine.js";

const canvas = document.querySelector('[data-testid="game-canvas"]');
const ctx = canvas.getContext("2d");
const startButton = document.querySelector('[data-testid="start-button"]');
const muteButton = document.querySelector('[data-testid="mute-button"]');
const scoreNode = document.querySelector('[data-testid="score"]');
const livesNode = document.querySelector('[data-testid="lives"]');
const waveNode = document.querySelector("#wave");
const startOverlay = document.querySelector("#start-overlay");
const gameOverOverlay = document.querySelector("#game-over-overlay");
const finalScoreNode = document.querySelector("#final-score");
const scoreForm = document.querySelector("#score-form");
const playerName = document.querySelector('[data-testid="player-name"]');
const submitButton = document.querySelector('[data-testid="submit-score"]');
const formMessage = document.querySelector("#form-message");
const restartButton = document.querySelector("#restart-button");
const statusText = document.querySelector("#status-text");
const leaderboardNode = document.querySelector('[data-testid="leaderboard"]');
const leaderboardRefresh = document.querySelector("#leaderboard-refresh");
const connectionStatus = document.querySelector("#connection-status");
const connectionDetail = document.querySelector("#connection-detail");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const config = window.NEON_BARRAGE_CONFIG ?? {};
const input = { left: false, right: false, up: false, down: false, fire: false };
const stars = Array.from({ length: 84 }, (_, index) => ({
  x: (index * 137.31) % WIDTH,
  y: (index * 83.17) % HEIGHT,
  size: index % 7 === 0 ? 2 : 1,
  speed: 0.2 + (index % 5) * 0.11,
  phase: (index * 0.73) % (Math.PI * 2)
}));

const gameOptions = {
  arena: { width: WIDTH, height: HEIGHT },
  player: { width: 48, height: 28 },
  projectile: { width: 6, height: 18 },
  enemy: { width: 34, height: 28 },
  random: Math.random,
  autoStart: false
};
let game = createGame(gameOptions);
let animationFrame = 0;
let lastFrameTime = performance.now();
let lastPhase = getPhase(game);
let hasStarted = false;
let muted = false;
let audioContext;
let audioBus;
let leaderboardRequest;

function getPhase(state) {
  return String(state?.phase ?? "ready").toLowerCase();
}

function getEnemies(state) {
  return Array.isArray(state?.enemies) ? state.enemies : [];
}

function getProjectiles(state) {
  return Array.isArray(state?.projectiles) ? state.projectiles : [];
}

function formatScore(value) {
  return String(Math.max(0, Math.floor(Number(value) || 0))).padStart(6, "0");
}

function isPlaying() {
  return getPhase(game) === "playing" || getPhase(game) === "active" || getPhase(game) === "running";
}

function setHidden(node, hidden) {
  node.classList.toggle("is-hidden", hidden);
  node.setAttribute("aria-hidden", String(hidden));
}

function setStatus(text, tone = "ready") {
  statusText.textContent = text;
  const status = document.querySelector("#game-status");
  status.dataset.tone = tone;
}

function normalizeState(next) {
  return next && typeof next === "object" ? next : game;
}

function startGame() {
  ensureAudio();
  game = normalizeState(resetGame(game));
  // The engine preserves the configured ready phase across resets; the start
  // control is the explicit user transition into the same playing phase used
  // by normal gameplay.
  game.phase = "playing";
  hasStarted = true;
  lastPhase = getPhase(game);
  setHidden(startOverlay, true);
  setHidden(gameOverOverlay, true);
  formMessage.textContent = "";
  playerName.value = "";
  setStatus("SYSTEMS LIVE", "live");
  playTone("start");
  renderHud();
}

function transitionToGameOver() {
  if (getPhase(game) !== "gameover" && getPhase(game) !== "game-over") return;
  const finalScore = Math.max(0, Math.floor(Number(game.score) || 0));
  finalScoreNode.textContent = formatScore(finalScore);
  setHidden(startOverlay, true);
  setHidden(gameOverOverlay, false);
  setStatus("SIGNAL LOST", "danger");
  playerName.focus({ preventScroll: true });
  playTone("gameover");
}

function endGameForTest(score) {
  if (!Number.isInteger(score) || score < 0) return false;
  ensureAudio();
  game = normalizeState(forceGameOver(game, score));
  hasStarted = true;
  transitionToGameOver();
  renderHud();
  return true;
}

function resetToReady() {
  game = normalizeState(resetGame(game));
  hasStarted = false;
  lastPhase = getPhase(game);
  setHidden(gameOverOverlay, true);
  setHidden(startOverlay, false);
  setStatus("SYSTEMS READY", "ready");
  renderHud();
}

function handleKey(event, pressed) {
  const key = event.key.toLowerCase();
  const action = {
    arrowleft: "left",
    a: "left",
    arrowright: "right",
    d: "right",
    arrowup: "up",
    w: "up",
    arrowdown: "down",
    s: "down",
    " ": "fire",
    spacebar: "fire"
  }[key];
  if (!action) return;
  event.preventDefault();
  input[action] = pressed;
  if (pressed) {
    ensureAudio();
    if (!hasStarted && getPhase(game) !== "gameover" && getPhase(game) !== "game-over") startGame();
  }
}

function wireInputs() {
  window.addEventListener("keydown", (event) => handleKey(event, true), { passive: false });
  window.addEventListener("keyup", (event) => handleKey(event, false), { passive: false });

  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;
    const press = (event) => {
      event.preventDefault();
      input[action] = true;
      ensureAudio();
      if (!hasStarted && getPhase(game) !== "gameover" && getPhase(game) !== "game-over") startGame();
      button.classList.add("is-pressed");
    };
    const release = (event) => {
      event.preventDefault();
      input[action] = false;
      button.classList.remove("is-pressed");
    };
    button.addEventListener("pointerdown", press, { passive: false });
    button.addEventListener("pointerup", release, { passive: false });
    button.addEventListener("pointercancel", release, { passive: false });
    button.addEventListener("pointerleave", release, { passive: false });
  });
}

function ensureAudio() {
  if (muted || audioContext) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  audioContext = new AudioCtor();
  audioBus = audioContext.createGain();
  audioBus.gain.value = 0.045;
  audioBus.connect(audioContext.destination);
}

function playTone(kind) {
  if (muted || !audioContext || !audioBus) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const presets = {
    shot: [520, 0.045, "square"],
    hit: [180, 0.1, "sawtooth"],
    start: [260, 0.24, "triangle"],
    gameover: [110, 0.38, "sine"]
  };
  const [frequency, duration, type] = presets[kind] ?? presets.shot;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.42), now + duration);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(1, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioBus);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function toggleMute() {
  muted = !muted;
  muteButton.setAttribute("aria-pressed", String(muted));
  muteButton.querySelector(".mute-label").textContent = muted ? "SOUND OFF" : "SOUND ON";
  muteButton.querySelector(".mute-icon").textContent = muted ? "×" : "◖";
  if (!muted) ensureAudio();
  if (audioBus) audioBus.gain.value = muted ? 0 : 0.045;
}

function renderHud() {
  scoreNode.textContent = formatScore(game.score);
  const lives = Math.max(0, Math.floor(Number(game.lives) || 0));
  livesNode.textContent = lives > 0 ? `${"♥ ".repeat(lives).trim()}` : "— — —";
  waveNode.textContent = String(Math.max(1, Math.floor(Number(game.wave) || 1))).padStart(2, "0");
}

function drawBackground(timestamp) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#090d23");
  gradient.addColorStop(0.54, "#111331");
  gradient.addColorStop(1, "#180c26");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.62, 5, WIDTH * 0.5, HEIGHT * 0.62, WIDTH * 0.7);
  glow.addColorStop(0, "rgba(55, 217, 255, .15)");
  glow.addColorStop(1, "rgba(55, 217, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  stars.forEach((star) => {
    const y = (star.y + timestamp * 0.018 * star.speed) % HEIGHT;
    const alpha = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(timestamp * 0.002 + star.phase));
    ctx.fillStyle = `rgba(171, 239, 255, ${alpha})`;
    ctx.fillRect(star.x, y, star.size, star.size);
  });
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#5f65bd";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(52, 235, 255, .16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT - 42);
  ctx.lineTo(WIDTH, HEIGHT - 42);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(state, timestamp) {
  const x = Number(state.playerX ?? WIDTH / 2);
  const y = Number(state.playerY ?? HEIGHT - 82);
  const pulse = 1 + Math.sin(timestamp * 0.01) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.shadowBlur = 22;
  ctx.shadowColor = "#41efff";
  ctx.fillStyle = "#a5fbff";
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.lineTo(24, 21);
  ctx.lineTo(0, 13);
  ctx.lineTo(-24, 21);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#5f46ff";
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(9, 14);
  ctx.lineTo(0, 9);
  ctx.lineTo(-9, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ff45cf";
  ctx.fillRect(-3, 14, 6, 10 + Math.sin(timestamp * 0.02) * 3);
  ctx.restore();
}

function drawEnemy(enemy, timestamp) {
  const x = Number(enemy.x ?? 0);
  const y = Number(enemy.y ?? 0);
  const size = Number(enemy.size ?? enemy.radius ?? 18);
  const elite = enemy.type === "elite" || enemy.kind === "elite" || enemy.isElite;
  const color = elite ? "#ff4fd8" : "#ff6b74";
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((timestamp * (elite ? 0.001 : -0.0007)) + Number(enemy.rotation ?? 0));
  ctx.shadowBlur = 16;
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.fillStyle = elite ? "rgba(255, 52, 204, .17)" : "rgba(255, 76, 96, .16)";
  ctx.lineWidth = elite ? 3 : 2;
  ctx.beginPath();
  const points = elite ? 6 : 4;
  for (let i = 0; i < points; i += 1) {
    const angle = (Math.PI * 2 * i) / points;
    const radius = i % 2 === 0 ? size : size * 0.58;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fff0fa";
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, size * 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawProjectile(projectile) {
  const x = Number(projectile.x ?? 0);
  const y = Number(projectile.y ?? 0);
  const radius = Number(projectile.radius ?? projectile.size ?? 4);
  const enemyShot = projectile.owner === "enemy" || projectile.fromEnemy;
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = enemyShot ? "#ff597d" : "#72f6ff";
  ctx.fillStyle = enemyShot ? "#ff597d" : "#d8ffff";
  ctx.beginPath();
  ctx.roundRect(x - radius, y - radius * 2.5, radius * 2, radius * 5, radius);
  ctx.fill();
  ctx.restore();
}

function render(timestamp) {
  drawBackground(timestamp);
  const enemies = getEnemies(game);
  const projectiles = getProjectiles(game);
  projectiles.forEach(drawProjectile);
  enemies.forEach((enemy) => drawEnemy(enemy, timestamp));
  if (getPhase(game) !== "gameover" && getPhase(game) !== "game-over") drawPlayer(game, timestamp);
}

function gameLoop(timestamp) {
  const elapsed = Math.min(0.05, Math.max(0, (timestamp - lastFrameTime) / 1000));
  lastFrameTime = timestamp;
  if (isPlaying()) {
    const beforeProjectiles = getProjectiles(game).length;
    game = normalizeState(stepGame(game, input, elapsed));
    if (getProjectiles(game).length > beforeProjectiles) playTone("shot");
    renderHud();
    const phase = getPhase(game);
    if (phase !== lastPhase && (phase === "gameover" || phase === "game-over")) transitionToGameOver();
    lastPhase = phase;
  }
  render(timestamp);
  animationFrame = requestAnimationFrame(gameLoop);
}

function hasSupabaseConfig() {
  return typeof config.supabaseUrl === "string" && /^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.supabaseUrl) && typeof config.supabaseAnonKey === "string" && config.supabaseAnonKey.length > 20;
}

function apiUrl(path) {
  return `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`;
}

async function supabaseFetch(path, options = {}) {
  if (!hasSupabaseConfig()) throw new Error("Leaderboard is not configured yet.");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      }
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || `Leaderboard request failed (${response.status}).`);
    }
    return response;
  } finally {
    window.clearTimeout(timer);
  }
}

function setLeaderboardState(message, tone = "neutral") {
  leaderboardNode.innerHTML = `<p class="leaderboard-state ${tone}-state">${message}</p>`;
}

function renderLeaderboard(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    setLeaderboardState("No pilots logged yet. Be first on the board.", "empty");
    leaderboardRefresh.textContent = "EMPTY";
    return;
  }
  const safeRows = rows.slice(0, 10);
  const table = document.createElement("table");
  table.className = "leaderboard-table";
  table.innerHTML = `<caption class="sr-only">Top ten Neon Barrage pilots</caption><thead><tr><th scope="col">#</th><th scope="col">CALLSIGN</th><th scope="col">SCORE</th></tr></thead>`;
  const body = document.createElement("tbody");
  safeRows.forEach((row, index) => {
    const tr = document.createElement("tr");
    const name = String(row.player_name ?? "UNKNOWN").slice(0, 16);
    const score = Number.isFinite(Number(row.score)) ? formatScore(row.score) : "000000";
    tr.innerHTML = `<td><span class="rank rank-${index + 1}">${String(index + 1).padStart(2, "0")}</span></td><th scope="row">${escapeHtml(name)}</th><td>${score}</td>`;
    body.appendChild(tr);
  });
  table.appendChild(body);
  leaderboardNode.replaceChildren(table);
  leaderboardRefresh.textContent = "LIVE";
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

async function loadLeaderboard() {
  if (leaderboardRequest) leaderboardRequest.abort();
  leaderboardRequest = new AbortController();
  setLeaderboardState("Reading the flight log<span class=\"loading-dots\">...</span>", "loading");
  leaderboardRefresh.textContent = "SYNCING";
  try {
    const response = await supabaseFetch("leaderboard?select=player_name,score,created_at&candidate_id=eq.native_isolated&order=score.desc,created_at.asc&limit=10", { signal: leaderboardRequest.signal });
    const rows = await response.json();
    renderLeaderboard(rows);
    connectionStatus.textContent = "ONLINE";
    connectionDetail.textContent = "Scores are syncing globally.";
  } catch (error) {
    if (error.name === "AbortError") return;
    setLeaderboardState("Flight log unavailable. Try again after your run.", "error");
    leaderboardRefresh.textContent = "OFFLINE";
    connectionStatus.textContent = "OFFLINE";
    connectionDetail.textContent = "Your run is still playable; leaderboard sync is paused.";
  }
}

async function submitScore(event) {
  event.preventDefault();
  const name = playerName.value.trim();
  const score = Math.max(0, Math.floor(Number(game.score) || 0));
  if (name.length < 1 || name.length > 16 || /[\u0000-\u001f\u007f]/.test(name)) {
    formMessage.textContent = "Use a callsign from 1 to 16 visible characters.";
    formMessage.dataset.tone = "error";
    playerName.focus();
    return;
  }
  if (!Number.isSafeInteger(score) || score < 0 || score > 2147483647) {
    formMessage.textContent = "That score is outside the safe flight range.";
    formMessage.dataset.tone = "error";
    return;
  }
  submitButton.disabled = true;
  formMessage.textContent = "Uploading your run...";
  formMessage.dataset.tone = "loading";
  try {
    await supabaseFetch("leaderboard", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ candidate_id: "native_isolated", player_name: name, score })
    });
    formMessage.textContent = "Run logged. Welcome to the flight log.";
    formMessage.dataset.tone = "success";
    playTone("start");
    await loadLeaderboard();
  } catch (error) {
    formMessage.textContent = "Could not reach the flight log. Check your connection and try again.";
    formMessage.dataset.tone = "error";
  } finally {
    submitButton.disabled = false;
  }
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
muteButton.addEventListener("click", () => {
  ensureAudio();
  toggleMute();
});
scoreForm.addEventListener("submit", submitScore);
wireInputs();
loadLeaderboard();
renderHud();
render(performance.now());
animationFrame = requestAnimationFrame(gameLoop);

window.__NEON_BARRAGE__ = Object.freeze({
  getState: () => ({
    phase: getPhase(game),
    score: Math.max(0, Math.floor(Number(game.score) || 0)),
    lives: Math.max(0, Math.floor(Number(game.lives) || 0)),
    playerX: Number(game.playerX ?? 0),
    playerY: Number(game.playerY ?? 0),
    enemyCount: getEnemies(game).length,
    projectileCount: getProjectiles(game).length
  }),
  endGameForTest
});

window.addEventListener("pagehide", () => cancelAnimationFrame(animationFrame));
