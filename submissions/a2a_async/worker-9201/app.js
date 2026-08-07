import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  beginGame,
  createGameState,
  endGame,
  getStateSnapshot,
  stepGame,
} from "./src/game-engine.js";
import {
  LeaderboardError,
  createLeaderboardClient,
  validatePlayerName,
} from "./src/leaderboard.js";

const canvas = document.querySelector('[data-testid="game-canvas"]');
const context = canvas.getContext("2d");
const state = createGameState(canvas.width, canvas.height);
const input = { up: false, down: false, left: false, right: false, fire: false };
const stars = createStars(92);

const elements = {
  canvasFrame: document.querySelector("#canvas-frame"),
  overlay: document.querySelector("#game-overlay"),
  overlayKicker: document.querySelector("#overlay-kicker"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayCopy: document.querySelector("#overlay-copy"),
  idleControls: document.querySelector("#idle-controls"),
  gameoverPanel: document.querySelector("#gameover-panel"),
  startButton: document.querySelector('[data-testid="start-button"]'),
  startButtonLabel: document.querySelector("#start-button-label"),
  score: document.querySelector('[data-testid="score"]'),
  lives: document.querySelector('[data-testid="lives"]'),
  level: document.querySelector("#level-display"),
  threat: document.querySelector("#threat-display"),
  phase: document.querySelector("#phase-badge"),
  telemetry: document.querySelector("#telemetry-text"),
  finalScore: document.querySelector("#final-score"),
  scoreForm: document.querySelector("#score-form"),
  nameInput: document.querySelector('[data-testid="player-name"]'),
  submitScore: document.querySelector('[data-testid="submit-score"]'),
  nameError: document.querySelector("#name-error"),
  submitStatus: document.querySelector("#submit-status"),
  muteButton: document.querySelector('[data-testid="mute-button"]'),
  muteLabel: document.querySelector(".sound-label"),
  muteIcon: document.querySelector(".sound-icon"),
  leaderboard: document.querySelector('[data-testid="leaderboard"]'),
  leaderboardStatus: document.querySelector("#leaderboard-status"),
};

const leaderboard = createLeaderboardClient(window.__NEON_BARRAGE_CONFIG__ || {});
let lastTime = performance.now();
let frameTime = 0;
let previousScore = state.score;
let previousLives = state.lives;
let previousPhase = state.phase;
let lastTelemetry = "Awaiting pilot input";

function createStars(count) {
  let seed = 0x9e3779b9;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  return Array.from({ length: count }, () => ({
    x: next() * WORLD_WIDTH,
    y: next() * WORLD_HEIGHT,
    radius: 0.35 + next() * 1.45,
    depth: 0.2 + next() * 0.8,
    phase: next() * Math.PI * 2,
  }));
}

function formatScore(value) {
  return String(Math.max(0, Math.trunc(Number(value) || 0))).padStart(6, "0");
}

function updateHud() {
  elements.score.textContent = formatScore(state.score);
  elements.finalScore.textContent = formatScore(state.finalScore ?? state.score);
  elements.lives.setAttribute("aria-label", `${state.lives} ${state.lives === 1 ? "life" : "lives"}`);
  elements.lives.replaceChildren(
    ...Array.from({ length: 3 }, (_, index) => {
      const pip = document.createElement("i");
      if (index >= state.lives) pip.className = "is-lost";
      return pip;
    }),
  );
  elements.level.textContent = `WAVE ${String(state.level).padStart(2, "0")}`;
  const threat = state.level >= 5 ? "CRITICAL" : state.level >= 3 ? "ELEVATED" : state.level >= 2 ? "RISING" : "LOW";
  elements.threat.textContent = threat;
  elements.threat.classList.toggle("is-hot", state.level >= 3);
}

function setTelemetry(message) {
  if (message === lastTelemetry) return;
  lastTelemetry = message;
  elements.telemetry.textContent = message;
}

function showIdle() {
  elements.overlay.hidden = false;
  elements.overlay.dataset.phase = "idle";
  elements.phase.textContent = "READY TO DEPLOY";
  elements.phase.className = "phase-badge";
  elements.overlayKicker.textContent = "SIGNAL LOCKED // READY";
  elements.overlayTitle.innerHTML = "Defend the<br /><span>last light.</span>";
  elements.overlayCopy.textContent = "Steer the prism ship, cut through the incoming swarm, and make your name visible on the board.";
  elements.idleControls.hidden = false;
  elements.gameoverPanel.hidden = true;
  elements.startButtonLabel.textContent = "Launch mission";
  setTelemetry("Awaiting pilot input");
}

function showPlaying() {
  elements.overlay.hidden = true;
  elements.phase.textContent = "MISSION ACTIVE";
  elements.phase.className = "phase-badge is-live";
  setTelemetry("Hull sync stable");
}

function showGameOver() {
  elements.overlay.hidden = false;
  elements.overlay.dataset.phase = "gameover";
  elements.phase.textContent = "SIGNAL LOST";
  elements.phase.className = "phase-badge is-over";
  elements.overlayKicker.textContent = "RUN COMPLETE // TRANSMISSION READY";
  elements.overlayTitle.innerHTML = "Signal<br /><span>lost.</span>";
  elements.overlayCopy.textContent = "The swarm found the opening. Lock in your score, then push the run further.";
  elements.idleControls.hidden = true;
  elements.gameoverPanel.hidden = false;
  elements.startButtonLabel.textContent = "Run it back";
  elements.nameError.textContent = "";
  elements.submitStatus.textContent = "";
  elements.submitStatus.className = "submit-status";
  elements.submitScore.disabled = false;
  elements.submitScore.textContent = "SEND";
  elements.nameInput.disabled = false;
  elements.nameInput.value = "";
  setTelemetry("Run ended // score ready");
}

function syncPhase() {
  if (state.phase === "idle") showIdle();
  else if (state.phase === "playing") showPlaying();
  else showGameOver();
  updateHud();
}

function startMission() {
  sound.unlock();
  beginGame(state);
  clearInput();
  previousScore = state.score;
  previousLives = state.lives;
  previousPhase = state.phase;
  elements.submitStatus.textContent = "";
  sound.play("launch");
  syncPhase();
}

function finishMissionForTest(score) {
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new TypeError("endGameForTest expects a non-negative safe integer score");
  }
  if (state.phase !== "playing") beginGame(state);
  endGame(state, score);
  showGameOver();
  updateHud();
  sound.play("gameover");
}

function clearInput() {
  for (const key of Object.keys(input)) input[key] = false;
  document.querySelectorAll(".is-held").forEach((button) => button.classList.remove("is-held"));
}

function handleKey(event, pressed) {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const bindings = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
    " ": "fire",
    Spacebar: "fire",
  };
  const action = bindings[key];
  if (!action) return;
  event.preventDefault();
  if (pressed && action === "fire" && state.phase !== "playing") startMission();
  input[action] = pressed;
}

function bindControls() {
  window.addEventListener("keydown", (event) => handleKey(event, true), { passive: false });
  window.addEventListener("keyup", (event) => handleKey(event, false), { passive: false });
  window.addEventListener("blur", clearInput);

  document.querySelectorAll("[data-action]").forEach((button) => {
    const action = button.dataset.action;
    const release = () => {
      input[action] = false;
      button.classList.remove("is-held");
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (state.phase !== "playing") startMission();
      input[action] = true;
      button.classList.add("is-held");
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", (event) => {
      if (event.buttons === 0) release();
    });
  });

  elements.startButton.addEventListener("click", startMission);
  elements.muteButton.addEventListener("click", () => {
    sound.unlock();
    sound.toggle();
    updateMuteButton();
  });
  elements.scoreForm.addEventListener("submit", handleScoreSubmit);
}

function updateMuteButton() {
  elements.muteButton.classList.toggle("is-muted", sound.muted);
  elements.muteButton.setAttribute("aria-pressed", String(sound.muted));
  elements.muteButton.setAttribute("aria-label", sound.muted ? "Unmute sound" : "Mute sound");
  elements.muteLabel.textContent = sound.muted ? "Sound off" : "Sound on";
  elements.muteIcon.textContent = sound.muted ? "×))" : "))";
}

async function handleScoreSubmit(event) {
  event.preventDefault();
  elements.nameError.textContent = "";
  const result = validatePlayerName(elements.nameInput.value);
  if (!result.valid) {
    elements.nameError.textContent = result.message;
    elements.nameInput.setAttribute("aria-invalid", "true");
    elements.nameInput.focus();
    return;
  }
  elements.nameInput.setAttribute("aria-invalid", "false");
  elements.submitScore.disabled = true;
  elements.nameInput.disabled = true;
  elements.submitScore.textContent = "...";
  elements.submitStatus.className = "submit-status";
  elements.submitStatus.textContent = "Transmitting score...";

  try {
    await leaderboard.submit(result.value, state.score);
    try {
      const rows = await leaderboard.list();
      renderLeaderboard(rows);
      setLeaderboardStatus("Score secured on the pilot board.", "ready");
    } catch {
      setLeaderboardStatus("Score transmitted. Board refresh is delayed.", "ready");
    }
    elements.submitScore.textContent = "SENT";
    elements.submitStatus.textContent = "Score secured. Your signal is on the board.";
  } catch (error) {
    const message = error instanceof LeaderboardError ? error.message : "Could not transmit this score. Try again.";
    elements.submitStatus.textContent = message;
    elements.submitStatus.className = "submit-status is-error";
    elements.submitScore.disabled = false;
    elements.nameInput.disabled = false;
    elements.submitScore.textContent = "SEND";
  }
}

function setLeaderboardStatus(message, kind = "") {
  elements.leaderboardStatus.className = `leaderboard-status${kind ? ` is-${kind}` : ""}`;
  elements.leaderboardStatus.textContent = message;
}

function renderLeaderboard(rows) {
  elements.leaderboard.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "leaderboard-empty";
    empty.textContent = "No verified signals yet. Be the first pilot on the board.";
    elements.leaderboard.append(empty);
    return;
  }

  rows.slice(0, 10).forEach((row, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-row";
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `0${index + 1}`.slice(-2);
    const name = document.createElement("span");
    name.className = "pilot-name";
    name.textContent = row.name;
    const score = document.createElement("span");
    score.className = "pilot-score";
    score.textContent = formatScore(row.score);
    item.append(rank, name, score);
    elements.leaderboard.append(item);
  });
}

async function loadLeaderboard() {
  renderLoadingBoard();
  if (!leaderboard.enabled) {
    renderLeaderboard([]);
    setLeaderboardStatus("Board offline // connect a public key to sync.", "error");
    return;
  }

  try {
    const rows = await leaderboard.list();
    renderLeaderboard(rows);
    setLeaderboardStatus(rows.length ? "Live // top 10" : "Live // no scores yet", "ready");
  } catch (error) {
    renderLeaderboard([]);
    const message = error instanceof LeaderboardError ? error.message : "Could not load pilot data.";
    setLeaderboardStatus(message, "error");
  }
}

function renderLoadingBoard() {
  elements.leaderboard.replaceChildren();
  const loading = document.createElement("li");
  loading.className = "leaderboard-empty";
  loading.textContent = "Synchronizing pilot data...";
  elements.leaderboard.append(loading);
  setLeaderboardStatus("Loading pilot data...", "");
}

function createGradient(stops) {
  const gradient = context.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  return gradient;
}

function drawBackground(time) {
  context.fillStyle = createGradient([
    [0, "#080f2b"],
    [0.48, "#0a1230"],
    [1, "#070a20"],
  ]);
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const nebula = context.createRadialGradient(680, 140, 4, 680, 140, 390);
  nebula.addColorStop(0, "rgba(103, 86, 255, 0.16)");
  nebula.addColorStop(1, "rgba(103, 86, 255, 0)");
  context.fillStyle = nebula;
  context.fillRect(280, 0, 680, 500);

  const pinkCloud = context.createRadialGradient(90, 540, 5, 90, 540, 310);
  pinkCloud.addColorStop(0, "rgba(255, 79, 154, 0.11)");
  pinkCloud.addColorStop(1, "rgba(255, 79, 154, 0)");
  context.fillStyle = pinkCloud;
  context.fillRect(0, 230, 500, 370);

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = "#6079bc";
  context.lineWidth = 1;
  for (let x = -WORLD_HEIGHT; x < WORLD_WIDTH + WORLD_HEIGHT; x += 42) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + WORLD_HEIGHT * 0.28, WORLD_HEIGHT);
    context.stroke();
  }
  context.globalAlpha = 0.1;
  for (let y = 18; y < WORLD_HEIGHT; y += 54) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD_WIDTH, y);
    context.stroke();
  }
  context.restore();

  for (const star of stars) {
    const alpha = 0.2 + (Math.sin(time * (0.7 + star.depth) + star.phase) + 1) * 0.21 * star.depth;
    context.globalAlpha = Math.min(0.9, alpha);
    context.fillStyle = star.depth > 0.68 ? "#b8fff7" : "#7688c4";
    context.beginPath();
    context.arc(star.x, (star.y + time * (7 + star.depth * 11)) % WORLD_HEIGHT, star.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawParticles() {
  context.save();
  context.globalCompositeOperation = "lighter";
  for (const particle of state.particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    context.globalAlpha = alpha;
    context.fillStyle = particle.color;
    context.shadowColor = particle.color;
    context.shadowBlur = 12;
    context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  context.restore();
}

function drawPlayer(time) {
  if (state.invulnerability > 0 && Math.floor(time * 15) % 2 === 0) return;
  const x = state.playerX;
  const y = state.playerY;
  context.save();
  context.translate(x, y);
  context.globalCompositeOperation = "lighter";
  context.shadowColor = "#5ef3e4";
  context.shadowBlur = 26;

  const body = context.createLinearGradient(0, -24, 0, 21);
  body.addColorStop(0, "#f4ffff");
  body.addColorStop(0.34, "#5ef3e4");
  body.addColorStop(1, "#247eae");
  context.fillStyle = body;
  context.beginPath();
  context.moveTo(0, -24);
  context.lineTo(18, 16);
  context.lineTo(5, 11);
  context.lineTo(0, 21);
  context.lineTo(-5, 11);
  context.lineTo(-18, 16);
  context.closePath();
  context.fill();

  context.shadowBlur = 8;
  context.fillStyle = "#ff4f9a";
  context.beginPath();
  context.moveTo(0, -11);
  context.lineTo(6, 5);
  context.lineTo(0, 3);
  context.lineTo(-6, 5);
  context.closePath();
  context.fill();

  context.globalAlpha = 0.95;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(0, -8, 2.2 + Math.sin(time * 12) * 0.5, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawProjectiles() {
  context.save();
  context.globalCompositeOperation = "lighter";
  for (const projectile of state.projectiles) {
    context.strokeStyle = "#5ef3e4";
    context.shadowColor = "#5ef3e4";
    context.shadowBlur = 15;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(projectile.x, projectile.y + 13);
    context.lineTo(projectile.x, projectile.y - 12);
    context.stroke();
  }
  for (const projectile of state.enemyProjectiles) {
    context.fillStyle = "#ffbd62";
    context.shadowColor = "#ffbd62";
    context.shadowBlur = 13;
    context.translate(projectile.x, projectile.y);
    context.rotate(Math.PI / 4);
    context.fillRect(-4.5, -4.5, 9, 9);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
  context.restore();
}

function drawEnemy(enemy, time) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(enemy.type === "zigzag" ? Math.PI / 4 + Math.sin(time * 3 + enemy.age) * 0.22 : Math.sin(enemy.age) * 0.05);
  context.globalCompositeOperation = "lighter";
  context.shadowColor = enemy.color;
  context.shadowBlur = enemy.type === "brute" ? 23 : 16;
  context.strokeStyle = enemy.color;
  context.lineWidth = enemy.type === "brute" ? 2.5 : 2;
  context.fillStyle = enemy.type === "brute" ? "rgba(255, 189, 98, 0.15)" : `${enemy.color}22`;

  if (enemy.type === "scout") {
    context.beginPath();
    context.moveTo(0, -enemy.radius);
    context.lineTo(enemy.radius, 0);
    context.lineTo(enemy.radius * 0.72, enemy.radius * 0.75);
    context.lineTo(-enemy.radius * 0.72, enemy.radius * 0.75);
    context.lineTo(-enemy.radius, 0);
    context.closePath();
    context.fill();
    context.stroke();
  } else if (enemy.type === "zigzag") {
    context.beginPath();
    context.moveTo(0, -enemy.radius);
    context.lineTo(enemy.radius * 0.66, 0);
    context.lineTo(0, enemy.radius);
    context.lineTo(-enemy.radius * 0.66, 0);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(-enemy.radius * 0.82, 0);
    context.lineTo(enemy.radius * 0.82, 0);
    context.stroke();
  } else {
    context.beginPath();
    context.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(0, 0, enemy.radius * 0.47, 0, Math.PI * 2);
    context.stroke();
  }

  context.shadowBlur = 7;
  context.fillStyle = enemy.color;
  context.beginPath();
  context.arc(0, 0, enemy.type === "brute" ? 4 : 3, 0, Math.PI * 2);
  context.fill();

  if (enemy.maxHp > 1) {
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 0.8;
    context.fillStyle = "rgba(7, 11, 27, 0.8)";
    context.fillRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2, 3);
    context.fillStyle = enemy.color;
    context.fillRect(-enemy.radius, enemy.radius + 8, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 3);
  }
  context.restore();
}

function render(time) {
  if (!context) return;
  drawBackground(time);
  const shake = state.shake * 18;
  context.save();
  if (shake > 0) context.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawParticles();
  drawProjectiles();
  for (const enemy of state.enemies) drawEnemy(enemy, time);
  drawPlayer(time);
  context.restore();

  if (state.damageFlash > 0) {
    context.globalAlpha = Math.min(0.28, state.damageFlash * 0.65);
    context.fillStyle = "#ff4f9a";
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    context.globalAlpha = 1;
  }
}

function tick(now) {
  const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  frameTime += delta;

  if (state.phase === "playing") {
    stepGame(state, input, delta);
    if (state.score > previousScore) sound.play("hit");
    if (state.lives < previousLives) sound.play("damage");
    if (state.phase === "gameover" && previousPhase !== "gameover") {
      sound.play("gameover");
      showGameOver();
    }
  }

  if (state.phase !== previousPhase) syncPhase();
  if (state.score !== previousScore || state.lives !== previousLives || frameTime > 0.15) {
    updateHud();
    frameTime = 0;
  }

  previousScore = state.score;
  previousLives = state.lives;
  previousPhase = state.phase;
  render(now / 1000);
  window.requestAnimationFrame(tick);
}

class SoundSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = readStoredMute();
  }

  unlock() {
    if (this.context || this.muted) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = 0.08;
    this.master.connect(this.context.destination);
    if (this.context.state === "suspended") this.context.resume();
  }

  toggle() {
    this.muted = !this.muted;
    writeStoredMute(this.muted);
    if (!this.muted) this.unlock();
  }

  play(kind) {
    if (this.muted || !this.context || !this.master) return;
    const settings = {
      launch: { frequency: 290, end: 620, duration: 0.2, type: "sine", gain: 0.8 },
      hit: { frequency: 720, end: 510, duration: 0.06, type: "square", gain: 0.35 },
      damage: { frequency: 170, end: 85, duration: 0.28, type: "sawtooth", gain: 0.8 },
      gameover: { frequency: 280, end: 58, duration: 0.55, type: "triangle", gain: 0.8 },
    }[kind];
    if (!settings) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(settings.end, now + settings.duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.11 * settings.gain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + settings.duration + 0.02);
  }
}

const sound = new SoundSystem();

function readStoredMute() {
  try {
    return window.localStorage.getItem("neon-barrage-muted") === "true";
  } catch {
    return false;
  }
}

function writeStoredMute(value) {
  try {
    window.localStorage.setItem("neon-barrage-muted", String(value));
  } catch {
    // A private browsing context may refuse storage; sound still works in memory.
  }
}

window.__NEON_BARRAGE__ = {
  getState: () => getStateSnapshot(state),
  endGameForTest: (score) => finishMissionForTest(score),
};

bindControls();
updateMuteButton();
syncPhase();
loadLeaderboard();
window.requestAnimationFrame(tick);
