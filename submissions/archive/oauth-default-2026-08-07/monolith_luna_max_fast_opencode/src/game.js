import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";
import {
  WORLD,
  circlesOverlap,
  clamp,
  difficultyForScore,
  isValidName,
  isValidScore,
  normalizeScore
} from "./game-logic.js";

const canvas = document.querySelector('[data-testid="game-canvas"]');
const context = canvas.getContext("2d");
const overlay = document.querySelector("#game-overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const finalScore = document.querySelector("#final-score");
const finalScoreValue = document.querySelector("#final-score-value");
const nameField = document.querySelector("#name-field");
const playerName = document.querySelector('[data-testid="player-name"]');
const formMessage = document.querySelector("#form-message");
const startButton = document.querySelector('[data-testid="start-button"]');
const submitButton = document.querySelector('[data-testid="submit-score"]');
const scoreDisplay = document.querySelector('[data-testid="score"]');
const livesDisplay = document.querySelector('[data-testid="lives"]');
const waveDisplay = document.querySelector("#wave");
const threatDisplay = document.querySelector("#threat-level");
const bestScoreDisplay = document.querySelector("#best-score");
const muteButton = document.querySelector('[data-testid="mute-button"]');
const muteLabel = document.querySelector(".mute-label");
const leaderboard = document.querySelector('[data-testid="leaderboard"]');
const leaderboardStatus = document.querySelector("#leaderboard-status");
const leaderboardEmpty = document.querySelector("#leaderboard-empty");
const retryLeaderboard = document.querySelector("#retry-leaderboard");

const state = {
  phase: "ready",
  score: 0,
  lives: 3,
  playerX: WORLD.width / 2,
  playerY: WORLD.height - 78,
  wave: 1
};

const player = {
  x: WORLD.width / 2,
  y: WORLD.height - 78,
  radius: 17,
  speed: 325,
  fireCooldown: 0,
  invincible: 0
};

const keys = new Set();
const touchInput = new Set();
const enemies = [];
const projectiles = [];
const enemyProjectiles = [];
const particles = [];
const scorePopups = [];
const stars = createStars();

let enemySequence = 0;
let spawnTimer = 0.55;
let elapsed = 0;
let screenShake = 0;
let randomSeed = 0x7e57ab1;
let muted = false;
let audioContext = null;
let scoreSubmitted = false;

function random() {
  randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
  return randomSeed / 4294967296;
}

function createStars() {
  return Array.from({ length: 82 }, (_, index) => ({
    x: (index * 113) % WORLD.width,
    y: (index * 71) % WORLD.height,
    size: index % 9 === 0 ? 1.7 : index % 3 === 0 ? 1.1 : 0.65,
    speed: 8 + (index % 6) * 5,
    alpha: 0.25 + (index % 5) * 0.1,
    phase: (index * 0.71) % 6.28
  }));
}

function formatScore(value) {
  return String(Math.max(0, Math.floor(value))).padStart(6, "0");
}

function setFormMessage(message, success = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("success", success);
}

function ensureAudio() {
  if (audioContext || !window.AudioContext) {
    return;
  }

  try {
    audioContext = new window.AudioContext();
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
  } catch {
    audioContext = null;
  }
}

function playTone(frequency, duration = 0.08, type = "sine", volume = 0.025, slide = 0) {
  if (muted || !audioContext || audioContext.state === "closed") {
    return;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.linearRampToValueAtTime(frequency + slide, now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function updateSoundButton() {
  muteButton.setAttribute("aria-pressed", String(muted));
  muteButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  muteLabel.textContent = muted ? "SOUND OFF" : "SOUND ON";
}

function updateHud() {
  const difficulty = difficultyForScore(state.score);
  scoreDisplay.textContent = formatScore(state.score);
  livesDisplay.textContent = String(Math.max(0, state.lives)).padStart(2, "0");
  waveDisplay.textContent = String(difficulty.level).padStart(2, "0");
  threatDisplay.textContent = String(difficulty.level).padStart(2, "0");
  state.playerX = Math.round(player.x);
  state.playerY = Math.round(player.y);
}

function resetWorld() {
  enemies.length = 0;
  projectiles.length = 0;
  enemyProjectiles.length = 0;
  particles.length = 0;
  scorePopups.length = 0;
  player.x = WORLD.width / 2;
  player.y = WORLD.height - 78;
  player.fireCooldown = 0;
  player.invincible = 0;
  spawnTimer = 0.55;
  screenShake = 0;
  state.score = 0;
  state.lives = 3;
  state.wave = 1;
  scoreSubmitted = false;
}

function startRun() {
  ensureAudio();
  resetWorld();
  state.phase = "playing";
  overlay.classList.add("is-hidden");
  finalScore.hidden = true;
  nameField.hidden = true;
  submitButton.hidden = true;
  startButton.hidden = false;
  startButton.innerHTML = "RESTART RUN <span aria-hidden=\"true\">[ ENTER ]</span>";
  playerName.value = "";
  setFormMessage("");
  canvas.focus({ preventScroll: true });
  playTone(310, 0.13, "sine", 0.035, 180);
  updateHud();
}

function endRun(score = state.score) {
  state.score = normalizeScore(score);
  state.phase = "gameover";
  state.lives = 0;
  keys.clear();
  touchInput.clear();
  screenShake = 0.2;
  playTone(190, 0.22, "sawtooth", 0.04, -110);
  overlay.classList.remove("is-hidden");
  overlayKicker.textContent = "SIGNAL LOST / RUN COMPLETE";
  overlayTitle.innerHTML = "RUN <br /><em>COMPLETE</em>";
  overlayCopy.textContent = "The belt remembers every pilot. Log your score to the grid.";
  finalScoreValue.textContent = formatScore(state.score);
  finalScore.hidden = false;
  nameField.hidden = false;
  submitButton.hidden = false;
  submitButton.disabled = false;
  submitButton.innerHTML = "SUBMIT SCORE <span aria-hidden=\"true\">[ SEND ]</span>";
  startButton.hidden = false;
  startButton.innerHTML = "PLAY AGAIN <span aria-hidden=\"true\">[ ENTER ]</span>";
  playerName.value = "";
  setFormMessage("");
  updateHud();
}

function firePlayer() {
  if (state.phase !== "playing") {
    return;
  }

  projectiles.push(
    { x: player.x - 7, y: player.y - 16, vx: -9, vy: -620, radius: 4, hue: "cyan" },
    { x: player.x + 7, y: player.y - 16, vx: 9, vy: -620, radius: 4, hue: "cyan" }
  );
  player.fireCooldown = 0.16;
  playTone(650, 0.045, "square", 0.012, 180);
}

function spawnEnemy() {
  const difficulty = difficultyForScore(state.score);
  const roll = random();
  const type = difficulty.level >= 3 && roll < 0.18 ? "tank" : roll < 0.48 ? "weaver" : "scout";
  const tank = type === "tank";
  const enemy = {
    id: enemySequence++,
    type,
    x: 65 + random() * (WORLD.width - 130),
    y: -35,
    radius: tank ? 23 : type === "weaver" ? 18 : 15,
    hp: tank ? 3 : 1,
    maxHp: tank ? 3 : 1,
    speed: difficulty.enemySpeed * (tank ? 0.58 : type === "weaver" ? 0.83 : 1),
    drift: (random() - 0.5) * 45,
    phase: random() * 6.28,
    age: 0,
    fireTimer: 1 + random() * difficulty.fireInterval
  };
  enemies.push(enemy);
}

function fireEnemy(enemy) {
  const aimX = player.x - enemy.x;
  const aimY = player.y - enemy.y;
  const length = Math.max(1, Math.hypot(aimX, aimY));
  const speed = 175 + difficultyForScore(state.score).level * 12;
  enemyProjectiles.push({
    x: enemy.x,
    y: enemy.y + enemy.radius,
    vx: (aimX / length) * speed,
    vy: (aimY / length) * speed,
    radius: 5,
    hue: "pink"
  });
  playTone(220, 0.05, "triangle", 0.009, -50);
}

function burst(x, y, color, amount = 12, power = 100) {
  for (let index = 0; index < amount; index += 1) {
    const angle = random() * Math.PI * 2;
    const velocity = power * (0.35 + random() * 0.85);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0.35 + random() * 0.5,
      maxLife: 0.85,
      size: 1 + random() * 2.8,
      color
    });
  }
}

function addScorePopup(x, y, points) {
  scorePopups.push({ x, y, points, life: 0.8 });
}

function damagePlayer() {
  if (player.invincible > 0 || state.phase !== "playing") {
    return;
  }

  state.lives -= 1;
  player.invincible = 1.35;
  screenShake = 0.38;
  burst(player.x, player.y, "pink", 22, 150);
  playTone(105, 0.18, "sawtooth", 0.035, 70);
  if (state.lives <= 0) {
    endRun(state.score);
  }
}

function updatePlayer(delta) {
  let horizontal = 0;
  let vertical = 0;
  if (keys.has("arrowleft") || keys.has("a") || touchInput.has("left")) horizontal -= 1;
  if (keys.has("arrowright") || keys.has("d") || touchInput.has("right")) horizontal += 1;
  if (keys.has("arrowup") || keys.has("w") || touchInput.has("up")) vertical -= 1;
  if (keys.has("arrowdown") || keys.has("s") || touchInput.has("down")) vertical += 1;

  if (horizontal || vertical) {
    const length = Math.max(1, Math.hypot(horizontal, vertical));
    player.x = clamp(player.x + (horizontal / length) * player.speed * delta, 30, WORLD.width - 30);
    player.y = clamp(player.y + (vertical / length) * player.speed * delta, 40, WORLD.height - 27);
  }

  player.fireCooldown -= delta;
  if ((keys.has("space") || touchInput.has("fire")) && player.fireCooldown <= 0) {
    firePlayer();
  }
  player.invincible = Math.max(0, player.invincible - delta);
}

function updateGame(delta) {
  const difficulty = difficultyForScore(state.score);
  state.wave = difficulty.level;
  updatePlayer(delta);

  spawnTimer -= delta;
  if (spawnTimer <= 0 && enemies.length < difficulty.maxEnemies) {
    spawnEnemy();
    spawnTimer = difficulty.spawnInterval * (0.72 + random() * 0.5);
  }

  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const enemy = enemies[index];
    enemy.age += delta;
    enemy.y += enemy.speed * delta;
    enemy.x += Math.sin(enemy.age * (enemy.type === "weaver" ? 3.1 : 1.4) + enemy.phase) * enemy.drift * delta;
    enemy.x = clamp(enemy.x, enemy.radius + 12, WORLD.width - enemy.radius - 12);
    enemy.fireTimer -= delta;
    if (enemy.fireTimer <= 0 && enemy.y > 35 && enemy.y < WORLD.height * 0.67) {
      fireEnemy(enemy);
      enemy.fireTimer = difficulty.fireInterval * (0.75 + random() * 0.55);
    }
    if (enemy.y > WORLD.height + 35) {
      enemies.splice(index, 1);
      damagePlayer();
    }
  }

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.x += projectile.vx * delta;
    projectile.y += projectile.vy * delta;
    if (projectile.y < -25 || projectile.x < -25 || projectile.x > WORLD.width + 25) {
      projectiles.splice(index, 1);
    }
  }

  for (let index = enemyProjectiles.length - 1; index >= 0; index -= 1) {
    const projectile = enemyProjectiles[index];
    projectile.x += projectile.vx * delta;
    projectile.y += projectile.vy * delta;
    if (projectile.y < -30 || projectile.y > WORLD.height + 30 || projectile.x < -30 || projectile.x > WORLD.width + 30) {
      enemyProjectiles.splice(index, 1);
    } else if (circlesOverlap(projectile, player)) {
      enemyProjectiles.splice(index, 1);
      damagePlayer();
    }
  }

  for (let projectileIndex = projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
    const projectile = projectiles[projectileIndex];
    let hitEnemy = -1;
    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      if (circlesOverlap(projectile, enemies[enemyIndex])) {
        hitEnemy = enemyIndex;
        break;
      }
    }
    if (hitEnemy === -1) {
      continue;
    }

    projectiles.splice(projectileIndex, 1);
    const enemy = enemies[hitEnemy];
    enemy.hp -= 1;
    burst(projectile.x, projectile.y, "cyan", 5, 65);
    if (enemy.hp <= 0) {
      const points = enemy.type === "tank" ? 150 : enemy.type === "weaver" ? 90 : 50;
      state.score = normalizeScore(state.score + points);
      addScorePopup(enemy.x, enemy.y, points);
      burst(enemy.x, enemy.y, enemy.type === "tank" ? "orange" : "pink", enemy.type === "tank" ? 25 : 15, 155);
      playTone(enemy.type === "tank" ? 180 : 330, 0.12, "triangle", 0.025, enemy.type === "tank" ? -90 : 160);
      enemies.splice(hitEnemy, 1);
    } else {
      playTone(460, 0.04, "square", 0.009, -70);
    }
  }

  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    if (circlesOverlap(enemies[index], player)) {
      const enemy = enemies.splice(index, 1)[0];
      burst(enemy.x, enemy.y, "pink", 16, 125);
      damagePlayer();
    }
  }

  if (state.phase === "playing") {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
      particle.life -= delta;
      if (particle.life <= 0) particles.splice(index, 1);
    }
    for (let index = scorePopups.length - 1; index >= 0; index -= 1) {
      scorePopups[index].y -= 25 * delta;
      scorePopups[index].life -= delta;
      if (scorePopups[index].life <= 0) scorePopups.splice(index, 1);
    }
  }

  screenShake = Math.max(0, screenShake - delta * 1.8);
  updateHud();
}

function updateAmbient(delta) {
  elapsed += delta;
  for (const star of stars) {
    star.y += star.speed * delta;
    if (star.y > WORLD.height + 5) {
      star.y = -5;
      star.x = random() * WORLD.width;
    }
  }
  if (state.phase !== "playing") {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      particles[index].life -= delta;
      if (particles[index].life <= 0) particles.splice(index, 1);
    }
    screenShake = Math.max(0, screenShake - delta * 1.8);
  }
}

function drawBackground() {
  const background = context.createLinearGradient(0, 0, 0, WORLD.height);
  background.addColorStop(0, "#0a1227");
  background.addColorStop(0.56, "#090d20");
  background.addColorStop(1, "#100c21");
  context.fillStyle = background;
  context.fillRect(0, 0, WORLD.width, WORLD.height);

  const horizon = context.createRadialGradient(WORLD.width * 0.5, WORLD.height * 0.79, 8, WORLD.width * 0.5, WORLD.height * 0.79, 420);
  horizon.addColorStop(0, "rgba(255, 104, 183, 0.11)");
  horizon.addColorStop(0.38, "rgba(42, 164, 213, 0.04)");
  horizon.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = horizon;
  context.fillRect(0, 0, WORLD.width, WORLD.height);

  context.save();
  context.globalAlpha = 0.4;
  context.strokeStyle = "rgba(112, 236, 255, 0.09)";
  context.lineWidth = 1;
  for (let x = 30; x < WORLD.width; x += 60) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, WORLD.height);
    context.stroke();
  }
  for (let y = 30; y < WORLD.height; y += 60) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD.width, y);
    context.stroke();
  }
  context.restore();

  for (const star of stars) {
    const alpha = star.alpha * (0.72 + Math.sin(elapsed * 2 + star.phase) * 0.28);
    context.fillStyle = `rgba(160, 225, 255, ${alpha})`;
    context.fillRect(star.x, star.y, star.size, star.size);
  }

  context.save();
  context.strokeStyle = "rgba(112, 236, 255, 0.22)";
  context.setLineDash([2, 8]);
  context.beginPath();
  context.moveTo(22, WORLD.height - 92);
  context.lineTo(WORLD.width - 22, WORLD.height - 92);
  context.stroke();
  context.restore();
}

function drawProjectile(projectile) {
  const color = projectile.hue === "pink" ? "#ff68b7" : "#70ecff";
  context.save();
  context.strokeStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 13;
  context.lineWidth = projectile.hue === "pink" ? 3 : 2;
  context.beginPath();
  context.moveTo(projectile.x, projectile.y);
  context.lineTo(projectile.x - projectile.vx * 0.025, projectile.y - projectile.vy * 0.025);
  context.stroke();
  context.restore();
}

function drawEnemy(enemy) {
  const color = enemy.type === "tank" ? "#ffb26b" : "#ff68b7";
  const secondary = enemy.type === "tank" ? "#ff714f" : "#ad69ff";
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(enemy.type === "weaver" ? enemy.age * 0.9 : 0);
  context.shadowColor = color;
  context.shadowBlur = 16;
  context.strokeStyle = color;
  context.fillStyle = "rgba(13, 17, 39, 0.92)";
  context.lineWidth = 2;
  context.beginPath();
  if (enemy.type === "tank") {
    context.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
    context.moveTo(-enemy.radius * 0.64, 0);
    context.lineTo(enemy.radius * 0.64, 0);
    context.moveTo(0, -enemy.radius * 0.64);
    context.lineTo(0, enemy.radius * 0.64);
  } else if (enemy.type === "weaver") {
    context.moveTo(0, -enemy.radius);
    context.lineTo(enemy.radius, 0);
    context.lineTo(0, enemy.radius);
    context.lineTo(-enemy.radius, 0);
    context.closePath();
  } else {
    context.moveTo(0, -enemy.radius - 3);
    context.lineTo(enemy.radius + 2, enemy.radius);
    context.lineTo(0, enemy.radius * 0.48);
    context.lineTo(-enemy.radius - 2, enemy.radius);
    context.closePath();
  }
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = secondary;
  context.beginPath();
  context.arc(0, 0, enemy.type === "tank" ? 5 : 3.5, 0, Math.PI * 2);
  context.fill();
  if (enemy.maxHp > 1) {
    context.fillStyle = "rgba(255,255,255,0.2)";
    context.fillRect(-enemy.radius, -enemy.radius - 8, enemy.radius * 2, 2);
    context.fillStyle = color;
    context.fillRect(-enemy.radius, -enemy.radius - 8, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 2);
  }
  context.restore();
}

function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible * 13) % 2 === 0) {
    return;
  }

  context.save();
  context.translate(player.x, player.y);
  const thrust = 8 + Math.sin(elapsed * 18) * 4;
  context.shadowColor = "#70ecff";
  context.shadowBlur = 20;
  context.fillStyle = "#70ecff";
  context.beginPath();
  context.moveTo(0, 20 + thrust);
  context.lineTo(-5, 9);
  context.lineTo(5, 9);
  context.closePath();
  context.fill();
  context.shadowBlur = 15;
  context.fillStyle = "#0a152a";
  context.strokeStyle = "#d7fbff";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, -23);
  context.lineTo(18, 17);
  context.lineTo(0, 11);
  context.lineTo(-18, 17);
  context.closePath();
  context.fill();
  context.stroke();
  context.shadowBlur = 8;
  context.fillStyle = "#ff68b7";
  context.beginPath();
  context.arc(0, -5, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawParticles() {
  for (const particle of particles) {
    context.save();
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color === "pink" ? "#ff68b7" : particle.color === "orange" ? "#ffb26b" : "#70ecff";
    context.shadowColor = context.fillStyle;
    context.shadowBlur = 8;
    context.fillRect(particle.x, particle.y, particle.size, particle.size);
    context.restore();
  }

  for (const popup of scorePopups) {
    context.save();
    context.globalAlpha = Math.min(1, popup.life * 2);
    context.fillStyle = "#d2ff72";
    context.font = "700 12px SFMono-Regular, Consolas, monospace";
    context.textAlign = "center";
    context.fillText(`+${popup.points}`, popup.x, popup.y);
    context.restore();
  }
}

function drawCanvasLabels() {
  context.save();
  context.fillStyle = "rgba(160, 181, 224, 0.66)";
  context.font = "9px SFMono-Regular, Consolas, monospace";
  context.letterSpacing = "2px";
  context.fillText("NB // 07", 24, 27);
  context.fillText(state.phase === "playing" ? "SIGNAL LOCKED" : "AWAITING PILOT", WORLD.width - 127, 27);
  context.fillStyle = "rgba(112, 236, 255, 0.3)";
  context.fillText(`X ${String(Math.round(player.x)).padStart(3, "0")}  Y ${String(Math.round(player.y)).padStart(3, "0")}`, 24, WORLD.height - 21);
  context.textAlign = "right";
  context.fillText(`HOSTILE ${String(enemies.length).padStart(2, "0")}`, WORLD.width - 24, WORLD.height - 21);
  context.restore();
}

function draw() {
  context.save();
  if (screenShake > 0) {
    context.translate((random() - 0.5) * screenShake * 12, (random() - 0.5) * screenShake * 12);
  }
  drawBackground();
  for (const enemy of enemies) drawEnemy(enemy);
  for (const projectile of projectiles) drawProjectile(projectile);
  for (const projectile of enemyProjectiles) drawProjectile(projectile);
  drawParticles();
  drawPlayer();
  drawCanvasLabels();
  context.restore();
}

function showLeaderboardLoading() {
  leaderboardStatus.textContent = "SYNCING";
  leaderboardStatus.classList.remove("error");
  leaderboardEmpty.hidden = true;
  retryLeaderboard.hidden = true;
  leaderboard.innerHTML = '<li class="leaderboard-placeholder">Loading the grid...</li>';
}

function showLeaderboardError(message) {
  leaderboardStatus.textContent = "SYNC ERROR";
  leaderboardStatus.classList.add("error");
  leaderboard.innerHTML = `<li class="leaderboard-placeholder">${message}</li>`;
  leaderboardEmpty.hidden = true;
  retryLeaderboard.hidden = false;
}

function renderLeaderboard(entries) {
  leaderboardStatus.textContent = "LIVE / TOP 10";
  leaderboardStatus.classList.remove("error");
  retryLeaderboard.hidden = true;
  leaderboard.replaceChildren();
  if (!entries.length) {
    leaderboardEmpty.hidden = false;
    return;
  }

  leaderboardEmpty.hidden = true;
  entries.slice(0, 10).forEach((entry, index) => {
    const row = document.createElement("li");
    row.className = "leaderboard-row";
    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = String(entry.name ?? "UNKNOWN").trim().slice(0, 16);
    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = formatScore(Number(entry.score) || 0);
    row.append(rank, name, score);
    leaderboard.append(row);
  });

  const topScore = Number(entries[0]?.score);
  bestScoreDisplay.textContent = Number.isFinite(topScore) ? formatScore(topScore) : "------";
}

async function loadLeaderboard() {
  showLeaderboardLoading();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showLeaderboardError("Leaderboard is offline in this build.");
    return;
  }

  const endpoint = `${SUPABASE_URL}/rest/v1/leaderboard?select=name,score,created_at&order=score.desc,created_at.asc&limit=10`;
  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Leaderboard returned ${response.status}`);
    }
    const entries = await response.json();
    if (!Array.isArray(entries)) {
      throw new Error("Leaderboard response was not a list");
    }
    renderLeaderboard(entries);
  } catch (error) {
    console.warn("Leaderboard sync failed", error);
    showLeaderboardError("Sync unavailable. The run is still playable.");
  }
}

async function submitScore() {
  const name = playerName.value.trim();
  if (!isValidName(name)) {
    setFormMessage("Use a callsign from 1 to 16 characters.");
    playerName.focus();
    return;
  }
  if (!isValidScore(state.score)) {
    setFormMessage("That score is outside the accepted range.");
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setFormMessage("Leaderboard is offline. You can still play another run.");
    return;
  }

  ensureAudio();
  submitButton.disabled = true;
  submitButton.textContent = "SENDING...";
  setFormMessage("Transmitting score...");
  const endpoint = `${SUPABASE_URL}/rest/v1/leaderboard`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ name, score: state.score })
    });
    if (!response.ok) {
      throw new Error(`Score submission returned ${response.status}`);
    }
    scoreSubmitted = true;
    submitButton.textContent = "SCORE SENT";
    await loadLeaderboard();
    setFormMessage("Score logged to the grid.", true);
  } catch (error) {
    console.warn("Score submission failed", error);
    submitButton.disabled = false;
    submitButton.innerHTML = "SUBMIT SCORE <span aria-hidden=\"true\">[ SEND ]</span>";
    setFormMessage("Transmission failed. Check the signal and retry.");
  }
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  const supported = ["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d", " "];
  if (supported.includes(key) || event.code === "Space") {
    event.preventDefault();
    ensureAudio();
  }
  if (event.code === "Space") {
    keys.add("space");
    if (state.phase !== "playing") startRun();
  } else if (supported.includes(key)) {
    keys.add(key);
    if (state.phase !== "playing" && key !== " ") startRun();
  }
  if (event.key === "Enter" && state.phase !== "playing" && document.activeElement !== playerName) {
    event.preventDefault();
    startRun();
  }
}

function onKeyUp(event) {
  const key = event.key.toLowerCase();
  if (event.code === "Space") keys.delete("space");
  keys.delete(key);
}

function bindTouchControls() {
  document.querySelectorAll("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    const release = () => touchInput.delete(control);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      ensureAudio();
      if (state.phase !== "playing") startRun();
      touchInput.add(control);
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });
}

startButton.addEventListener("click", startRun);
submitButton.addEventListener("click", submitScore);
playerName.addEventListener("input", () => {
  if (formMessage.textContent) setFormMessage("");
});
retryLeaderboard.addEventListener("click", loadLeaderboard);
muteButton.addEventListener("click", () => {
  ensureAudio();
  muted = !muted;
  updateSoundButton();
  if (!muted) playTone(460, 0.08, "sine", 0.018, 100);
});
canvas.addEventListener("pointerdown", () => {
  ensureAudio();
  canvas.focus({ preventScroll: true });
});
window.addEventListener("keydown", onKeyDown, { passive: false });
window.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", () => {
  keys.clear();
  touchInput.clear();
});
bindTouchControls();
updateSoundButton();
updateHud();
void loadLeaderboard();

window.__NEON_BARRAGE__ = {
  getState: () => ({
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    playerX: Math.round(player.x),
    playerY: Math.round(player.y),
    enemyCount: enemies.length,
    projectileCount: projectiles.length + enemyProjectiles.length
  }),
  endGameForTest: (score) => {
    endRun(normalizeScore(score));
  }
};

let lastFrame = performance.now();
function frame(now) {
  const delta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  updateAmbient(delta);
  if (state.phase === "playing") updateGame(delta);
  draw();
  window.requestAnimationFrame(frame);
}

window.requestAnimationFrame(frame);
