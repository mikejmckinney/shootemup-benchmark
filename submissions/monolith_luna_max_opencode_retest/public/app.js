import { WORLD, createGame, forceGameOver, getPublicState, startGame, stepGame } from "./engine.js";

const canvas = document.querySelector('[data-testid="game-canvas"]');
const context = canvas.getContext("2d");
const startButton = document.querySelector('[data-testid="start-button"]');
const scoreDisplay = document.querySelector('[data-testid="score"]');
const livesDisplay = document.querySelector('[data-testid="lives"]');
const muteButton = document.querySelector('[data-testid="mute-button"]');
const readyOverlay = document.querySelector("#ready-overlay");
const gameOverPanel = document.querySelector("#game-over-panel");
const finalScore = document.querySelector("#final-score");
const nameInput = document.querySelector('[data-testid="player-name"]');
const submitButton = document.querySelector('[data-testid="submit-score"]');
const submissionStatus = document.querySelector("#submission-status");
const leaderboard = document.querySelector('[data-testid="leaderboard"]');
const leaderboardStatus = document.querySelector("#leaderboard-status");
const leaderboardError = document.querySelector("#leaderboard-error");
const missionStatus = document.querySelector("#mission-status");
const hudMessage = document.querySelector("#hud-message");
const waveLabel = document.querySelector("#wave-label");
const config = window.__NEON_BARRAGE_CONFIG__ ?? { url: "", anonKey: "" };

let game = createGame();
let animationFrame = 0;
let lastFrame = 0;
let audioContext;
let muted = false;
let canvasScale = 1;
const input = { left: false, right: false, up: false, down: false, fire: false };
const stars = Array.from({ length: 90 }, (_, index) => ({
  x: (index * 157.3) % WORLD.width,
  y: (index * 83.7) % WORLD.height,
  size: index % 9 === 0 ? 2 : 1,
  speed: 9 + (index % 5) * 7,
  alpha: 0.22 + (index % 6) * 0.1
}));

function formatScore(value) {
  return String(Math.max(0, Math.floor(value))).padStart(6, "0");
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  canvasScale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(bounds.width * canvasScale));
  canvas.height = Math.max(1, Math.floor((bounds.width * WORLD.height / WORLD.width) * canvasScale));
  context.setTransform(canvas.width / WORLD.width, 0, 0, canvas.height / WORLD.height, 0, 0);
}

function drawGlowCircle(x, y, radius, color, alpha = 1) {
  context.save();
  context.globalAlpha = alpha;
  context.shadowColor = color;
  context.shadowBlur = radius * 3;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBackground() {
  context.clearRect(0, 0, WORLD.width, WORLD.height);
  const gradient = context.createLinearGradient(0, 0, 0, WORLD.height);
  gradient.addColorStop(0, "#080a27");
  gradient.addColorStop(0.5, "#070820");
  gradient.addColorStop(1, "#10091f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, WORLD.width, WORLD.height);

  const glow = context.createRadialGradient(WORLD.width * 0.5, WORLD.height * 0.88, 10, WORLD.width * 0.5, WORLD.height * 0.88, 430);
  glow.addColorStop(0, "rgba(255, 79, 154, 0.12)");
  glow.addColorStop(1, "rgba(255, 79, 154, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, WORLD.width, WORLD.height);

  for (const star of stars) {
    const y = (star.y + game.elapsed * star.speed) % WORLD.height;
    context.globalAlpha = star.alpha;
    context.fillStyle = star.size === 2 ? "#a786ff" : "#a8c8ff";
    context.fillRect(star.x, y, star.size, star.size);
  }
  context.globalAlpha = 1;

  context.lineWidth = 1;
  context.strokeStyle = "rgba(84, 246, 220, 0.065)";
  for (let x = 0; x <= WORLD.width; x += 48) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, WORLD.height); context.stroke(); }
  for (let y = 0; y <= WORLD.height; y += 48) { context.beginPath(); context.moveTo(0, y); context.lineTo(WORLD.width, y); context.stroke(); }
  context.strokeStyle = "rgba(255, 79, 154, 0.14)";
  context.beginPath(); context.moveTo(0, WORLD.height - 47); context.lineTo(WORLD.width, WORLD.height - 47); context.stroke();
}

function drawPlayer() {
  const { x, y, radius } = game.player;
  if (game.invulnerable > 0 && Math.floor(game.invulnerable * 12) % 2 === 0) return;
  context.save();
  context.translate(x, y);
  context.shadowColor = "#54f6dc";
  context.shadowBlur = 18;
  context.fillStyle = "#54f6dc";
  context.beginPath();
  context.moveTo(0, -radius - 9);
  context.lineTo(radius + 9, radius + 10);
  context.lineTo(0, radius + 3);
  context.lineTo(-radius - 9, radius + 10);
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "#12143b";
  context.beginPath();
  context.moveTo(0, -radius + 1);
  context.lineTo(5, radius + 5);
  context.lineTo(0, radius + 2);
  context.lineTo(-5, radius + 5);
  context.closePath();
  context.fill();
  context.fillStyle = "#ff4f9a";
  context.fillRect(-3, radius + 6, 6, 7 + Math.sin(game.elapsed * 22) * 3);
  context.restore();
}

function drawEnemy(enemy) {
  const color = enemy.heavy ? "#a786ff" : "#ff4f9a";
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(Math.sin(game.elapsed * 2 + enemy.phase) * 0.12);
  context.shadowColor = color;
  context.shadowBlur = 16;
  context.strokeStyle = color;
  context.fillStyle = enemy.heavy ? "rgba(167, 134, 255, 0.18)" : "rgba(255, 79, 154, 0.16)";
  context.lineWidth = 2;
  context.beginPath();
  if (enemy.heavy) {
    context.moveTo(0, -enemy.radius - 4); context.lineTo(enemy.radius + 2, 0); context.lineTo(0, enemy.radius + 4); context.lineTo(-enemy.radius - 2, 0);
  } else {
    context.moveTo(0, -enemy.radius); context.lineTo(enemy.radius, enemy.radius * 0.7); context.lineTo(0, enemy.radius * 0.35); context.lineTo(-enemy.radius, enemy.radius * 0.7);
  }
  context.closePath(); context.fill(); context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.fillRect(-3, -3, 6, 6);
  if (enemy.heavy && enemy.hp < enemy.maxHp) { context.fillStyle = "#f5df68"; context.fillRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 2); }
  context.restore();
}

function drawWorld() {
  drawBackground();
  for (const particle of game.particles) {
    drawGlowCircle(particle.x, particle.y, 2.2, particle.color, Math.max(0, particle.life / particle.maxLife));
  }
  for (const projectile of game.projectiles) {
    context.save(); context.strokeStyle = "#54f6dc"; context.shadowColor = "#54f6dc"; context.shadowBlur = 13; context.lineWidth = 3; context.beginPath(); context.moveTo(projectile.x, projectile.y + 9); context.lineTo(projectile.x, projectile.y - 8); context.stroke(); context.restore();
  }
  for (const projectile of game.enemyProjectiles) {
    context.save(); context.strokeStyle = "#ff4f9a"; context.shadowColor = "#ff4f9a"; context.shadowBlur = 12; context.lineWidth = 3; context.beginPath(); context.moveTo(projectile.x, projectile.y - 7); context.lineTo(projectile.x, projectile.y + 7); context.stroke(); context.restore();
  }
  for (const enemy of game.enemies) drawEnemy(enemy);
  drawPlayer();
  context.save(); context.strokeStyle = "rgba(84, 246, 220, 0.32)"; context.setLineDash([2, 9]); context.lineWidth = 1; context.beginPath(); context.moveTo(0, 18); context.lineTo(WORLD.width, 18); context.stroke(); context.restore();
}

function updateHud() {
  const publicState = getPublicState(game);
  scoreDisplay.textContent = formatScore(publicState.score);
  livesDisplay.textContent = "●".repeat(publicState.lives) + "○".repeat(3 - publicState.lives);
  livesDisplay.setAttribute("aria-label", `${publicState.lives} lives`);
  waveLabel.textContent = `WAVE ${String(game.wave).padStart(2, "0")}`;
  if (game.phase === "playing") {
    readyOverlay.hidden = true;
    hudMessage.textContent = "LIVE / SURVIVE";
    missionStatus.textContent = `SIGNAL ACTIVE / WAVE ${String(game.wave).padStart(2, "0")}`;
    startButton.querySelector(".launch-text").textContent = "RESTART RUN";
  } else if (game.phase === "gameover") {
    hudMessage.textContent = "RUN COMPLETE";
    missionStatus.textContent = "SIGNAL LOST / SCORE READY TO POST";
    startButton.querySelector(".launch-text").textContent = "NEW RUN";
  } else {
    hudMessage.textContent = "AWAITING LAUNCH";
    missionStatus.textContent = "SYSTEMS NOMINAL / AWAITING PILOT";
    startButton.querySelector(".launch-text").textContent = "LAUNCH RUN";
  }
}

function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
}

function tone(frequency, duration = 0.08, type = "square", volume = 0.025) {
  if (muted || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}

function endGame(score = game.score) {
  if (!forceGameOver(game, score)) return;
  cancelAnimationFrame(animationFrame);
  gameOverPanel.hidden = false;
  finalScore.textContent = formatScore(game.score);
  submissionStatus.textContent = "ENTER A PILOT TAG TO POST THIS RUN";
  submitButton.disabled = false;
  tone(110, 0.3, "sawtooth", 0.045);
  drawWorld(); updateHud();
}

function startRun() {
  ensureAudio();
  gameOverPanel.hidden = true;
  submissionStatus.textContent = "";
  submitButton.disabled = true;
  nameInput.value = "";
  startGame(game);
  tone(220, 0.08, "triangle", 0.035); window.setTimeout(() => tone(440, 0.1, "triangle", 0.025), 70);
  lastFrame = performance.now();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
  drawWorld(); updateHud();
}

function loop(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  stepGame(game, input, dt);
  drawWorld(); updateHud();
  if (game.phase === "gameover") { endGame(game.score); return; }
  animationFrame = requestAnimationFrame(loop);
}

function setInput(key, active) {
  if (key in input) input[key] = active;
}

const keyMap = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", " ": "fire" };
window.addEventListener("keydown", (event) => {
  const action = keyMap[event.key];
  if (!action) return;
  event.preventDefault();
  ensureAudio();
  if (game.phase === "ready" && action === "fire") startRun();
  setInput(action, true);
});
window.addEventListener("keyup", (event) => { const action = keyMap[event.key]; if (action) { event.preventDefault(); setInput(action, false); } });
window.addEventListener("blur", () => Object.keys(input).forEach((key) => { input[key] = false; }));

document.querySelectorAll("[data-control]").forEach((control) => {
  const action = control.dataset.control;
  const press = (event) => { event.preventDefault(); ensureAudio(); setInput(action, true); };
  const release = (event) => { event.preventDefault(); setInput(action, false); };
  control.addEventListener("pointerdown", press); control.addEventListener("pointerup", release); control.addEventListener("pointercancel", release); control.addEventListener("pointerleave", release);
});

startButton.addEventListener("click", startRun);
muteButton.addEventListener("click", () => {
  ensureAudio(); muted = !muted; muteButton.setAttribute("aria-pressed", String(muted)); muteButton.setAttribute("aria-label", muted ? "Sound off" : "Sound on"); muteButton.querySelector(".mute-label").textContent = muted ? "SOUND OFF" : "SOUND ON";
  if (!muted) tone(520, 0.06, "sine", 0.02);
});

function validName(name) { return /^[A-Za-z0-9 _-]{1,16}$/.test(name); }

function renderLeaderboard(rows) {
  leaderboard.replaceChildren();
  if (!rows.length) {
    const item = document.createElement("li"); item.className = "leaderboard-message"; item.textContent = "NO PILOT SIGNALS YET / BE FIRST TO POST"; leaderboard.append(item); return;
  }
  rows.slice(0, 10).forEach((row, index) => {
    const item = document.createElement("li");
    const rank = document.createElement("span"); rank.className = "rank"; rank.textContent = String(index + 1).padStart(2, "0");
    const pilot = document.createElement("span"); pilot.className = "pilot"; pilot.textContent = row.player_name;
    const date = document.createElement("small"); date.textContent = row.created_at ? new Date(row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase() : ""; pilot.append(date);
    const points = document.createElement("span"); points.className = "points"; points.textContent = formatScore(row.score);
    item.append(rank, pilot, points); leaderboard.append(item);
  });
}

async function loadLeaderboard() {
  leaderboardStatus.textContent = "SYNCING"; leaderboardError.hidden = true;
  if (!config.url || !config.anonKey) { leaderboardStatus.textContent = "OFFLINE"; leaderboardError.textContent = "LEADERBOARD CONFIGURATION PENDING"; leaderboardError.hidden = false; renderLeaderboard([]); return; }
  try {
    const response = await fetch(`${config.url}/rest/v1/leaderboard_entries?select=player_name,score,created_at&order=score.desc,created_at.asc&limit=10`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } });
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status})`);
    renderLeaderboard(await response.json()); leaderboardStatus.textContent = "LIVE";
  } catch (error) {
    leaderboardStatus.textContent = "RETRY NEEDED"; leaderboardError.textContent = "PILOT LOG UNAVAILABLE / CHECK CONNECTION"; leaderboardError.hidden = false; renderLeaderboard([]);
  }
}

submitButton.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!validName(name)) { submissionStatus.textContent = "USE 1–16 LETTERS, NUMBERS, SPACES, - OR _"; nameInput.focus(); return; }
  if (!config.url || !config.anonKey) { submissionStatus.textContent = "LEADERBOARD IS OFFLINE RIGHT NOW"; return; }
  submitButton.disabled = true; submissionStatus.textContent = "POSTING PILOT SIGNAL...";
  try {
    const response = await fetch(`${config.url}/rest/v1/leaderboard_entries`, { method: "POST", headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ player_name: name, score: game.score }) });
    if (!response.ok) throw new Error(`Score submission failed (${response.status})`);
    submissionStatus.textContent = "SIGNAL POSTED / PILOT LOG UPDATED"; tone(660, 0.1, "triangle", 0.025); await loadLeaderboard();
  } catch (error) { submitButton.disabled = false; submissionStatus.textContent = "POST FAILED / TRY AGAIN WHEN SIGNAL RETURNS"; }
});

window.__NEON_BARRAGE__ = {
  getState: () => getPublicState(game),
  endGameForTest: (score) => { if (Number.isInteger(score) && score >= 0) endGame(score); }
};

window.addEventListener("resize", () => { resizeCanvas(); drawWorld(); });
resizeCanvas(); drawWorld(); updateHud(); loadLeaderboard();
