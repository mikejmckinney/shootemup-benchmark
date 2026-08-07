export const MAX_SCORE = 999_999_999;
export const PLAYER_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,15}$/;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizePlayerName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function validatePlayerName(value) {
  const normalized = normalizePlayerName(value);
  if (!normalized) return { valid: false, value: normalized, message: "Enter a callsign." };
  if (normalized.length > 16) return { valid: false, value: normalized, message: "Use 1–16 characters." };
  if (!PLAYER_NAME_PATTERN.test(normalized)) {
    return { valid: false, value: normalized, message: "Use letters, numbers, spaces, . _ or -." };
  }
  return { valid: true, value: normalized, message: "" };
}

export function validateScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SCORE;
}

export function difficultyFor(elapsedSeconds, score = 0) {
  return clamp(1 + Math.max(0, elapsedSeconds) / 18 + Math.max(0, score) / 1800, 1, 8);
}

export function createGameState(width = 900, height = 560) {
  return {
    phase: "ready",
    width,
    height,
    score: 0,
    lives: 3,
    elapsed: 0,
    level: 1,
    difficulty: 1,
    spawnTimer: 0.45,
    fireCooldown: 0,
    invulnerable: 0,
    player: { x: width / 2, y: height - 58 },
    enemies: [],
    projectiles: [],
    events: []
  };
}

export function beginGame(state, width = state.width, height = state.height) {
  const fresh = createGameState(width, height);
  Object.assign(state, fresh);
  state.phase = "playing";
  state.events.push({ type: "start" });
  return state;
}

export function endGame(state, forcedScore = state.score) {
  if (validateScore(forcedScore)) state.score = forcedScore;
  state.phase = "gameover";
  state.lives = 0;
  state.events.push({ type: "gameover", score: state.score });
  return state;
}

export function spawnEnemy(state, rng = Math.random) {
  const roll = rng();
  const kind = roll < 0.2 ? "heavy" : roll > 0.78 ? "scout" : "drone";
  const radius = kind === "heavy" ? 23 : kind === "scout" ? 13 : 18;
  const maxX = Math.max(48, state.width - 48);
  const x = 48 + rng() * Math.max(1, maxX - 48);
  const enemy = {
    kind,
    x,
    baseX: x,
    y: -radius - 12,
    radius,
    speed: (kind === "heavy" ? 32 : kind === "scout" ? 66 : 46) * (0.9 + rng() * 0.25),
    wave: rng() * Math.PI * 2,
    drift: kind === "heavy" ? 20 : kind === "scout" ? 44 : 30,
    color: kind === "heavy" ? "#ff4f9a" : kind === "scout" ? "#ffc857" : "#b883ff"
  };
  state.enemies.push(enemy);
  state.events.push({ type: "spawn", x: enemy.x, y: enemy.y, color: enemy.color });
  return enemy;
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function stepGame(state, input = {}, rawDt = 1 / 60, rng = Math.random) {
  if (state.phase !== "playing") return state;

  const dt = clamp(Number.isFinite(rawDt) ? rawDt : 1 / 60, 0, 0.05);
  state.events = [];
  state.elapsed += dt;
  state.difficulty = difficultyFor(state.elapsed, state.score);
  state.level = Math.min(9, 1 + Math.floor((state.difficulty - 1) * 1.2));
  state.invulnerable = Math.max(0, state.invulnerable - dt);
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);

  const horizontal = Number(Boolean(input.right)) - Number(Boolean(input.left));
  const vertical = Number(Boolean(input.down)) - Number(Boolean(input.up));
  const speed = 315;
  state.player.x = clamp(state.player.x + horizontal * speed * dt, 28, state.width - 28);
  state.player.y = clamp(state.player.y + vertical * speed * dt, 34, state.height - 28);

  if (input.fire && state.fireCooldown <= 0 && state.projectiles.length < 24) {
    state.projectiles.push({ x: state.player.x, y: state.player.y - 24, vy: -570 });
    state.fireCooldown = Math.max(0.1, 0.21 - state.difficulty * 0.012);
    state.events.push({ type: "fire", x: state.player.x, y: state.player.y - 24 });
  }

  state.spawnTimer -= dt;
  const spawnInterval = Math.max(0.28, 0.88 - state.difficulty * 0.065);
  if (state.spawnTimer <= 0) {
    spawnEnemy(state, rng);
    state.spawnTimer += spawnInterval;
  }

  for (const projectile of state.projectiles) projectile.y += projectile.vy * dt;
  state.projectiles = state.projectiles.filter((projectile) => projectile.y > -30);

  for (const enemy of state.enemies) {
    enemy.y += enemy.speed * (0.92 + state.difficulty * 0.1) * dt;
    enemy.x = clamp(enemy.baseX + Math.sin(state.elapsed * 1.35 + enemy.wave) * enemy.drift, enemy.radius + 8, state.width - enemy.radius - 8);
  }

  for (const projectile of state.projectiles) {
    const hit = state.enemies.find((enemy) => !enemy.destroyed && distanceSquared(projectile, enemy) <= (enemy.radius + 6) ** 2);
    if (!hit) continue;
    hit.destroyed = true;
    projectile.destroyed = true;
    const points = hit.kind === "heavy" ? 35 : hit.kind === "scout" ? 20 : 15;
    state.score = Math.min(MAX_SCORE, state.score + points);
    state.events.push({ type: "hit", x: hit.x, y: hit.y, color: hit.color, points });
  }
  state.projectiles = state.projectiles.filter((projectile) => !projectile.destroyed);
  state.enemies = state.enemies.filter((enemy) => !enemy.destroyed);

  let lostLife = false;
  for (const enemy of state.enemies) {
    if (enemy.y - enemy.radius > state.height) {
      enemy.destroyed = true;
      lostLife = true;
    } else if (state.invulnerable <= 0 && distanceSquared(enemy, state.player) <= (enemy.radius + 18) ** 2) {
      enemy.destroyed = true;
      lostLife = true;
      state.invulnerable = 1.15;
      state.events.push({ type: "damage", x: state.player.x, y: state.player.y });
    }
    if (lostLife) break;
  }
  if (lostLife) {
    state.lives = Math.max(0, state.lives - 1);
    state.events.push({ type: "life-lost", lives: state.lives });
  }
  state.enemies = state.enemies.filter((enemy) => !enemy.destroyed);

  if (state.lives <= 0) endGame(state, state.score);
  return state;
}
