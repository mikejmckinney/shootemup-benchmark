/**
 * Neon Barrage's small, deterministic game model.
 *
 * The renderer owns pixels and the DOM; this module owns game rules. Keeping
 * the rules here makes the arcade loop easy to exercise without a browser.
 */

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 600;

const MAX_FRAME_SECONDS = 0.05;
const PLAYER_RADIUS = 17;
const STARTING_LIVES = 3;

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createGameState(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
  return {
    phase: "idle",
    width,
    height,
    score: 0,
    finalScore: null,
    lives: STARTING_LIVES,
    level: 1,
    elapsed: 0,
    playerX: width / 2,
    playerY: height - 76,
    playerRadius: PLAYER_RADIUS,
    playerSpeed: 360,
    fireCooldown: 0,
    invulnerability: 0,
    spawnTimer: 0.6,
    nextId: 1,
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    particles: [],
    damageFlash: 0,
    shake: 0,
  };
}

export function beginGame(state) {
  const fresh = createGameState(state.width, state.height);
  Object.assign(state, fresh, { phase: "playing", spawnTimer: 0.15 });
  return state;
}

export function endGame(state, score = state.score) {
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new TypeError("Game-over score must be a non-negative safe integer");
  }

  state.phase = "gameover";
  state.score = score;
  state.finalScore = score;
  state.lives = 0;
  state.enemies.length = 0;
  state.projectiles.length = 0;
  state.enemyProjectiles.length = 0;
  state.fireCooldown = 0;
  return state;
}

export function getDifficulty(state) {
  const level = 1 + Math.floor(state.elapsed / 22);
  return {
    level,
    spawnInterval: Math.max(0.28, 0.96 - (level - 1) * 0.075),
    enemySpeedMultiplier: 1 + (level - 1) * 0.1,
    fireRate: 0.14 + (level - 1) * 0.028,
  };
}

export function getInput(input = {}) {
  return {
    up: Boolean(input.up),
    down: Boolean(input.down),
    left: Boolean(input.left),
    right: Boolean(input.right),
    fire: Boolean(input.fire),
  };
}

function distanceSquared(aX, aY, bX, bY) {
  const x = aX - bX;
  const y = aY - bY;
  return x * x + y * y;
}

function overlaps(a, b) {
  const radius = a.radius + b.radius;
  return distanceSquared(a.x, a.y, b.x, b.y) <= radius * radius;
}

function nextId(state, prefix) {
  const id = `${prefix}-${state.nextId}`;
  state.nextId += 1;
  return id;
}

function addBurst(state, x, y, color, random, count = 8, speed = 105) {
  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const velocity = speed * (0.35 + random() * 0.8);
    const life = 0.3 + random() * 0.45;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      size: 1.5 + random() * 3.5,
      color,
      life,
      maxLife: life,
    });
  }
}

function spawnEnemy(state, random, difficulty) {
  const roll = random();
  let type = "scout";
  if (roll > 0.82) type = "brute";
  else if (roll > 0.55) type = "zigzag";

  const definitions = {
    scout: {
      radius: 15,
      hp: 1,
      speed: 78,
      points: 25,
      color: "#ff4f9a",
      drift: 24,
      wobble: 2.2,
    },
    zigzag: {
      radius: 17,
      hp: 1,
      speed: 61,
      points: 35,
      color: "#a48cff",
      drift: 92,
      wobble: 3.4,
    },
    brute: {
      radius: 23,
      hp: 2,
      speed: 47,
      points: 80,
      color: "#ffbd62",
      drift: 18,
      wobble: 1.6,
    },
  };
  const definition = definitions[type];
  const margin = definition.radius + 8;

  state.enemies.push({
    id: nextId(state, "enemy"),
    type,
    x: margin + random() * Math.max(1, state.width - margin * 2),
    y: -definition.radius - 12,
    radius: definition.radius,
    hp: definition.hp,
    maxHp: definition.hp,
    speed: definition.speed * difficulty.enemySpeedMultiplier * (0.9 + random() * 0.25),
    points: definition.points,
    color: definition.color,
    drift: definition.drift,
    wobble: definition.wobble,
    age: 0,
    fireDelay: 0.7 + random() * 1.8,
  });
}

function loseLife(state, random) {
  if (state.invulnerability > 0 || state.phase !== "playing") return false;

  state.lives = Math.max(0, state.lives - 1);
  state.invulnerability = 1.25;
  state.damageFlash = 0.38;
  state.shake = 0.32;
  addBurst(state, state.playerX, state.playerY, "#ff4f9a", random, 16, 170);
  if (state.lives === 0) endGame(state, state.score);
  return true;
}

function updateParticles(state, dt) {
  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const particle = state.particles[index];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    if (particle.life <= 0) state.particles.splice(index, 1);
  }
}

function updatePlayer(state, input, dt) {
  let directionX = Number(input.right) - Number(input.left);
  let directionY = Number(input.down) - Number(input.up);
  const length = Math.hypot(directionX, directionY);
  if (length > 0) {
    directionX /= length;
    directionY /= length;
  }

  state.playerX = clamp(
    state.playerX + directionX * state.playerSpeed * dt,
    state.playerRadius + 12,
    state.width - state.playerRadius - 12,
  );
  state.playerY = clamp(
    state.playerY + directionY * state.playerSpeed * dt,
    state.playerRadius + 16,
    state.height - state.playerRadius - 18,
  );
}

function updateProjectiles(state, input, dt, random, difficulty) {
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  if (input.fire && state.fireCooldown <= 0) {
    state.projectiles.push({
      id: nextId(state, "shot"),
      x: state.playerX,
      y: state.playerY - state.playerRadius - 5,
      vx: 0,
      vy: -650,
      radius: 5,
      life: 2,
    });
    state.fireCooldown = difficulty.fireRate;
    addBurst(state, state.playerX, state.playerY - 18, "#5ef3e4", random, 3, 42);
  }

  for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = state.projectiles[index];
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    if (projectile.y < -30 || projectile.life <= 0) state.projectiles.splice(index, 1);
  }

  for (let index = state.enemyProjectiles.length - 1; index >= 0; index -= 1) {
    const projectile = state.enemyProjectiles[index];
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    if (projectile.y > state.height + 34 || projectile.life <= 0) {
      state.enemyProjectiles.splice(index, 1);
    }
  }
}

function updateEnemies(state, dt, random, difficulty) {
  for (const enemy of state.enemies) {
    enemy.age += dt;
    enemy.x += Math.sin(enemy.age * enemy.wobble) * enemy.drift * dt;
    enemy.x = clamp(enemy.x, enemy.radius + 8, state.width - enemy.radius - 8);
    enemy.y += enemy.speed * dt;
    enemy.fireDelay -= dt;

    if (enemy.fireDelay <= 0 && enemy.y > 20) {
      state.enemyProjectiles.push({
        id: nextId(state, "enemy-shot"),
        x: enemy.x,
        y: enemy.y + enemy.radius,
        vx: (state.playerX - enemy.x) * 0.16,
        vy: 184 + difficulty.level * 10,
        radius: 6,
        life: 4,
      });
      enemy.fireDelay = Math.max(0.55, 1.8 - difficulty.level * 0.1) + random() * 1.3;
    }
  }
}

function resolveCollisions(state, random) {
  for (let projectileIndex = state.projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
    const projectile = state.projectiles[projectileIndex];
    let hit = false;
    for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = state.enemies[enemyIndex];
      if (!overlaps(projectile, enemy)) continue;

      hit = true;
      enemy.hp -= 1;
      addBurst(state, projectile.x, projectile.y, enemy.color, random, enemy.hp > 0 ? 4 : 11, enemy.hp > 0 ? 70 : 125);
      if (enemy.hp <= 0) {
        state.score += enemy.points;
        state.shake = Math.max(state.shake, enemy.type === "brute" ? 0.16 : 0.06);
        state.enemies.splice(enemyIndex, 1);
      }
      break;
    }
    if (hit) state.projectiles.splice(projectileIndex, 1);
  }

  const player = { x: state.playerX, y: state.playerY, radius: state.playerRadius };
  for (let index = state.enemyProjectiles.length - 1; index >= 0; index -= 1) {
    if (!overlaps(state.enemyProjectiles[index], player)) continue;
    state.enemyProjectiles.splice(index, 1);
    loseLife(state, random);
  }

  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    if (overlaps(enemy, player)) {
      state.enemies.splice(index, 1);
      loseLife(state, random);
      if (state.phase !== "playing") break;
      continue;
    }

    if (enemy.y > state.height + enemy.radius + 12) {
      state.enemies.splice(index, 1);
      loseLife(state, random);
      if (state.phase !== "playing") break;
    }
  }
}

export function stepGame(state, rawInput, rawDt, random = Math.random) {
  if (state.phase !== "playing") return state;
  const dt = clamp(Number(rawDt) || 0, 0, MAX_FRAME_SECONDS);
  const input = getInput(rawInput);
  const rng = typeof random === "function" ? random : Math.random;

  state.elapsed += dt;
  const difficulty = getDifficulty(state);
  state.level = difficulty.level;
  state.invulnerability = Math.max(0, state.invulnerability - dt);
  state.damageFlash = Math.max(0, state.damageFlash - dt);
  state.shake = Math.max(0, state.shake - dt);

  updatePlayer(state, input, dt);
  updateProjectiles(state, input, dt, rng, difficulty);

  state.spawnTimer -= dt;
  let spawnGuard = 0;
  while (state.spawnTimer <= 0 && spawnGuard < 4) {
    spawnEnemy(state, rng, difficulty);
    state.spawnTimer += difficulty.spawnInterval;
    spawnGuard += 1;
  }

  updateEnemies(state, dt, rng, difficulty);
  resolveCollisions(state, rng);
  updateParticles(state, dt);
  return state;
}

export function getStateSnapshot(state) {
  return {
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    playerX: Math.round(state.playerX * 100) / 100,
    playerY: Math.round(state.playerY * 100) / 100,
    enemyCount: state.enemies.length,
    projectileCount: state.projectiles.length,
  };
}

