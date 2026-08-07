import {
  clamp,
  circleIntersects,
  formatScore,
  isPlausibleScore,
  isValidName,
  sanitizeName
} from "./game-logic.js";

const config = window.__NEON_BARRAGE_CONFIG__ ?? {};
const SUPABASE_URL = String(config.supabaseUrl ?? "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = String(config.supabaseAnonKey ?? "");
const canvas = document.querySelector('[data-testid="game-canvas"]');
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const scoreElement = document.querySelector('[data-testid="score"]');
const livesElement = document.querySelector('[data-testid="lives"]');
const sectorElement = document.querySelector("#sector");
const threatMeter = document.querySelector("#threat-meter");
const threatLabel = document.querySelector("#threat-label");
const sessionStatus = document.querySelector("#session-status");
const readyOverlay = document.querySelector("#ready-overlay");
const gameoverOverlay = document.querySelector("#gameover-overlay");
const finalScoreElement = document.querySelector("#final-score");
const scoreForm = document.querySelector("#score-form");
const playerNameInput = document.querySelector('[data-testid="player-name"]');
const submitButton = document.querySelector('[data-testid="submit-score"]');
const formStatus = document.querySelector("#form-status");
const leaderboardElement = document.querySelector('[data-testid="leaderboard"]');
const leaderboardCard = document.querySelector(".leaderboard-card");
const muteButton = document.querySelector('[data-testid="mute-button"]');
const muteLabel = document.querySelector("#mute-label");

let phase = "ready";
let score = 0;
let lives = 3;
let elapsed = 0;
let spawnClock = 0;
let enemyFireClock = 1.2;
let fireClock = 0;
let hitClock = 0;
let shake = 0;
let lastFrame = 0;
let animationFrame = 0;
let muted = false;
let audioContext;
let audioReady = false;
let submitted = false;

const keys = new Set();
const touchKeys = new Set();
const player = { x: W / 2, y: H - 72, radius: 17, speed: 390 };
let enemies = [];
let projectiles = [];
let enemyProjectiles = [];
let particles = [];
let stars = [];

function random(min, max) {
  return min + Math.random() * (max - min);
}

function resetStars() {
  stars = Array.from({ length: 95 }, () => ({
    x: random(0, W),
    y: random(0, H),
    size: random(.4, 2.3),
    speed: random(5, 26),
    alpha: random(.16, .85),
    hue: Math.random() > .78 ? "pink" : "cyan"
  }));
}

function resetRun() {
  score = 0;
  lives = 3;
  elapsed = 0;
  spawnClock = .25;
  enemyFireClock = 1.1;
  fireClock = 0;
  hitClock = 0;
  shake = 0;
  player.x = W / 2;
  player.y = H - 72;
  enemies = [];
  projectiles = [];
  enemyProjectiles = [];
  particles = [];
  submitted = false;
  resetStars();
  playerNameInput.value = "";
  setFormStatus("");
  updateHud();
}

function startRun() {
  resetRun();
  phase = "playing";
  readyOverlay.hidden = true;
  gameoverOverlay.hidden = true;
  sessionStatus.className = "session-status live";
  sessionStatus.innerHTML = '<span class="status-dot"></span>RUNNING';
  ensureAudio();
  tone(360, .08, "triangle", .025);
}

function finishRun(finalValue = score) {
  const safeScore = isPlausibleScore(finalValue) ? finalValue : 0;
  score = safeScore;
  phase = "gameover";
  enemies = [];
  projectiles = [];
  enemyProjectiles = [];
  particles.push(...burst(player.x, player.y, "pink", 32));
  finalScoreElement.textContent = formatScore(score);
  gameoverOverlay.hidden = false;
  readyOverlay.hidden = true;
  sessionStatus.className = "session-status danger";
  sessionStatus.innerHTML = '<span class="status-dot"></span>MISSION ENDED';
  updateHud();
  playerNameInput.focus({ preventScroll: true });
  tone(110, .24, "sawtooth", .04);
  setTimeout(() => tone(72, .3, "sine", .025), 90);
}

function getState() {
  return {
    phase,
    score,
    lives,
    playerX: Math.round(player.x),
    playerY: Math.round(player.y),
    enemyCount: enemies.length,
    projectileCount: projectiles.length
  };
}

window.__NEON_BARRAGE__ = {
  getState,
  endGameForTest: (testScore) => {
    const numericScore = typeof testScore === "number" ? testScore : Number(testScore);
    if (!Number.isInteger(numericScore) || numericScore < 0) return false;
    finishRun(Math.min(numericScore, 2_147_483_647));
    return true;
  }
};

function updateHud() {
  scoreElement.textContent = formatScore(score);
  const hulls = [0, 1, 2].map((index) => (index < lives ? "◆" : "◇")).join(" ");
  livesElement.textContent = hulls;
  livesElement.setAttribute("aria-label", `${lives} ${lives === 1 ? "life" : "lives"}`);
  const sector = Math.min(99, 7 + Math.floor(elapsed / 18));
  sectorElement.textContent = `${String(sector).padStart(2, "0")} / 07`;
  const threat = clamp(10 + elapsed * 2.25 + score / 80, 8, 100);
  threatMeter.style.width = `${threat}%`;
  threatMeter.style.background = threat > 72 ? "var(--pink)" : threat > 42 ? "var(--amber)" : "var(--lime)";
  threatLabel.textContent = threat > 72 ? "CRITICAL" : threat > 42 ? "ELEVATED" : "LOW";
}

function active(key) {
  return keys.has(key) || touchKeys.has(key);
}

function spawnEnemy() {
  const difficulty = 1 + elapsed / 22 + score / 1400;
  const roll = Math.random();
  const type = roll > .84 && difficulty > 1.5 ? "tank" : roll > .58 ? "zig" : "drone";
  const stats = {
    drone: { radius: 15, hp: 1, speed: 72, value: 100, color: "#73eff7" },
    zig: { radius: 18, hp: 2, speed: 55, value: 180, color: "#ff54c8" },
    tank: { radius: 24, hp: 4, speed: 34, value: 420, color: "#a67dff" }
  }[type];
  enemies.push({
    type,
    x: random(40, W - 40),
    y: -stats.radius - 8,
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed * (1 + difficulty * .12),
    value: stats.value,
    color: stats.color,
    phase: random(0, Math.PI * 2),
    wobble: random(.45, 1.35),
    drift: random(-28, 28)
  });
}

function fire() {
  if (fireClock > 0 || phase !== "playing") return;
  fireClock = .17;
  projectiles.push({ x: player.x, y: player.y - 24, radius: 4, speed: 590 });
  tone(520, .045, "square", .018);
}

function update(dt) {
  elapsed += dt;
  spawnClock -= dt;
  enemyFireClock -= dt;
  fireClock -= dt;
  hitClock -= dt;
  shake = Math.max(0, shake - dt * 2.8);

  const xDirection = (active("right") ? 1 : 0) - (active("left") ? 1 : 0);
  const yDirection = (active("down") ? 1 : 0) - (active("up") ? 1 : 0);
  player.x = clamp(player.x + xDirection * player.speed * dt, 30, W - 30);
  player.y = clamp(player.y + yDirection * player.speed * dt, H * .48, H - 34);
  if (active("fire")) fire();

  const difficulty = 1 + elapsed / 22 + score / 1400;
  if (spawnClock <= 0) {
    spawnEnemy();
    if (difficulty > 2.7 && Math.random() > .52) spawnEnemy();
    spawnClock = Math.max(.26, 1.03 - difficulty * .09);
  }
  if (enemyFireClock <= 0 && enemies.length) {
    const shooter = enemies[Math.floor(Math.random() * enemies.length)];
    if (shooter.y > 0 && shooter.y < H * .66) enemyProjectiles.push({ x: shooter.x, y: shooter.y + shooter.radius, radius: 5, speed: 165 + difficulty * 15 });
    enemyFireClock = Math.max(.34, 1.45 - difficulty * .1);
  }

  for (const star of stars) {
    star.y += star.speed * dt * (1 + difficulty * .07);
    if (star.y > H + 4) { star.y = -4; star.x = random(0, W); }
  }
  for (const bullet of projectiles) bullet.y -= bullet.speed * dt;
  projectiles = projectiles.filter((bullet) => bullet.y > -20);
  for (const bullet of enemyProjectiles) bullet.y += bullet.speed * dt;
  enemyProjectiles = enemyProjectiles.filter((bullet) => bullet.y < H + 20);

  for (const enemy of enemies) {
    enemy.y += enemy.speed * dt;
    enemy.x += Math.sin(elapsed * enemy.wobble + enemy.phase) * enemy.drift * dt;
    enemy.x = clamp(enemy.x, enemy.radius + 10, W - enemy.radius - 10);
  }

  for (let bulletIndex = projectiles.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
    const bullet = projectiles[bulletIndex];
    let hit = false;
    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = enemies[enemyIndex];
      if (!circleIntersects(bullet, enemy)) continue;
      hit = true;
      enemy.hp -= 1;
      particles.push(...burst(bullet.x, bullet.y, enemy.color, enemy.hp <= 0 ? 10 : 4));
      tone(enemy.hp <= 0 ? 165 : 245, enemy.hp <= 0 ? .08 : .035, "triangle", .02);
      if (enemy.hp <= 0) {
        score = clamp(score + enemy.value, 0, 2_147_483_647);
        particles.push(...burst(enemy.x, enemy.y, enemy.color, enemy.type === "tank" ? 25 : 14));
        enemies.splice(enemyIndex, 1);
      }
      break;
    }
    if (hit) projectiles.splice(bulletIndex, 1);
  }

  if (hitClock <= 0) {
    for (let index = enemyProjectiles.length - 1; index >= 0; index -= 1) {
      if (!circleIntersects(enemyProjectiles[index], player)) continue;
      enemyProjectiles.splice(index, 1);
      damagePlayer();
      break;
    }
    for (let index = enemies.length - 1; index >= 0; index -= 1) {
      if (enemies[index].y > H + enemies[index].radius || !circleIntersects(enemies[index], player)) continue;
      enemies.splice(index, 1);
      damagePlayer();
      break;
    }
  }
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    particle.vx *= .985;
    particle.vy *= .985;
  }
  particles = particles.filter((particle) => particle.life > 0);
  updateHud();
}

function damagePlayer() {
  lives -= 1;
  hitClock = 1.05;
  shake = 1;
  particles.push(...burst(player.x, player.y, "#ff54c8", 26));
  tone(90, .12, "sawtooth", .04);
  if (lives <= 0) finishRun(score);
}

function burst(x, y, color, count) {
  return Array.from({ length: count }, () => {
    const angle = random(0, Math.PI * 2);
    const speed = random(30, 180);
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: random(1.5, 4), life: random(.25, .72), maxLife: .72, color };
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#071b2d");
  gradient.addColorStop(.54, "#030b18");
  gradient.addColorStop(1, "#12091d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * .5, H * .62, 10, W * .5, H * .62, 430);
  glow.addColorStop(0, "rgba(39, 110, 137, .12)");
  glow.addColorStop(1, "rgba(3, 8, 15, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  drawGrid();
  drawStars();

  ctx.save();
  if (shake > 0) ctx.translate(random(-shake * 5, shake * 5), random(-shake * 5, shake * 5));
  for (const bullet of enemyProjectiles) drawEnemyBullet(bullet);
  for (const bullet of projectiles) drawPlayerBullet(bullet);
  for (const enemy of enemies) drawEnemy(enemy);
  drawPlayer();
  for (const particle of particles) drawParticle(particle);
  ctx.restore();

  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, H * .75);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.43)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawGrid() {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(89, 205, 222, .08)";
  for (let x = 0; x <= W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  const offset = (elapsed * 18) % 48;
  for (let y = -48 + offset; y <= H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(255, 84, 200, .13)";
  ctx.beginPath(); ctx.moveTo(0, H * .8); ctx.lineTo(W, H * .8); ctx.stroke();
  ctx.restore();
}

function drawStars() {
  ctx.save();
  for (const star of stars) {
    ctx.globalAlpha = star.alpha * (.6 + Math.sin(elapsed * 2 + star.x) * .2);
    ctx.fillStyle = star.hue === "pink" ? "#ff54c8" : "#73eff7";
    ctx.fillRect(star.x, star.y, star.size, star.size * 2.4);
  }
  ctx.restore();
}

function drawPlayerBullet(bullet) {
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#73eff7";
  ctx.fillStyle = "#d9ffff";
  ctx.fillRect(bullet.x - 2, bullet.y - 14, 4, 18);
  ctx.restore();
}

function drawEnemyBullet(bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(Math.PI / 4);
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#ff54c8";
  ctx.fillStyle = "#ff9cde";
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(Math.sin(elapsed * 1.3 + enemy.phase) * .15);
  ctx.shadowBlur = 22;
  ctx.shadowColor = enemy.color;
  ctx.strokeStyle = enemy.color;
  ctx.fillStyle = "rgba(5, 16, 28, .95)";
  ctx.lineWidth = 2;
  if (enemy.type === "tank") {
    ctx.beginPath();
    ctx.moveTo(0, -enemy.radius); ctx.lineTo(enemy.radius, -8); ctx.lineTo(enemy.radius - 5, enemy.radius - 2); ctx.lineTo(0, enemy.radius); ctx.lineTo(-enemy.radius + 5, enemy.radius - 2); ctx.lineTo(-enemy.radius, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = enemy.color; ctx.globalAlpha = .34; ctx.fillRect(-8, -3, 16, 6);
    ctx.globalAlpha = 1; ctx.fillStyle = "#efffff"; ctx.fillRect(-3, -5, 6, 3);
  } else if (enemy.type === "zig") {
    ctx.beginPath(); ctx.moveTo(0, -enemy.radius); ctx.lineTo(enemy.radius, 0); ctx.lineTo(0, enemy.radius); ctx.lineTo(-enemy.radius, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(0, 5); ctx.lineTo(8, -2); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(0, -enemy.radius); ctx.lineTo(enemy.radius, enemy.radius * .7); ctx.lineTo(0, enemy.radius * .35); ctx.lineTo(-enemy.radius, enemy.radius * .7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#efffff"; ctx.beginPath(); ctx.arc(0, -3, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (enemy.hp < enemy.maxHp) {
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2, 2);
    ctx.fillStyle = enemy.color; ctx.fillRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 2);
  }
  ctx.restore();
}

function drawPlayer() {
  if (hitClock > .7 && Math.floor(hitClock * 16) % 2 === 0) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  const thrust = 13 + Math.sin(elapsed * 18) * 4;
  ctx.shadowBlur = 26;
  ctx.shadowColor = "#73eff7";
  ctx.fillStyle = "rgba(115, 239, 247, .25)";
  ctx.beginPath(); ctx.moveTo(-6, 13); ctx.lineTo(0, 13 + thrust); ctx.lineTo(6, 13); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#73eff7"; ctx.fillStyle = "#071a2c"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(18, 15); ctx.lineTo(7, 12); ctx.lineTo(0, 19); ctx.lineTo(-7, 12); ctx.lineTo(-18, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ff54c8"; ctx.shadowColor = "#ff54c8"; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(5, 5); ctx.lineTo(0, 9); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#e9fbfa"; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(0, -7, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
  ctx.fillStyle = particle.color;
  ctx.shadowBlur = 12;
  ctx.shadowColor = particle.color;
  ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function frame(timestamp) {
  const dt = Math.min(.035, lastFrame ? (timestamp - lastFrame) / 1000 : .016);
  lastFrame = timestamp;
  if (phase === "playing") update(dt);
  draw();
  animationFrame = requestAnimationFrame(frame);
}

function setFormStatus(message, kind = "") {
  formStatus.textContent = message;
  formStatus.className = `form-status ${kind}`.trim();
}

function setLeaderboardState(message, kind = "loading") {
  leaderboardElement.innerHTML = "";
  const state = document.createElement("div");
  state.className = `leaderboard-state ${kind}-state`;
  if (kind === "loading") {
    const loader = document.createElement("span");
    loader.className = "loader";
    state.append(loader, document.createTextNode(message));
  } else {
    state.textContent = message;
    if (kind === "error") {
      const button = document.createElement("button");
      button.className = "retry-button";
      button.type = "button";
      button.id = "retry-leaderboard";
      button.textContent = "RETRY SYNC";
      state.append(document.createElement("br"), button);
    }
  }
  leaderboardElement.append(state);
}

function renderLeaderboard(rows) {
  leaderboardElement.innerHTML = "";
  if (!rows.length) {
    setLeaderboardState("No verified runs yet. Be the first signal.", "empty");
    return;
  }
  rows.slice(0, 10).forEach((row, index) => {
    const item = document.createElement("div");
    item.className = "leaderboard-row";
    const rank = document.createElement("span");
    rank.className = "rank-number";
    rank.textContent = `0${index + 1}`.slice(-2);
    const name = document.createElement("span");
    name.className = "pilot-name";
    name.textContent = sanitizeName(row.name).toUpperCase();
    const points = document.createElement("span");
    points.className = "pilot-score";
    points.textContent = formatScore(Number(row.score));
    item.append(rank, name, points);
    leaderboardElement.append(item);
  });
}

async function loadLeaderboard() {
  setLeaderboardState("SYNCING GRID RECORDS…", "loading");
  if (!SUPABASE_URL || SUPABASE_URL.includes("__SUPABASE") || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("__SUPABASE")) {
    setLeaderboardState("Grid records are offline in this build.", "error");
    return;
  }
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard?select=name,score,created_at&order=score.desc,created_at.asc&limit=10`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status})`);
    const rows = await response.json();
    renderLeaderboard(Array.isArray(rows) ? rows : []);
  } catch (error) {
    console.warn(error);
    setLeaderboardState("Grid sync unavailable. The mission is still playable.", "error");
  }
}

async function submitScore(event) {
  event.preventDefault();
  const name = sanitizeName(playerNameInput.value);
  if (!isValidName(name)) {
    setFormStatus("Use 1–16 letters, numbers, spaces, _ or -.", "error");
    playerNameInput.focus();
    return;
  }
  if (!isPlausibleScore(score)) {
    setFormStatus("That score is outside the verified range.", "error");
    return;
  }
  if (submitted) {
    setFormStatus("This run has already been posted.", "success");
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes("__SUPABASE")) {
    setFormStatus("Score channel is unavailable right now.", "error");
    return;
  }
  submitButton.disabled = true;
  setFormStatus("VERIFYING RUN…");
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/leaderboard`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ name, score })
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Score request failed (${response.status})`);
    }
    submitted = true;
    setFormStatus("RUN VERIFIED — YOU ARE ON THE GRID.", "success");
    await loadLeaderboard();
  } catch (error) {
    console.warn(error);
    setFormStatus("Could not post this run. Check the channel and retry.", "error");
    submitButton.disabled = false;
  }
}

function ensureAudio() {
  if (muted || audioReady) {
    if (audioContext?.state === "suspended") audioContext.resume();
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext = new AudioContextClass();
  audioReady = true;
}

function tone(frequency, duration, type, volume) {
  if (muted || !audioContext || audioContext.state === "closed") return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function toggleMute() {
  muted = !muted;
  if (!muted) ensureAudio();
  muteButton.setAttribute("aria-pressed", String(muted));
  muteLabel.textContent = muted ? "SOUND OFF" : "SOUND ON";
  muteButton.querySelector(".mute-icon").textContent = muted ? "◌" : "◖";
}

function handleKeyDown(event) {
  const keyMap = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down", " ": "fire" };
  const mapped = keyMap[event.key];
  if (!mapped) return;
  event.preventDefault();
  ensureAudio();
  keys.add(mapped);
  if (event.key === " " && phase === "ready") startRun();
}

function handleKeyUp(event) {
  const keyMap = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down", A: "left", D: "right", W: "up", S: "down", " ": "fire" };
  if (keyMap[event.key]) keys.delete(keyMap[event.key]);
}

function bindTouchControls() {
  document.querySelectorAll(".touch-button").forEach((button) => {
    const key = button.dataset.key;
    const press = (event) => {
      event.preventDefault();
      ensureAudio();
      touchKeys.add(key);
      button.classList.add("active");
      if (phase === "ready") startRun();
      if (button.setPointerCapture && event.pointerId !== undefined) button.setPointerCapture(event.pointerId);
    };
    const release = (event) => {
      event.preventDefault();
      touchKeys.delete(key);
      button.classList.remove("active");
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", (event) => { if (event.buttons === 0) release(event); });
  });
}

document.querySelector('[data-testid="start-button"]').addEventListener("click", startRun);
document.querySelector("#restart-button").addEventListener("click", startRun);
scoreForm.addEventListener("submit", submitScore);
muteButton.addEventListener("click", toggleMute);
leaderboardCard.addEventListener("click", (event) => {
  if (event.target.id === "retry-leaderboard") loadLeaderboard();
});
window.addEventListener("keydown", handleKeyDown, { passive: false });
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => { keys.clear(); touchKeys.clear(); });

resetRun();
bindTouchControls();
loadLeaderboard();
animationFrame = requestAnimationFrame(frame);
