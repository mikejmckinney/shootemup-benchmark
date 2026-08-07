import {
  MAX_SCORE,
  beginGame,
  createGameState,
  endGame,
  stepGame,
  validatePlayerName,
  validateScore
} from "./game-core.mjs";

const $ = (selector) => document.querySelector(selector);
const canvas = $("[data-testid=game-canvas]");
const canvasWrap = $("#canvasWrap");
const ctx = canvas.getContext("2d");
const overlay = $("#gameOverlay");
const overlayKicker = $("#overlayKicker");
const overlayTitle = $("#overlayTitle");
const overlayMessage = $("#overlayMessage");
const finalScore = $("#finalScore");
const finalScoreValue = $("#finalScoreValue");
const startButton = $("[data-testid=start-button]");
const muteButton = $("[data-testid=mute-button]");
const scoreDisplay = $("[data-testid=score]");
const livesDisplay = $("[data-testid=lives]");
const levelLabel = $("#levelLabel");
const leaderboardList = $("[data-testid=leaderboard]");
const leaderboardStatus = $("#leaderboardStatus");
const nameInput = $("[data-testid=player-name]");
const submitButton = $("[data-testid=submit-score]");
const entryMessage = $("#entryMessage");
const config = window.NEON_CONFIG || {};
const supabaseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
const supabasePublicKey = String(config.supabasePublicKey || "");

const game = createGameState();
const input = { left: false, right: false, up: false, down: false, fire: false };
const numberFormat = new Intl.NumberFormat("en-US");
let viewWidth = 900;
let viewHeight = 560;
let devicePixelRatio = 1;
let stars = [];
let particles = [];
let flash = 0;
let frameTime = performance.now();
let leaderboardRequest = 0;
let audioContext = null;
let masterGain = null;
let muted = false;

function isLeaderboardConfigured() {
  return /^https:\/\//.test(supabaseUrl) && supabasePublicKey.length > 20 && !supabasePublicKey.includes("__SUPABASE");
}

function formatScore(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(6, "0");
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  viewWidth = Math.max(320, rect.width || canvasWrap.clientWidth || 900);
  viewHeight = Math.max(300, rect.height || canvasWrap.clientHeight || 560);
  devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewWidth * devicePixelRatio);
  canvas.height = Math.round(viewHeight * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  game.width = viewWidth;
  game.height = viewHeight;
  game.player.x = Math.min(viewWidth - 28, Math.max(28, game.player.x || viewWidth / 2));
  game.player.y = Math.min(viewHeight - 28, Math.max(34, game.player.y || viewHeight - 58));
  const count = Math.max(42, Math.round((viewWidth * viewHeight) / 6200));
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * viewWidth,
    y: Math.random() * viewHeight,
    size: 0.45 + Math.random() * 1.35,
    speed: 6 + Math.random() * 28,
    alpha: 0.22 + Math.random() * 0.7,
    tint: Math.random() > 0.82 ? "pink" : "cyan"
  }));
}

function updateHud() {
  scoreDisplay.textContent = formatScore(game.score);
  livesDisplay.textContent = game.lives > 0 ? `${"◆ ".repeat(game.lives).trim()}` : "—";
  levelLabel.textContent = `WAVE ${String(game.level).padStart(2, "0")}`;
}

function setEntryMessage(message, tone = "") {
  entryMessage.textContent = message;
  entryMessage.classList.toggle("is-error", tone === "error");
  entryMessage.classList.toggle("is-success", tone === "success");
}

function ensureAudio() {
  if (muted) return;
  try {
    if (!audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioContext = new AudioContext();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.12;
      masterGain.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function tone(frequency, duration = 0.08, type = "sine", volume = 0.35) {
  if (muted) return;
  ensureAudio();
  if (!audioContext || !masterGain) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.002, volume), audioContext.currentTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.02);
}

function toggleMute() {
  muted = !muted;
  muteButton.textContent = muted ? "SOUND OFF" : "SOUND ON";
  muteButton.setAttribute("aria-pressed", String(muted));
  if (!muted) {
    ensureAudio();
    tone(540, 0.09, "triangle", 0.18);
  }
}

function burst(x, y, color, count = 14, power = 1) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = (35 + Math.random() * 150) * power;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0.28 + Math.random() * 0.55,
      maxLife: 0.28 + Math.random() * 0.55,
      size: 1 + Math.random() * 3,
      color
    });
  }
}

function consumeEvents(events) {
  for (const event of events) {
    if (event.type === "start") {
      tone(330, 0.11, "triangle", 0.22);
      setTimeout(() => tone(660, 0.16, "triangle", 0.16), 75);
    } else if (event.type === "fire") {
      burst(event.x, event.y, "#8ff3ff", 3, 0.34);
      tone(610, 0.045, "square", 0.08);
    } else if (event.type === "spawn") {
      burst(event.x, Math.max(10, event.y + 22), event.color, 5, 0.25);
    } else if (event.type === "hit") {
      burst(event.x, event.y, event.color, event.points > 25 ? 24 : 15, event.points > 25 ? 1.25 : 1);
      tone(event.points > 25 ? 180 : 270, 0.12, "sawtooth", 0.18);
    } else if (event.type === "damage") {
      flash = 1;
      burst(event.x, event.y, "#ff5da8", 28, 1.15);
      tone(95, 0.22, "sawtooth", 0.3);
    } else if (event.type === "life-lost") {
      tone(75, 0.25, "square", 0.18);
    } else if (event.type === "gameover") {
      tone(170, 0.22, "triangle", 0.22);
      setTimeout(() => tone(90, 0.34, "triangle", 0.18), 150);
    }
  }
}

function updateParticles(dt) {
  for (const star of stars) {
    star.y += star.speed * dt * (game.phase === "playing" ? 1.5 : 0.45);
    if (star.y > viewHeight + 4) {
      star.y = -4;
      star.x = Math.random() * viewWidth;
    }
  }
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.97;
    particle.vy *= 0.97;
    particle.life -= dt;
  }
  particles = particles.filter((particle) => particle.life > 0);
  flash = Math.max(0, flash - dt * 3.4);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, viewHeight);
  gradient.addColorStop(0, "#0a1030");
  gradient.addColorStop(0.55, "#080d25");
  gradient.addColorStop(1, "#130b2c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const glow = ctx.createRadialGradient(viewWidth * 0.52, viewHeight * 0.04, 2, viewWidth * 0.52, viewHeight * 0.04, viewHeight * 0.78);
  glow.addColorStop(0, "rgba(40, 197, 240, .13)");
  glow.addColorStop(0.45, "rgba(80, 59, 180, .04)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  for (const star of stars) {
    ctx.fillStyle = star.tint === "pink" ? `rgba(255, 93, 168, ${star.alpha})` : `rgba(143, 243, 255, ${star.alpha})`;
    ctx.fillRect(star.x, star.y, star.size, star.size * (star.tint === "pink" ? 1 : 1.8));
  }

  ctx.save();
  ctx.strokeStyle = "rgba(82, 131, 219, .08)";
  ctx.lineWidth = 1;
  const grid = Math.max(42, viewWidth / 14);
  for (let x = (game.elapsed * 5) % grid; x < viewWidth; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewHeight); ctx.stroke();
  }
  for (let y = (game.elapsed * 18) % grid; y < viewHeight; y += grid) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewWidth, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 93, 168, .16)";
  ctx.beginPath(); ctx.moveTo(0, viewHeight * 0.78); ctx.lineTo(viewWidth, viewHeight * 0.78); ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  if (game.invulnerable > 0 && Math.floor(game.invulnerable * 12) % 2 === 0) return;
  const { x, y } = game.player;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "#48e7ff";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "rgba(72, 231, 255, .3)";
  ctx.beginPath(); ctx.moveTo(-4, 14); ctx.lineTo(0, 28 + Math.sin(game.elapsed * 18) * 4); ctx.lineTo(4, 14); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 10;
  const ship = ctx.createLinearGradient(0, -23, 0, 18);
  ship.addColorStop(0, "#eaffff"); ship.addColorStop(0.28, "#48e7ff"); ship.addColorStop(1, "#4b5aff");
  ctx.fillStyle = ship;
  ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(19, 15); ctx.lineTo(6, 11); ctx.lineTo(0, 18); ctx.lineTo(-6, 11); ctx.lineTo(-19, 15); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff5da8";
  ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(5, 4); ctx.lineTo(0, 9); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, .78)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(-18, 17); ctx.moveTo(12, 12); ctx.lineTo(18, 17); ctx.stroke();
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(game.elapsed * (enemy.kind === "scout" ? 2.2 : 0.8) + enemy.wave);
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = enemy.color;
  ctx.fillStyle = enemy.kind === "heavy" ? "rgba(255, 79, 154, .18)" : "rgba(164, 123, 255, .17)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (enemy.kind === "heavy") {
    for (let i = 0; i < 6; i += 1) { const a = i * Math.PI / 3; const px = Math.cos(a) * enemy.radius; const py = Math.sin(a) * enemy.radius; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  } else if (enemy.kind === "scout") {
    ctx.moveTo(0, -enemy.radius - 3); ctx.lineTo(enemy.radius, enemy.radius); ctx.lineTo(0, enemy.radius - 3); ctx.lineTo(-enemy.radius, enemy.radius); ctx.closePath();
  } else {
    ctx.moveTo(0, -enemy.radius); ctx.lineTo(enemy.radius, 0); ctx.lineTo(0, enemy.radius); ctx.lineTo(-enemy.radius, 0); ctx.closePath();
  }
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = enemy.color;
  ctx.fillRect(-2, -2, 4, 4);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  drawBackground();
  for (const projectile of game.projectiles) {
    const beam = ctx.createLinearGradient(0, projectile.y + 16, 0, projectile.y - 12);
    beam.addColorStop(0, "rgba(72, 231, 255, 0)"); beam.addColorStop(0.5, "#8ff3ff"); beam.addColorStop(1, "#ffffff");
    ctx.shadowColor = "#48e7ff"; ctx.shadowBlur = 13; ctx.fillStyle = beam; ctx.fillRect(projectile.x - 2, projectile.y - 15, 4, 31); ctx.shadowBlur = 0;
  }
  for (const enemy of game.enemies) drawEnemy(enemy);
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color; ctx.shadowBlur = 10;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  drawPlayer();
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 71, 150, ${flash * 0.12})`;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
  }
}

function showGameOver() {
  overlayKicker.textContent = "PILOT LINK INTERRUPTED";
  overlayTitle.textContent = "SIGNAL LOST";
  overlayMessage.textContent = "The grid took a hit. Upload your run to the global feed and relaunch when you’re ready.";
  finalScore.hidden = false;
  finalScoreValue.textContent = formatScore(game.score);
  startButton.textContent = "RESTART MISSION";
  overlay.classList.add("is-visible");
  nameInput.disabled = false;
  submitButton.disabled = false;
  setEntryMessage("Enter a callsign to upload this run.");
  updateHud();
}

function startGame() {
  ensureAudio();
  resizeCanvas();
  beginGame(game, viewWidth, viewHeight);
  particles = [];
  flash = 0;
  Object.keys(input).forEach((key) => { input[key] = false; });
  overlay.classList.remove("is-visible");
  finalScore.hidden = true;
  startButton.textContent = "START MISSION";
  nameInput.value = "";
  nameInput.disabled = true;
  submitButton.disabled = true;
  setEntryMessage("Finish a run to submit your score.");
  updateHud();
  tone(220, 0.1, "triangle", 0.18);
}

function handleKeyboard(event, pressed) {
  const key = event.key.toLowerCase();
  const action = key === "arrowleft" || key === "a" ? "left"
    : key === "arrowright" || key === "d" ? "right"
      : key === "arrowup" || key === "w" ? "up"
        : key === "arrowdown" || key === "s" ? "down"
          : event.code === "Space" ? "fire" : null;
  if (!action) return;
  event.preventDefault();
  input[action] = pressed;
  if (pressed && game.phase === "playing") ensureAudio();
}

function wireTouchControls() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;
    const release = (event) => {
      if (event) event.preventDefault();
      input[action] = false;
      button.classList.remove("is-held");
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      ensureAudio();
      input[action] = true;
      button.classList.add("is-held");
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
}

function renderLeaderboardRows(rows) {
  leaderboardList.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "leaderboard-state";
    empty.textContent = "No runs logged yet. Be the first signal in the feed.";
    leaderboardList.append(empty);
    return;
  }
  rows.slice(0, 10).forEach((row, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-row";
    const rank = document.createElement("span"); rank.className = "rank"; rank.textContent = `0${index + 1}`.slice(-2);
    const player = document.createElement("span"); player.className = "player-cell";
    const name = document.createElement("span"); name.className = "player-name"; name.textContent = String(row.player_name ?? "UNKNOWN");
    const date = document.createElement("span"); date.className = "player-date";
    const parsedDate = row.created_at ? new Date(row.created_at) : null;
    date.textContent = parsedDate && !Number.isNaN(parsedDate.valueOf()) ? parsedDate.toLocaleDateString(undefined, { month: "short", day: "2-digit" }).toUpperCase() : "LIVE RUN";
    player.append(name, date);
    const score = document.createElement("strong"); score.className = "player-score"; score.textContent = numberFormat.format(Number(row.score) || 0);
    item.append(rank, player, score);
    leaderboardList.append(item);
  });
}

function renderLeaderboardState(message, isError = false) {
  leaderboardList.replaceChildren();
  const item = document.createElement("li");
  item.className = `leaderboard-state${isError ? " is-error" : ""}`;
  const copy = document.createElement("span"); copy.textContent = message;
  item.append(copy);
  if (isError) {
    const retry = document.createElement("button"); retry.type = "button"; retry.className = "retry-button"; retry.dataset.retry = "true"; retry.textContent = "RETRY SYNC";
    item.append(retry);
  }
  leaderboardList.append(item);
}

async function loadLeaderboard() {
  const requestId = ++leaderboardRequest;
  leaderboardStatus.textContent = "SYNCING";
  leaderboardStatus.className = "sync-status";
  renderLeaderboardState("Connecting to the global feed…");
  if (!isLeaderboardConfigured()) {
    leaderboardStatus.textContent = "OFFLINE";
    leaderboardStatus.classList.add("is-error");
    renderLeaderboardState("Leaderboard is waiting for a production connection.", true);
    return false;
  }
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/leaderboard?select=player_name,score,created_at&candidate_id=eq.monolith_warm&order=score.desc,created_at.asc&limit=10`, {
      headers: { apikey: supabasePublicKey, Authorization: `Bearer ${supabasePublicKey}` }
    });
    if (!response.ok) throw new Error("leaderboard request failed");
    const rows = await response.json();
    if (requestId !== leaderboardRequest) return true;
    leaderboardStatus.textContent = "LIVE";
    leaderboardStatus.className = "sync-status is-ready";
    renderLeaderboardRows(Array.isArray(rows) ? rows : []);
    return true;
  } catch {
    if (requestId !== leaderboardRequest) return false;
    leaderboardStatus.textContent = "RETRY";
    leaderboardStatus.className = "sync-status is-error";
    renderLeaderboardState("The global feed is unreachable. Your run is still playable locally.", true);
    return false;
  }
}

async function submitScore() {
  if (game.phase !== "gameover") {
    setEntryMessage("Finish a run before uploading a score.", "error");
    return;
  }
  const playerName = validatePlayerName(nameInput.value);
  if (!playerName.valid) {
    setEntryMessage(playerName.message, "error");
    nameInput.focus();
    return;
  }
  if (!validateScore(game.score)) {
    setEntryMessage("This score is outside the accepted range.", "error");
    return;
  }
  if (!isLeaderboardConfigured()) {
    setEntryMessage("Leaderboard connection unavailable. Try again after deployment.", "error");
    return;
  }
  submitButton.disabled = true;
  setEntryMessage("Encrypting run telemetry…");
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/leaderboard`, {
      method: "POST",
      headers: {
        apikey: supabasePublicKey,
        Authorization: `Bearer ${supabasePublicKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ candidate_id: "monolith_warm", player_name: playerName.value, score: game.score })
    });
    if (!response.ok) throw new Error("score upload failed");
    const refreshed = await loadLeaderboard();
    nameInput.value = "";
    nameInput.disabled = true;
    setEntryMessage(refreshed ? "Score uploaded. The feed is live." : "Score uploaded. Feed refresh is delayed.", "success");
  } catch {
    submitButton.disabled = false;
    setEntryMessage("Upload failed. Check your connection and retry.", "error");
  }
}

function animationFrame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - frameTime) / 1000));
  frameTime = now;
  if (game.phase === "playing") {
    stepGame(game, input, dt);
    consumeEvents(game.events);
    updateHud();
    if (game.phase === "gameover") showGameOver();
  }
  updateParticles(dt);
  render();
  window.requestAnimationFrame(animationFrame);
}

startButton.addEventListener("click", startGame);
muteButton.addEventListener("click", toggleMute);
submitButton.addEventListener("click", submitScore);
nameInput.addEventListener("keydown", (event) => { if (event.key === "Enter") submitScore(); });
leaderboardList.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry]")) loadLeaderboard();
});
window.addEventListener("keydown", (event) => handleKeyboard(event, true));
window.addEventListener("keyup", (event) => handleKeyboard(event, false));
window.addEventListener("blur", () => Object.keys(input).forEach((key) => { input[key] = false; }));
window.addEventListener("resize", resizeCanvas);
wireTouchControls();
resizeCanvas();
updateHud();
loadLeaderboard();

window.__NEON_BARRAGE__ = {
  getState: () => ({
    phase: game.phase,
    score: game.score,
    lives: game.lives,
    playerX: Math.round(game.player.x),
    playerY: Math.round(game.player.y),
    enemyCount: game.enemies.length,
    projectileCount: game.projectiles.length
  }),
  endGameForTest: (score) => {
    if (!Number.isInteger(score) || score < 0) return false;
    endGame(game, Math.min(MAX_SCORE, score));
    consumeEvents(game.events);
    showGameOver();
    return true;
  }
};

window.requestAnimationFrame(animationFrame);
