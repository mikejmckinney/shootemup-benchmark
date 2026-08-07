import { clamp, isPlausibleScore, isValidPlayerName, sanitizeName, waveForScore } from "./game-logic.js";

const canvas = document.querySelector("[data-testid=game-canvas]");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("[data-testid=score]");
const livesEl = document.querySelector("[data-testid=lives]");
const phaseLabel = document.querySelector("#phase-label");
const waveLabel = document.querySelector("#wave-label");
const missionStatus = document.querySelector("#mission-status");
const startOverlay = document.querySelector("#start-overlay");
const gameOverOverlay = document.querySelector("#game-over-overlay");
const submitPanel = document.querySelector("#score-submit-panel");
const finalScoreEl = document.querySelector("#final-score");
const leaderboardEl = document.querySelector("[data-testid=leaderboard]");
const leaderboardState = document.querySelector("#leaderboard-state");
const form = document.querySelector("#score-form");
const nameInput = document.querySelector("[data-testid=player-name]");
const formMessage = document.querySelector("#form-message");
const config = window.__SUPABASE_CONFIG__ || {};
const API_URL = String(config.url || "").replace(/\/$/, "");
const ANON_KEY = String(config.anonKey || "");

const state = {
  phase: "idle", score: 0, lives: 3, playerX: 480, playerY: 450, enemyCount: 0, projectileCount: 0,
  wave: 1, lastFrame: 0, spawnTimer: 0, fireTimer: 0, shake: 0, runId: 0,
};
const keys = new Set();
const projectiles = [];
const enemies = [];
const particles = [];
const stars = Array.from({ length: 90 }, (_, index) => ({ x: (index * 83) % 960, y: (index * 137) % 540, size: index % 7 === 0 ? 2 : 1, speed: .2 + (index % 5) * .1, alpha: .2 + (index % 6) * .1 }));

let audioContext;
let muted = false;

function formatScore(value) { return String(Math.max(0, value)).padStart(6, "0"); }
function setHud() {
  scoreEl.textContent = formatScore(state.score);
  livesEl.textContent = `${"♥ ".repeat(Math.max(0, state.lives)).trim()}${state.lives === 0 ? "—" : ""}`;
  waveLabel.textContent = `WAVE ${String(state.wave).padStart(2, "0")}`;
}
function setPhase(phase, message) { state.phase = phase; phaseLabel.textContent = message; }
function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const box = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(box.width * ratio));
  canvas.height = Math.max(1, Math.floor(box.height * ratio));
  ctx.setTransform(ratio * box.width / 960, 0, 0, ratio * box.width / 960, 0, 0);
}
function ensureAudio() {
  if (muted || audioContext) return;
  const AudioConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioConstructor) return;
  try {
    audioContext = new AudioConstructor();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch {
    audioContext = undefined;
  }
}
function beep(frequency, duration, type = "sine", volume = .035) {
  if (muted || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type; oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
}
function burst(x, y, color, amount = 8) {
  for (let i = 0; i < amount; i += 1) particles.push({ x, y, vx: (Math.random() - .5) * 150, vy: (Math.random() - .5) * 150, life: .35 + Math.random() * .4, max: .7, size: 1 + Math.random() * 2, color });
}
function resetRun() {
  projectiles.length = 0; enemies.length = 0; particles.length = 0;
  state.score = 0; state.lives = 3; state.playerX = 480; state.playerY = 450; state.wave = 1; state.spawnTimer = .2; state.fireTimer = 0; state.shake = 0; state.runId += 1;
  setHud();
}
function startGame() {
  ensureAudio(); resetRun(); setPhase("running", "SYSTEMS ONLINE"); missionStatus.textContent = "Pilot link active";
  startOverlay.classList.add("hidden"); gameOverOverlay.classList.add("hidden"); submitPanel.classList.add("hidden"); nameInput.value = ""; formMessage.textContent = "";
  beep(440, .1, "square", .025); beep(660, .16, "sine", .02);
}
function endGame(score = state.score) {
  const final = Math.max(0, Math.floor(Number(score) || 0));
  state.score = final; state.lives = 0; state.enemyCount = enemies.length; state.projectileCount = projectiles.length;
  setHud(); setPhase("gameover", "SIGNAL LOST"); missionStatus.textContent = "Mission complete / score ready"; finalScoreEl.textContent = formatScore(final);
  gameOverOverlay.classList.remove("hidden"); submitPanel.classList.remove("hidden");
  burst(state.playerX, state.playerY, "#ff5aa8", 20); beep(140, .35, "sawtooth", .035);
  submitPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function spawnEnemy() {
  const size = 13 + Math.random() * 9;
  enemies.push({ x: 35 + Math.random() * 890, y: -30, size, speed: 52 + state.wave * 7 + Math.random() * 35, phase: Math.random() * 6, hp: state.wave > 4 && Math.random() > .75 ? 2 : 1, hue: Math.random() > .45 ? "#ff5aa8" : "#9a82ff" });
}
function fire() {
  if (state.phase !== "running" || state.fireTimer > 0) return;
  projectiles.push({ x: state.playerX, y: state.playerY - 22, speed: 510 }); state.fireTimer = .14; beep(570, .06, "square", .016);
}
function damagePlayer() {
  state.lives -= 1; state.shake = .3; burst(state.playerX, state.playerY, "#ffd166", 13); beep(110, .18, "sawtooth", .04);
  if (state.lives <= 0) endGame(); else setHud();
}
function update(delta) {
  if (state.phase !== "running") return;
  const focus = keys.has("shift");
  const speed = focus ? 205 : 315;
  let dx = 0; let dy = 0;
  if (keys.has("arrowleft") || keys.has("a") || touch.left) dx -= 1;
  if (keys.has("arrowright") || keys.has("d") || touch.right) dx += 1;
  if (keys.has("arrowup") || keys.has("w") || touch.up) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s") || touch.down) dy += 1;
  state.playerX = clamp(state.playerX + dx * speed * delta, 25, 935); state.playerY = clamp(state.playerY + dy * speed * delta, 40, 505);
  state.fireTimer = Math.max(0, state.fireTimer - delta); if (keys.has(" ") || touch.fire) fire();
  state.spawnTimer -= delta; if (state.spawnTimer <= 0) { spawnEnemy(); state.spawnTimer = Math.max(.23, .78 - state.wave * .035); }
  state.wave = waveForScore(state.score);
  for (let i = projectiles.length - 1; i >= 0; i -= 1) { const shot = projectiles[i]; shot.y -= shot.speed * delta; if (shot.y < -15) projectiles.splice(i, 1); }
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i]; enemy.y += enemy.speed * delta; enemy.x += Math.sin(performance.now() / 600 + enemy.phase) * 24 * delta;
    if (Math.hypot(enemy.x - state.playerX, enemy.y - state.playerY) < enemy.size + 17) { enemies.splice(i, 1); damagePlayer(); continue; }
    if (enemy.y > 565) { enemies.splice(i, 1); damagePlayer(); continue; }
    for (let j = projectiles.length - 1; j >= 0; j -= 1) {
      const shot = projectiles[j]; if (Math.hypot(enemy.x - shot.x, enemy.y - shot.y) < enemy.size + 7) { projectiles.splice(j, 1); enemy.hp -= 1; burst(enemy.x, enemy.y, enemy.hue, 5); if (enemy.hp <= 0) { enemies.splice(i, 1); state.score += 100 + state.wave * 10; beep(210 + state.wave * 20, .08, "triangle", .026); } break; }
    }
  }
  for (let i = particles.length - 1; i >= 0; i -= 1) { const p = particles[i]; p.life -= delta; p.x += p.vx * delta; p.y += p.vy * delta; p.vx *= .98; p.vy *= .98; if (p.life <= 0) particles.splice(i, 1); }
  state.enemyCount = enemies.length; state.projectileCount = projectiles.length; state.shake = Math.max(0, state.shake - delta); setHud();
}
function drawBackground(time) {
  ctx.fillStyle = "#060817"; ctx.fillRect(0, 0, 960, 540);
  const gradient = ctx.createRadialGradient(state.playerX, 430, 10, state.playerX, 430, 420); gradient.addColorStop(0, "rgba(64,50,141,.24)"); gradient.addColorStop(1, "rgba(6,8,23,0)"); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, 540);
  ctx.strokeStyle = "rgba(97,246,224,.05)"; ctx.lineWidth = 1; for (let x = 0; x <= 960; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 540); ctx.stroke(); } for (let y = 0; y <= 540; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
  for (const star of stars) { const y = (star.y + time * star.speed * .018) % 540; ctx.fillStyle = `rgba(177, 206, 255, ${star.alpha})`; ctx.fillRect(star.x, y, star.size, star.size); }
}
function drawShip() {
  ctx.save(); ctx.translate(state.playerX, state.playerY); ctx.shadowBlur = 18; ctx.shadowColor = "#61f6e0"; ctx.fillStyle = "#61f6e0"; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(17, 17); ctx.lineTo(7, 14); ctx.lineTo(0, 21); ctx.lineTo(-7, 14); ctx.lineTo(-17, 17); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = "#111a3c"; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 6); ctx.lineTo(0, 10); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#ff5aa8"; ctx.shadowBlur = 12; ctx.shadowColor = "#ff5aa8"; ctx.fillRect(-3, 17, 6, 9 + Math.random() * 6); ctx.restore();
}
function draw() {
  const time = performance.now(); ctx.save(); if (state.shake) ctx.translate((Math.random() - .5) * 6, (Math.random() - .5) * 6); drawBackground(time);
  for (const shot of projectiles) { ctx.fillStyle = "#61f6e0"; ctx.shadowBlur = 12; ctx.shadowColor = "#61f6e0"; ctx.fillRect(shot.x - 2, shot.y - 9, 4, 16); }
  ctx.shadowBlur = 0; for (const enemy of enemies) { ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.rotate(Math.sin(time / 450 + enemy.phase) * .3); ctx.shadowBlur = 15; ctx.shadowColor = enemy.hue; ctx.strokeStyle = enemy.hue; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -enemy.size); ctx.lineTo(enemy.size, 0); ctx.lineTo(0, enemy.size); ctx.lineTo(-enemy.size, 0); ctx.closePath(); ctx.stroke(); ctx.fillStyle = enemy.hue; ctx.globalAlpha = .8; ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
  ctx.shadowBlur = 0; for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); } ctx.globalAlpha = 1; if (state.phase !== "gameover") drawShip(); ctx.restore();
}
function frame(time) { const delta = Math.min(.04, state.lastFrame ? (time - state.lastFrame) / 1000 : .016); state.lastFrame = time; update(delta); draw(); requestAnimationFrame(frame); }

const touch = { left: false, right: false, up: false, down: false, fire: false };
function setTouch(control, value) { if (control in touch) touch[control] = value; if (value) ensureAudio(); }

async function loadLeaderboard() {
  if (!API_URL || !ANON_KEY) { leaderboardState.dataset.state = "empty"; leaderboardState.textContent = "Flight log is offline. First score starts the archive."; return; }
  try {
    const response = await fetch(`${API_URL}/rest/v1/leaderboard?select=id,name,score,created_at&order=score.desc,created_at.asc&limit=10`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
    if (!response.ok) throw new Error("leaderboard unavailable");
    const rows = await response.json(); renderLeaderboard(rows);
  } catch { leaderboardState.dataset.state = "error"; leaderboardState.textContent = "Flight log unavailable. Your run is still playable."; }
}
function renderLeaderboard(rows) {
  leaderboardState.dataset.state = rows.length ? "ready" : "empty"; leaderboardState.textContent = rows.length ? "" : "No pilots logged yet. Be the first."; leaderboardEl.replaceChildren();
  for (const [index, row] of rows.entries()) { const item = document.createElement("li"); const rank = document.createElement("span"); rank.className = "rank"; rank.textContent = String(index + 1).padStart(2, "0"); const name = document.createElement("span"); name.className = "pilot-name"; name.textContent = row.name; const score = document.createElement("span"); score.className = "pilot-score"; score.textContent = formatScore(row.score); item.append(rank, name, score); leaderboardEl.append(item); }
}
async function submitScore(event) {
  event.preventDefault(); ensureAudio(); const name = sanitizeName(nameInput.value); const score = state.score;
  if (!isValidPlayerName(name)) { formMessage.className = "form-message"; formMessage.textContent = "Use 1–16 letters, numbers, spaces, _ or -."; nameInput.focus(); return; }
  if (!isPlausibleScore(score)) { formMessage.className = "form-message"; formMessage.textContent = "That score could not be verified."; return; }
  if (!API_URL || !ANON_KEY) { formMessage.className = "form-message"; formMessage.textContent = "Flight log is offline. Score held locally for this run."; return; }
  const button = document.querySelector("[data-testid=submit-score]"); button.disabled = true; formMessage.className = "form-message"; formMessage.textContent = "Transmitting...";
  try {
    const response = await fetch(`${API_URL}/rest/v1/leaderboard`, { method: "POST", headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ name, score }) });
    if (!response.ok) throw new Error("insert rejected");
    formMessage.className = "form-message success"; formMessage.textContent = "Score locked in. See you at the top."; button.disabled = true; await loadLeaderboard();
  } catch { formMessage.className = "form-message"; formMessage.textContent = "Could not reach the flight log. Try again."; button.disabled = false; }
}

document.addEventListener("keydown", (event) => { const key = event.key.toLowerCase(); if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key)) event.preventDefault(); keys.add(key); if (key === "enter" && state.phase !== "running") startGame(); });
document.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
document.querySelector("[data-testid=start-button]").addEventListener("click", startGame);
document.querySelector("#restart-button").addEventListener("click", startGame);
document.querySelector("[data-testid=mute-button]").addEventListener("click", () => { muted = !muted; const button = document.querySelector("[data-testid=mute-button]"); button.classList.toggle("is-muted", muted); button.setAttribute("aria-pressed", String(muted)); button.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off"); if (!muted) ensureAudio(); });
form.addEventListener("submit", submitScore);
document.querySelectorAll("[data-control]").forEach((button) => { const control = button.dataset.control; button.addEventListener("pointerdown", (event) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); setTouch(control, true); }); button.addEventListener("pointerup", () => setTouch(control, false)); button.addEventListener("pointercancel", () => setTouch(control, false)); button.addEventListener("pointerleave", () => setTouch(control, false)); });
window.addEventListener("resize", resizeCanvas); resizeCanvas(); setHud(); loadLeaderboard(); requestAnimationFrame(frame);

window.__NEON_BARRAGE__ = { getState: () => ({ phase: state.phase, score: state.score, lives: state.lives, playerX: state.playerX, playerY: state.playerY, enemyCount: state.enemyCount, projectileCount: state.projectileCount }), endGameForTest: (score) => endGame(score) };
