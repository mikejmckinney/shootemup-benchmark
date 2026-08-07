import { difficultyForScore, formatScore, rectanglesOverlap, validateSubmission } from "./src/game-logic.mjs";
import { getDifficulty as workerDifficulty } from "./src/game-engine.js";
import { fetchLeaderboard, submitLeaderboardScore } from "./supabase-client.js";

const canvas = document.querySelector('[data-testid="game-canvas"]');
const ctx = canvas.getContext("2d");
const W = 1000;
const H = 600;
const scoreEl = document.querySelector('[data-testid="score"]');
const livesEl = document.querySelector('[data-testid="lives"]');
const phaseEl = document.querySelector("#phase-label");
const statusEl = document.querySelector("#status-message");
const levelEl = document.querySelector("#level-value");
const overlay = document.querySelector("#game-overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const startButton = document.querySelector('[data-testid="start-button"]');
const restartButton = document.querySelector('[data-testid="restart-button"]');
const muteButton = document.querySelector('[data-testid="mute-button"]');
const telemetry = document.querySelector("#telemetry");
const nameInput = document.querySelector('[data-testid="player-name"]');
const submitButton = document.querySelector('[data-testid="submit-score"]');
const scoreForm = document.querySelector("#score-form");
const formMessage = document.querySelector("#submit-message");
const leaderboardList = document.querySelector('[data-testid="leaderboard"]');
const leaderboardState = document.querySelector("#leaderboard-state");
const localBest = document.querySelector("#local-best");

const input = { keys: new Set(), touch: new Set() };
const state = {
  phase: "idle",
  score: 0,
  lives: 3,
  playerX: W / 2,
  playerY: H - 86,
  enemyCount: 0,
  projectileCount: 0,
  level: 1,
  muted: false,
  lastTime: 0,
  spawnTimer: 0,
  elapsed: 0,
  run: 1
};
const player = { width: 48, height: 30, speed: 440, cooldown: 0, invulnerable: 0 };
let enemies = [];
let shots = [];
let enemyShots = [];
let particles = [];
let stars = [];
let rafId = 0;
let audioContext;
let localBestScore = Number(localStorage.getItem("neon-barrage-best") || 0);

for (let i = 0; i < 90; i += 1) {
  stars.push({ x: Math.random() * W, y: Math.random() * H, size: Math.random() * 1.8 + .3, speed: Math.random() * 20 + 7, alpha: Math.random() * .65 + .15 });
}

const sound = {
  ensure() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  },
  tone(frequency, duration = .08, type = "sine", volume = .025) {
    if (state.muted || !audioContext || audioContext.state !== "running") return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  },
  fire() { this.tone(450, .045, "square", .018); },
  hit() { this.tone(180, .13, "sawtooth", .035); },
  enemy() { this.tone(70, .16, "triangle", .025); },
  over() { this.tone(110, .42, "sawtooth", .035); }
};

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randomBetween(min, max) { return min + Math.random() * (max - min); }
function shipRect() { return { x: state.playerX - player.width / 2, y: state.playerY - player.height / 2, width: player.width, height: player.height }; }
function updateHud() {
  scoreEl.textContent = formatScore(state.score);
  livesEl.textContent = state.lives > 0 ? `${"◆ ".repeat(state.lives).trim()}${state.lives < 3 ? "  ·" : ""}` : "— — —";
  levelEl.textContent = `LVL ${String(state.level).padStart(2, "0")}`;
  phaseEl.textContent = state.phase === "playing" ? "LIVE" : state.phase === "gameover" ? "ENDED" : "STANDBY";
  statusEl.textContent = state.phase === "playing" ? "SIGNAL LOCKED" : state.phase === "gameover" ? "RUN COMPLETE" : "READY WHEN YOU ARE";
  localBest.textContent = formatScore(localBestScore);
}
function setOverlay(visible, title = "READY TO DEPLOY?", copy = "Press start and keep your lightship moving.", kicker = "SIGNAL LOST") {
  overlay.classList.toggle("hidden", !visible);
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  overlay.querySelector(".overlay-kicker").textContent = kicker;
}
function burst(x, y, color, count = 14) {
  for (let i = 0; i < count; i += 1) particles.push({ x, y, vx: randomBetween(-150, 150), vy: randomBetween(-150, 150), life: randomBetween(.25, .65), max: .65, size: randomBetween(1, 4), color });
}
function currentDifficulty() {
  const model = workerDifficulty({ elapsed: state.elapsed });
  return { level: model.level, spawnInterval: model.spawnInterval, enemySpeed: 72 * model.enemySpeedMultiplier };
}
function startGame() {
  sound.ensure();
  state.phase = "playing"; state.score = 0; state.lives = 3; state.level = 1; state.elapsed = 0; state.spawnTimer = .2; state.playerX = W / 2; state.playerY = H - 86; state.run += 1;
  enemies = []; shots = []; enemyShots = []; particles = []; player.cooldown = 0; player.invulnerable = 0;
  document.querySelector("#run-id").textContent = `09—${String(state.run).padStart(4, "0")}`;
  formMessage.textContent = ""; formMessage.className = "form-message"; submitButton.disabled = true; nameInput.value = "";
  setOverlay(false); telemetry.textContent = "SYNC / NOMINAL"; updateHud();
  cancelAnimationFrame(rafId); state.lastTime = performance.now(); rafId = requestAnimationFrame(loop);
}
function endGame(scoreOverride = null) {
  if (Number.isInteger(scoreOverride) && scoreOverride >= 0) state.score = scoreOverride;
  state.phase = "gameover"; state.lives = 0; enemies = []; shots = []; enemyShots = [];
  if (state.score > localBestScore) { localBestScore = state.score; localStorage.setItem("neon-barrage-best", String(localBestScore)); }
  sound.over(); updateHud();
  setOverlay(true, "SIGNAL RECOVERED", `Final score ${formatScore(state.score)} · leave your mark below.`, "RUN COMPLETE");
  submitButton.disabled = false; nameInput.focus(); telemetry.textContent = "ARCHIVE / AWAITING PILOT";
  draw(performance.now() / 1000);
}
function fire() {
  if (state.phase !== "playing" || player.cooldown > 0) return;
  shots.push({ x: state.playerX - 13, y: state.playerY - 24, width: 4, height: 18, speed: 720 });
  shots.push({ x: state.playerX + 9, y: state.playerY - 24, width: 4, height: 18, speed: 720 });
  player.cooldown = .16; sound.fire();
}
function spawnEnemy() {
  const difficulty = currentDifficulty();
  const elite = state.level >= 3 && Math.random() < Math.min(.4, state.level * .045);
  enemies.push({ x: randomBetween(42, W - 42), y: -35, width: elite ? 50 : 38, height: elite ? 35 : 28, speed: difficulty.enemySpeed * randomBetween(.78, 1.17), drift: randomBetween(-54, 54), phase: Math.random() * Math.PI * 2, hp: elite ? 2 : 1, elite, fireTimer: randomBetween(1.2, 3.4) });
  sound.enemy();
}
function damagePlayer() {
  if (player.invulnerable > 0 || state.phase !== "playing") return;
  state.lives -= 1; player.invulnerable = 1.25; burst(state.playerX, state.playerY, "#ff4f9a", 20); sound.hit();
  telemetry.textContent = state.lives ? "WARNING / HULL IMPACT" : "CRITICAL / SIGNAL LOST";
  if (state.lives <= 0) endGame(); else updateHud();
}
function update(dt) {
  state.elapsed += dt;
  const difficulty = currentDifficulty();
  state.level = difficulty.level;
  const left = input.keys.has("ArrowLeft") || input.keys.has("a") || input.keys.has("A") || input.touch.has("left");
  const right = input.keys.has("ArrowRight") || input.keys.has("d") || input.keys.has("D") || input.touch.has("right");
  const up = input.keys.has("ArrowUp") || input.keys.has("w") || input.keys.has("W") || input.touch.has("up");
  const down = input.keys.has("ArrowDown") || input.keys.has("s") || input.keys.has("S") || input.touch.has("down");
  if (left) state.playerX -= player.speed * dt; if (right) state.playerX += player.speed * dt; if (up) state.playerY -= player.speed * dt; if (down) state.playerY += player.speed * dt;
  state.playerX = clamp(state.playerX, 32, W - 32); state.playerY = clamp(state.playerY, H * .48, H - 30);
  player.cooldown = Math.max(0, player.cooldown - dt); player.invulnerable = Math.max(0, player.invulnerable - dt);
  if (input.keys.has(" ") || input.touch.has("fire")) fire();
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) { spawnEnemy(); state.spawnTimer = difficulty.spawnInterval * randomBetween(.72, 1.12); }
  for (const shot of shots) shot.y -= shot.speed * dt;
  shots = shots.filter((shot) => shot.y + shot.height > -10);
  for (const shot of enemyShots) shot.y += shot.speed * dt;
  enemyShots = enemyShots.filter((shot) => shot.y < H + 20);
  const ship = shipRect();
  for (const enemy of enemies) {
    enemy.y += enemy.speed * dt; enemy.x += Math.sin(state.elapsed * 1.8 + enemy.phase) * enemy.drift * dt; enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && enemy.y > 40) { enemyShots.push({ x: enemy.x - 3, y: enemy.y + enemy.height / 2, width: 6, height: 16, speed: 220 + state.level * 12 }); enemy.fireTimer = randomBetween(1.7, 3.7); }
    if (rectanglesOverlap(ship, { x: enemy.x - enemy.width / 2, y: enemy.y - enemy.height / 2, width: enemy.width, height: enemy.height })) { enemy.dead = true; damagePlayer(); }
    if (enemy.y > H + 40) { enemy.dead = true; damagePlayer(); }
  }
  for (const shot of shots) {
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (rectanglesOverlap({ x: shot.x - shot.width / 2, y: shot.y, width: shot.width, height: shot.height }, { x: enemy.x - enemy.width / 2, y: enemy.y - enemy.height / 2, width: enemy.width, height: enemy.height })) {
        shot.dead = true; enemy.hp -= 1; burst(enemy.x, enemy.y, enemy.elite ? "#b7f86c" : "#ff4f9a", enemy.hp ? 5 : 16);
        if (enemy.hp <= 0) { enemy.dead = true; state.score += enemy.elite ? 250 : 100; sound.tone(enemy.elite ? 760 : 620, .1, "triangle", .026); }
        break;
      }
    }
  }
  for (const shot of enemyShots) if (rectanglesOverlap({ x: shot.x - shot.width / 2, y: shot.y, width: shot.width, height: shot.height }, ship)) { shot.dead = true; damagePlayer(); }
  enemies = enemies.filter((enemy) => !enemy.dead); shots = shots.filter((shot) => !shot.dead); enemyShots = enemyShots.filter((shot) => !shot.dead);
  for (const particle of particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 70 * dt; particle.life -= dt; }
  particles = particles.filter((particle) => particle.life > 0);
  state.enemyCount = enemies.length; state.projectileCount = shots.length + enemyShots.length; updateHud();
}
function drawBackground(time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, H); gradient.addColorStop(0, "#080b22"); gradient.addColorStop(1, "#030511"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
  ctx.save();
  for (const star of stars) { const y = (star.y + time * star.speed) % H; ctx.globalAlpha = star.alpha; ctx.fillStyle = star.size > 1.4 ? "#8cecff" : "#8790ad"; ctx.fillRect(star.x, y, star.size, star.size); }
  ctx.globalAlpha = .13; ctx.strokeStyle = "#5ce6ff"; ctx.lineWidth = 1; for (let y = 0; y < H; y += 48) { const offset = (time * 10) % 48; ctx.beginPath(); ctx.moveTo(0, y + offset); ctx.lineTo(W, y + offset); ctx.stroke(); } for (let x = 0; x < W; x += 72) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.globalAlpha = .14; ctx.strokeStyle = "#a778ff"; ctx.beginPath(); ctx.arc(W * .75, H * .25, 160 + Math.sin(time) * 8, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(W * .75, H * .25, 187 + Math.sin(time * .7) * 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
function glowPath(color, blur, drawPath) { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.fillStyle = color; drawPath(); ctx.restore(); }
function drawPlayer(time) {
  if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
  const x = state.playerX; const y = state.playerY;
  glowPath("#5ce6ff", 22, () => { ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x + 27, y + 18); ctx.lineTo(x + 7, y + 13); ctx.lineTo(x, y + 24); ctx.lineTo(x - 7, y + 13); ctx.lineTo(x - 27, y + 18); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = "#102a4a"; ctx.beginPath(); ctx.moveTo(x, y - 19); ctx.lineTo(x + 20, y + 14); ctx.lineTo(x, y + 8); ctx.lineTo(x - 20, y + 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f4f6ff"; ctx.beginPath(); ctx.moveTo(x, y - 13); ctx.lineTo(x + 7, y + 5); ctx.lineTo(x, y + 10); ctx.lineTo(x - 7, y + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ff4f9a"; ctx.fillRect(x - 2, y + 15, 4, 9 + Math.sin(time * 18) * 4);
}
function drawEnemy(enemy, time) {
  const x = enemy.x; const y = enemy.y; const color = enemy.elite ? "#b7f86c" : "#ff4f9a";
  glowPath(color, enemy.elite ? 17 : 12, () => { ctx.beginPath(); ctx.moveTo(x, y + enemy.height / 2); ctx.lineTo(x + enemy.width / 2, y - enemy.height / 3); ctx.lineTo(x + enemy.width / 3, y - enemy.height / 2); ctx.lineTo(x, y - enemy.height / 4); ctx.lineTo(x - enemy.width / 3, y - enemy.height / 2); ctx.lineTo(x - enemy.width / 2, y - enemy.height / 3); ctx.closePath(); ctx.fill(); });
  ctx.fillStyle = "#15172d"; ctx.beginPath(); ctx.arc(x, y - 3, enemy.elite ? 8 : 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = color; ctx.globalAlpha = .9; ctx.fillRect(x - 3, y - 5, 6, 3); ctx.globalAlpha = 1;
  if (enemy.elite && enemy.hp > 1) { ctx.strokeStyle = color; ctx.globalAlpha = .75; ctx.strokeRect(x - 25, y - 27, 50, 3); ctx.fillStyle = color; ctx.fillRect(x - 25, y - 27, 25, 3); ctx.globalAlpha = 1; }
  if (time % 1 < .02) burst(x, y + enemy.height / 2, color, 1);
}
function draw(time = 0) {
  drawBackground(time); for (const particle of particles) { ctx.globalAlpha = Math.max(0, particle.life / particle.max); ctx.fillStyle = particle.color; ctx.shadowColor = particle.color; ctx.shadowBlur = 12; ctx.fillRect(particle.x, particle.y, particle.size, particle.size); } ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  for (const shot of shots) { ctx.fillStyle = "#5ce6ff"; ctx.shadowColor = "#5ce6ff"; ctx.shadowBlur = 13; ctx.fillRect(shot.x - 2, shot.y, 4, shot.height); }
  for (const shot of enemyShots) { ctx.fillStyle = "#ff4f9a"; ctx.shadowColor = "#ff4f9a"; ctx.shadowBlur = 12; ctx.fillRect(shot.x - 3, shot.y, 6, shot.height); } ctx.shadowBlur = 0;
  for (const enemy of enemies) drawEnemy(enemy, time); if (state.phase !== "gameover") drawPlayer(time);
  ctx.fillStyle = "rgba(92,230,255,.25)"; ctx.fillRect(0, H - 2, W * ((state.score % 1000) / 1000), 2);
}
function loop(now) { if (state.phase !== "playing") return; const dt = Math.min(.034, Math.max(.001, (now - state.lastTime) / 1000)); state.lastTime = now; update(dt); draw(now / 1000); rafId = requestAnimationFrame(loop); }

function renderLeaderboard(rows) {
  leaderboardList.replaceChildren();
  if (!rows.length) { const empty = document.createElement("li"); empty.className = "leaderboard-empty"; empty.textContent = "No signals yet — be the first pilot."; leaderboardList.append(empty); return; }
  rows.slice(0, 10).forEach((row, index) => { const item = document.createElement("li"); const rank = document.createElement("span"); rank.className = "rank"; rank.textContent = String(index + 1).padStart(2, "0"); const pilot = document.createElement("span"); pilot.className = "pilot"; pilot.textContent = row.name; const points = document.createElement("strong"); points.className = "leader-score"; points.textContent = formatScore(row.score); item.append(rank, pilot, points); leaderboardList.append(item); });
}
async function loadLeaderboard() {
  leaderboardState.className = "leaderboard-state"; leaderboardState.textContent = "CONNECTING TO ARCHIVE…";
  try { const rows = await fetchLeaderboard(); renderLeaderboard(rows); leaderboardState.textContent = rows.length ? "ARCHIVE ONLINE / RANKED BY SCORE" : "ARCHIVE ONLINE / NO SIGNALS YET"; } catch (error) { leaderboardState.className = "leaderboard-state error"; leaderboardState.textContent = "ARCHIVE OFFLINE / GAMEPLAY UNAFFECTED"; leaderboardList.replaceChildren(); const item = document.createElement("li"); item.className = "leaderboard-empty"; item.textContent = error.message || "Could not reach the archive."; leaderboardList.append(item); }
}
async function submitScore(event) {
  event.preventDefault();
  const validation = validateSubmission(nameInput.value, state.score);
  if (!validation.valid) { formMessage.className = "form-message error"; formMessage.textContent = validation.nameError || validation.scoreError; return; }
  submitButton.disabled = true; formMessage.className = "form-message"; formMessage.textContent = "TRANSMITTING SCORE…";
  try { await submitLeaderboardScore(validation.name, validation.score); formMessage.className = "form-message success"; formMessage.textContent = "SIGNAL ARCHIVED. WELCOME TO THE TOP TEN."; await loadLeaderboard(); } catch (error) { submitButton.disabled = false; formMessage.className = "form-message error"; formMessage.textContent = error.message || "Could not archive your score. Try again."; }
}

startButton.addEventListener("click", startGame); restartButton.addEventListener("click", startGame); scoreForm.addEventListener("submit", submitScore); document.querySelector('[data-action="retry-leaderboard"]').addEventListener("click", loadLeaderboard);
muteButton.addEventListener("click", () => { sound.ensure(); state.muted = !state.muted; muteButton.setAttribute("aria-pressed", String(state.muted)); muteButton.setAttribute("aria-label", state.muted ? "Unmute sound" : "Mute sound"); muteButton.querySelector(".mute-label").textContent = state.muted ? "SOUND OFF" : "SOUND ON"; muteButton.querySelector(".mute-icon").textContent = state.muted ? "◑" : "◒"; });
window.addEventListener("keydown", (event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault(); input.keys.add(event.key); if (event.key === " ") { sound.ensure(); fire(); } });
window.addEventListener("keyup", (event) => input.keys.delete(event.key));
for (const button of document.querySelectorAll("[data-action]")) { const action = button.dataset.action; if (!["left", "right", "up", "down", "fire"].includes(action)) continue; const release = () => { input.touch.delete(action); button.classList.remove("active"); }; button.addEventListener("pointerdown", (event) => { event.preventDefault(); sound.ensure(); input.touch.add(action); button.classList.add("active"); }); button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release); button.addEventListener("pointerleave", release); }
window.addEventListener("blur", () => { input.keys.clear(); input.touch.clear(); document.querySelectorAll(".touch-controls button").forEach((button) => button.classList.remove("active")); });

window.__NEON_BARRAGE__ = { getState: () => ({ phase: state.phase, score: state.score, lives: state.lives, playerX: state.playerX, playerY: state.playerY, enemyCount: enemies.length, projectileCount: shots.length + enemyShots.length }), endGameForTest: (score) => { const safeScore = Number.isInteger(score) && score >= 0 ? score : 0; endGame(safeScore); } };
updateHud(); setOverlay(true); draw(0); loadLeaderboard();
