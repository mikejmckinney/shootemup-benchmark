import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import { clampName, createGameState, difficultyForScore, hitTest, isPlausibleScore, isValidName, movePlayer } from "./game-state.js";

const canvas = document.querySelector('[data-testid="game-canvas"]');
const ctx = canvas.getContext("2d");
const frame = canvas.parentElement;
const overlay = document.querySelector("#game-overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const startButton = document.querySelector('[data-testid="start-button"]');
const scoreOutput = document.querySelector('[data-testid="score"]');
const livesOutput = document.querySelector('[data-testid="lives"]');
const threatOutput = document.querySelector("#threat-level");
const muteButton = document.querySelector('[data-testid="mute-button"]');
const touchControls = document.querySelector('[data-testid="touch-controls"]');
const fireButton = document.querySelector("#fire-button");
const scoreForm = document.querySelector("#score-form");
const nameInput = document.querySelector('[data-testid="player-name"]');
const nameError = document.querySelector("#name-error");
const leaderboard = document.querySelector('[data-testid="leaderboard"]');
const leaderboardStatus = document.querySelector("#leaderboard-status");

const game = {
  ...createGameState(),
  width: 720,
  height: 520,
  dpr: 1,
  lastTime: 0,
  spawnClock: 0,
  fireClock: 0,
  shake: 0,
  flash: 0,
  keys: new Set(),
  enemies: [],
  projectiles: [],
  particles: [],
  stars: [],
  trails: [],
  pointer: { active: false, x: 0, y: 0 },
  audio: null,
  muted: false,
};

function random(min, max) { return min + Math.random() * (max - min); }
function scoreText(value) { return String(Math.max(0, value)).padStart(6, "0"); }
function setStatus(message, kind = "") {
  leaderboardStatus.textContent = message;
  leaderboardStatus.className = `leaderboard-status ${kind}`;
}

function resizeCanvas() {
  const rect = frame.getBoundingClientRect();
  game.dpr = Math.min(window.devicePixelRatio || 1, 2);
  game.width = Math.max(280, rect.width);
  game.height = Math.max(360, rect.width * 0.69);
  canvas.width = Math.round(game.width * game.dpr);
  canvas.height = Math.round(game.height * game.dpr);
  canvas.style.height = `${game.height}px`;
  ctx.setTransform(game.dpr, 0, 0, game.dpr, 0, 0);
  if (game.phase !== "playing") {
    game.playerX = game.width / 2;
    game.playerY = game.height - 74;
  }
  if (!game.stars.length) {
    game.stars = Array.from({ length: Math.floor(game.width / 3) }, () => ({
      x: random(0, game.width), y: random(0, game.height), size: random(0.4, 1.8), speed: random(12, 50), alpha: random(0.22, 0.8),
    }));
  }
}

function resetGame() {
  const initial = createGameState(game.width, game.height);
  Object.assign(game, initial, { enemies: [], projectiles: [], particles: [], trails: [], spawnClock: 0, fireClock: 0, shake: 0, flash: 0 });
  scoreOutput.textContent = scoreText(0);
  livesOutput.textContent = "● ● ●";
  threatOutput.textContent = "01";
  scoreForm.classList.add("hidden");
  nameError.textContent = "";
}

function beginAudio() {
  if (!game.audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) game.audio = new AudioContext();
  }
  if (game.audio?.state === "suspended") game.audio.resume();
}

function tone(frequency, duration, type = "sine", volume = 0.035) {
  if (game.muted || !game.audio) return;
  const oscillator = game.audio.createOscillator();
  const gain = game.audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, game.audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(50, frequency * 0.55), game.audio.currentTime + duration);
  gain.gain.setValueAtTime(volume, game.audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, game.audio.currentTime + duration);
  oscillator.connect(gain).connect(game.audio.destination);
  oscillator.start();
  oscillator.stop(game.audio.currentTime + duration);
}

function startGame() {
  beginAudio();
  resetGame();
  game.phase = "playing";
  overlay.classList.add("is-hidden");
  tone(240, 0.13, "square", 0.04);
  setTimeout(() => tone(480, 0.18, "square", 0.035), 65);
}

function endGame(finalScore = game.score) {
  const safeScore = isPlausibleScore(finalScore) ? finalScore : 0;
  game.score = safeScore;
  game.phase = "gameover";
  overlay.classList.remove("is-hidden");
  overlayKicker.textContent = "MISSION SIGNAL LOST";
  overlayTitle.innerHTML = "RUN<br /><em>COMPLETE</em>";
  overlayCopy.innerHTML = `FINAL SCORE <strong class="final-score">${scoreText(safeScore)}</strong><br />The grid remembers the brightest pilots.`;
  startButton.innerHTML = "REPLAY MISSION <b>↻</b>";
  scoreForm.classList.remove("hidden");
  nameInput.value = "";
  nameInput.focus({ preventScroll: true });
  scoreOutput.textContent = scoreText(safeScore);
  tone(150, 0.45, "sawtooth", 0.045);
}

function updateHud() {
  scoreOutput.textContent = scoreText(game.score);
  livesOutput.textContent = `${"● ".repeat(Math.max(0, game.lives))}${"○ ".repeat(Math.max(0, 3 - game.lives))}`.trim();
  threatOutput.textContent = String(difficultyForScore(game.score)).padStart(2, "0");
}

function spawnEnemy() {
  const level = difficultyForScore(game.score);
  const roll = Math.random();
  const kind = roll < Math.min(0.16, level * 0.018) ? "hunter" : roll < 0.34 ? "orb" : "drone";
  const radius = kind === "hunter" ? 16 : kind === "orb" ? 12 : 13;
  game.enemies.push({ x: random(radius + 6, game.width - radius - 6), y: -radius - 12, radius, kind, speed: random(52, 88) + level * 4, drift: random(-1, 1), phase: random(0, Math.PI * 2), hp: kind === "hunter" ? 2 : 1, age: 0 });
}

function fire() {
  if (game.phase !== "playing" || game.fireClock > 0) return;
  beginAudio();
  game.fireClock = 0.16;
  game.projectiles.push({ x: game.playerX, y: game.playerY - 22, speed: 620, radius: 3 });
  tone(720, 0.07, "square", 0.025);
}

function burst(x, y, color, count = 12) {
  for (let i = 0; i < count; i += 1) {
    const angle = random(0, Math.PI * 2);
    const speed = random(40, 180);
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: random(0.28, 0.7), maxLife: 0.7, size: random(1, 3.6), color });
  }
}

function loseLife() {
  game.lives -= 1;
  game.shake = 0.32;
  game.flash = 0.16;
  burst(game.playerX, game.playerY, "#ff5b91", 22);
  tone(100, 0.2, "sawtooth", 0.04);
  if (game.lives <= 0) endGame(game.score);
}

function update(dt) {
  for (const star of game.stars) {
    star.y += star.speed * dt * (game.phase === "playing" ? 1.5 : 0.45);
    if (star.y > game.height + 3) { star.y = -3; star.x = random(0, game.width); }
  }
  for (const particle of game.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 90 * dt; particle.life -= dt; }
  game.particles = game.particles.filter((particle) => particle.life > 0);
  game.shake = Math.max(0, game.shake - dt);
  game.flash = Math.max(0, game.flash - dt);
  if (game.phase !== "playing") return;

  const direction = { x: 0, y: 0 };
  if (game.keys.has("ArrowLeft") || game.keys.has("a")) direction.x -= 1;
  if (game.keys.has("ArrowRight") || game.keys.has("d")) direction.x += 1;
  if (game.keys.has("ArrowUp") || game.keys.has("w")) direction.y -= 1;
  if (game.keys.has("ArrowDown") || game.keys.has("s")) direction.y += 1;
  if (game.pointer.active) {
    const dx = game.pointer.x - game.playerX;
    const dy = game.pointer.y - game.playerY;
    if (Math.abs(dx) > 6) direction.x = Math.sign(dx);
    if (Math.abs(dy) > 6) direction.y = Math.sign(dy);
  }
  const next = movePlayer({ x: game.playerX, y: game.playerY }, direction, dt, { width: game.width, height: game.height });
  game.playerX = next.x; game.playerY = next.y;
  game.fireClock -= dt;
  if (game.keys.has(" ")) fire();
  game.spawnClock -= dt;
  if (game.spawnClock <= 0) { spawnEnemy(); game.spawnClock = Math.max(0.22, 0.9 - difficultyForScore(game.score) * 0.05); }
  for (const projectile of game.projectiles) projectile.y -= projectile.speed * dt;
  game.projectiles = game.projectiles.filter((projectile) => projectile.y > -20);

  for (const enemy of game.enemies) {
    enemy.age += dt;
    enemy.y += enemy.speed * dt;
    enemy.x += Math.sin(enemy.age * 2 + enemy.phase) * enemy.drift * 44 * dt;
    if (enemy.kind === "hunter") { enemy.x += Math.sin(enemy.age * 1.5) * 18 * dt; }
  }
  for (const projectile of game.projectiles) {
    for (const enemy of game.enemies) {
      if (enemy.hp > 0 && hitTest(projectile, enemy, enemy.radius + projectile.radius)) {
        projectile.y = -100;
        enemy.hp -= 1;
        burst(enemy.x, enemy.y, enemy.kind === "hunter" ? "#ff5b91" : "#53e8ff", 5);
        if (enemy.hp <= 0) { enemy.y = game.height + 100; game.score += enemy.kind === "hunter" ? 100 : 50; burst(enemy.x, enemy.y - 100, "#b5ff5c", 16); tone(enemy.kind === "hunter" ? 300 : 460, 0.09, "triangle", 0.03); }
        break;
      }
    }
  }
  game.projectiles = game.projectiles.filter((projectile) => projectile.y > -50);
  for (const enemy of game.enemies) {
    if (enemy.hp > 0 && (enemy.y > game.height + 20 || hitTest(enemy, { x: game.playerX, y: game.playerY }, enemy.radius + 14))) {
      enemy.hp = 0;
      if (enemy.y < game.height + 20) loseLife();
      else { game.score = Math.max(0, game.score - 25); burst(enemy.x, game.height - 8, "#ffcf5c", 7); }
    }
  }
  game.enemies = game.enemies.filter((enemy) => enemy.hp > 0);
  updateHud();
}

function glow(color, blur = 12) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function clearGlow() { ctx.shadowBlur = 0; }

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
  gradient.addColorStop(0, "#090d27"); gradient.addColorStop(0.5, "#10113a"); gradient.addColorStop(1, "#190d30");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, game.width, game.height);
  const nebula = ctx.createRadialGradient(game.width * 0.72, game.height * 0.42, 0, game.width * 0.72, game.height * 0.42, game.width * 0.62);
  nebula.addColorStop(0, "rgba(102, 32, 180, .22)"); nebula.addColorStop(1, "rgba(15, 17, 55, 0)");
  ctx.fillStyle = nebula; ctx.fillRect(0, 0, game.width, game.height);
  for (const star of game.stars) { ctx.globalAlpha = star.alpha; ctx.fillStyle = star.size > 1.3 ? "#b7f9ff" : "#6974ae"; ctx.fillRect(star.x, star.y, star.size, star.size); }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(91, 106, 188, .12)"; ctx.lineWidth = 1;
  for (let x = 18; x < game.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, game.height); ctx.stroke(); }
  for (let y = 18; y < game.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(game.width, y); ctx.stroke(); }
}

function drawPlayer() {
  const x = game.playerX; const y = game.playerY;
  ctx.save(); ctx.translate(x, y);
  ctx.globalAlpha = game.phase === "playing" ? 1 : 0.7;
  ctx.fillStyle = "#ff4f9a"; glow("#ff4f9a", 18);
  ctx.beginPath(); ctx.moveTo(0, 27); ctx.lineTo(-7, 10); ctx.lineTo(-21, 19); ctx.lineTo(-13, -1); ctx.lineTo(-8, -18); ctx.lineTo(0, -27); ctx.lineTo(8, -18); ctx.lineTo(13, -1); ctx.lineTo(21, 19); ctx.lineTo(7, 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#b9fcff"; clearGlow(); ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(5, 2); ctx.lineTo(0, 12); ctx.lineTo(-5, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#53e8ff"; glow("#53e8ff", 12); ctx.beginPath(); ctx.moveTo(-5, 16); ctx.lineTo(0, 31 + Math.sin(performance.now() / 45) * 5); ctx.lineTo(5, 16); ctx.fill(); clearGlow();
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(enemy.age * (enemy.kind === "hunter" ? -1 : 1));
  const color = enemy.kind === "hunter" ? "#ff5b91" : enemy.kind === "orb" ? "#b5ff5c" : "#53e8ff";
  ctx.strokeStyle = color; ctx.fillStyle = enemy.kind === "orb" ? "rgba(181,255,92,.18)" : "rgba(83,232,255,.14)"; ctx.lineWidth = 2; glow(color, 16);
  ctx.beginPath();
  if (enemy.kind === "orb") ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
  else { ctx.moveTo(0, -enemy.radius); ctx.lineTo(enemy.radius, 0); ctx.lineTo(0, enemy.radius); ctx.lineTo(-enemy.radius, 0); ctx.closePath(); }
  ctx.fill(); ctx.stroke(); clearGlow();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.save();
  if (game.shake) ctx.translate(random(-game.shake * 8, game.shake * 8), random(-game.shake * 8, game.shake * 8));
  drawBackground();
  for (const projectile of game.projectiles) { ctx.fillStyle = "#e5ffff"; glow("#53e8ff", 14); ctx.fillRect(projectile.x - 2, projectile.y - 11, 4, 18); clearGlow(); }
  for (const enemy of game.enemies) drawEnemy(enemy);
  for (const particle of game.particles) { ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife); ctx.fillStyle = particle.color; glow(particle.color, 8); ctx.fillRect(particle.x, particle.y, particle.size, particle.size); clearGlow(); }
  ctx.globalAlpha = 1; drawPlayer();
  if (game.flash) { ctx.fillStyle = `rgba(255, 91, 145, ${game.flash * 2})`; ctx.fillRect(0, 0, game.width, game.height); }
  ctx.restore();
}

function loop(time) {
  const dt = Math.min(0.04, (time - game.lastTime) / 1000 || 0);
  game.lastTime = time;
  update(dt); draw(); requestAnimationFrame(loop);
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * game.width / rect.width, y: (event.clientY - rect.top) * game.height / rect.height };
}

function handlePointer(event) {
  if (event.pointerType === "mouse" && event.buttons === 0) return;
  game.pointer = { ...pointerPosition(event), active: true };
  if (event.pointerType === "touch") { beginAudio(); fire(); }
}

function renderLeaderboard(rows) {
  leaderboard.replaceChildren();
  if (!rows.length) { setStatus("NO PILOTS ON THE GRID YET", "empty"); return; }
  rows.forEach((row, index) => {
    const item = document.createElement("li"); item.className = `score-row ${index === 0 ? "top-score" : ""}`;
    item.innerHTML = `<span class="rank">${String(index + 1).padStart(2, "0")}</span><span class="pilot">${escapeHtml(row.player_name)}</span><strong>${scoreText(row.score)}</strong>`;
    leaderboard.append(item);
  });
  setStatus("LIVE // UPDATED JUST NOW", "live");
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character])); }

async function loadLeaderboard() {
  if (SUPABASE_URL.startsWith("__") || SUPABASE_ANON_KEY.startsWith("__")) { setStatus("LEADERBOARD CONFIGURATION PENDING", "error"); return; }
  setStatus("CONNECTING TO THE GRID...");
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard?select=player_name,score,created_at&order=score.desc,created_at.asc&limit=10`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status})`);
    renderLeaderboard(await response.json());
  } catch (error) { setStatus("GRID OFFLINE // TRY AGAIN LATER", "error"); leaderboard.replaceChildren(); }
}

async function submitScore(event) {
  event.preventDefault();
  const name = clampName(nameInput.value);
  nameInput.value = name;
  if (!isValidName(name)) { nameError.textContent = "Use 1–16 letters, numbers, spaces, _ or -."; nameInput.focus(); return; }
  if (!isPlausibleScore(game.score)) { nameError.textContent = "That score could not be verified."; return; }
  nameError.textContent = "TRANSMITTING...";
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ player_name: name, score: game.score }) });
    if (!response.ok) throw new Error(`Score submission failed (${response.status})`);
    nameError.textContent = "SCORE LOCKED INTO THE GRID.";
    nameError.classList.add("success");
    await loadLeaderboard();
  } catch (error) { nameError.textContent = "TRANSMISSION FAILED. CHECK YOUR SIGNAL."; }
  finally { submit.disabled = false; }
}

startButton.addEventListener("click", startGame);
scoreForm.addEventListener("submit", submitScore);
muteButton.addEventListener("click", () => { game.muted = !game.muted; muteButton.setAttribute("aria-pressed", String(game.muted)); muteButton.setAttribute("aria-label", game.muted ? "Unmute sound" : "Mute sound"); muteButton.classList.toggle("is-muted", game.muted); });
window.addEventListener("keydown", (event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault(); game.keys.add(event.key); if (event.key === "Enter" && game.phase !== "playing") startGame(); });
window.addEventListener("keyup", (event) => game.keys.delete(event.key));
canvas.addEventListener("pointerdown", (event) => { canvas.setPointerCapture?.(event.pointerId); handlePointer(event); });
canvas.addEventListener("pointermove", (event) => { if (event.buttons || event.pointerType === "touch") handlePointer(event); });
canvas.addEventListener("pointerup", () => { game.pointer.active = false; });
canvas.addEventListener("pointercancel", () => { game.pointer.active = false; });
for (const button of touchControls.querySelectorAll("[data-direction]")) {
  const directionKey = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[button.dataset.direction];
  const press = (event) => { event.preventDefault(); beginAudio(); game.keys.add(directionKey); button.classList.add("pressed"); };
  const release = (event) => { event.preventDefault(); game.keys.delete(directionKey); button.classList.remove("pressed"); };
  button.addEventListener("pointerdown", press); button.addEventListener("pointerup", release); button.addEventListener("pointercancel", release); button.addEventListener("pointerleave", release);
}
fireButton.addEventListener("pointerdown", (event) => { event.preventDefault(); beginAudio(); game.keys.add(" "); fireButton.classList.add("pressed"); });
for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) fireButton.addEventListener(eventName, () => { game.keys.delete(" "); fireButton.classList.remove("pressed"); });
window.addEventListener("resize", resizeCanvas);

window.__NEON_BARRAGE__ = {
  getState: () => ({ phase: game.phase, score: game.score, lives: game.lives, playerX: Math.round(game.playerX), playerY: Math.round(game.playerY), enemyCount: game.enemies.length, projectileCount: game.projectiles.length }),
  endGameForTest: (score) => { if (Number.isSafeInteger(score) && score >= 0) endGame(score); },
};

resizeCanvas();
loadLeaderboard();
requestAnimationFrame(loop);
