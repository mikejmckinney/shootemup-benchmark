export const WORLD = Object.freeze({ width: 960, height: 600 });

const PLAYER_SPEED = 365;
const MAX_DT = 0.05;

export function createGame(random = Math.random) {
  return {
    phase: "ready",
    score: 0,
    lives: 3,
    player: { x: WORLD.width / 2, y: WORLD.height - 72, radius: 16 },
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    particles: [],
    elapsed: 0,
    wave: 1,
    spawnTimer: 0.3,
    fireTimer: 0,
    invulnerable: 0,
    random
  };
}

export function startGame(state) {
  state.phase = "playing";
  state.score = 0;
  state.lives = 3;
  state.player.x = WORLD.width / 2;
  state.player.y = WORLD.height - 72;
  state.enemies.length = 0;
  state.projectiles.length = 0;
  state.enemyProjectiles.length = 0;
  state.particles.length = 0;
  state.elapsed = 0;
  state.wave = 1;
  state.spawnTimer = 0.3;
  state.fireTimer = 0;
  state.invulnerable = 0;
  return state;
}

export function forceGameOver(state, score) {
  if (!Number.isInteger(score) || score < 0) return false;
  state.phase = "gameover";
  state.score = score;
  state.lives = 0;
  state.enemies.length = 0;
  state.projectiles.length = 0;
  state.enemyProjectiles.length = 0;
  return true;
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function addBurst(state, x, y, color, amount = 10) {
  for (let index = 0; index < amount; index += 1) {
    const angle = (Math.PI * 2 * index) / amount;
    const speed = 45 + state.random() * 150;
    state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.45 + state.random() * 0.35, maxLife: 0.8, color });
  }
}

function spawnEnemy(state) {
  const heavy = state.random() > 0.78;
  state.enemies.push({
    x: 48 + state.random() * (WORLD.width - 96),
    y: -32,
    radius: heavy ? 22 : 15,
    hp: heavy ? 2 : 1,
    maxHp: heavy ? 2 : 1,
    speed: (heavy ? 74 : 105) + state.wave * (heavy ? 7 : 10),
    drift: (state.random() - 0.5) * (heavy ? 65 : 120),
    phase: state.random() * Math.PI * 2,
    heavy
  });
}

function loseLife(state) {
  if (state.invulnerable > 0 || state.phase !== "playing") return;
  state.lives -= 1;
  state.invulnerable = 1.35;
  addBurst(state, state.player.x, state.player.y, "#ff4f9a", 18);
  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = "gameover";
  }
}

export function stepGame(state, input = {}, deltaSeconds = 0.016) {
  if (state.phase !== "playing") return state;
  const dt = Math.min(Math.max(deltaSeconds, 0), MAX_DT);
  const { left = false, right = false, up = false, down = false, fire = false } = input;
  state.elapsed += dt;
  state.wave = 1 + Math.floor(state.elapsed / 15);
  state.invulnerable = Math.max(0, state.invulnerable - dt);

  const horizontal = Number(right) - Number(left);
  const vertical = Number(down) - Number(up);
  const vectorLength = Math.hypot(horizontal, vertical) || 1;
  state.player.x += (horizontal / vectorLength) * PLAYER_SPEED * dt;
  state.player.y += (vertical / vectorLength) * PLAYER_SPEED * dt;
  state.player.x = Math.max(28, Math.min(WORLD.width - 28, state.player.x));
  state.player.y = Math.max(35, Math.min(WORLD.height - 34, state.player.y));

  state.fireTimer -= dt;
  if (fire && state.fireTimer <= 0) {
    state.projectiles.push({ x: state.player.x, y: state.player.y - 20, vx: 0, vy: -650, radius: 4 });
    state.fireTimer = 0.16;
  }

  state.spawnTimer -= dt;
  const spawnInterval = Math.max(0.25, 0.82 - state.wave * 0.06);
  if (state.spawnTimer <= 0) {
    spawnEnemy(state);
    state.spawnTimer = spawnInterval;
  }

  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
  }
  state.projectiles = state.projectiles.filter((projectile) => projectile.y > -25 && projectile.y < WORLD.height + 25);

  for (const enemy of state.enemies) {
    enemy.y += enemy.speed * dt;
    enemy.x += Math.sin(state.elapsed * 2.2 + enemy.phase) * enemy.drift * dt;
    enemy.x = Math.max(enemy.radius + 12, Math.min(WORLD.width - enemy.radius - 12, enemy.x));
    enemy.fireTimer = (enemy.fireTimer ?? (1.2 + state.random() * 1.6)) - dt;
    if (enemy.fireTimer <= 0 && enemy.y > 20 && enemy.y < WORLD.height * 0.72) {
      state.enemyProjectiles.push({ x: enemy.x, y: enemy.y + enemy.radius, vx: (state.player.x - enemy.x) * 0.12, vy: 210 + state.wave * 12, radius: 5 });
      enemy.fireTimer = Math.max(0.75, 2.1 - state.wave * 0.1);
    }
  }

  for (const projectile of state.enemyProjectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
  }
  state.enemyProjectiles = state.enemyProjectiles.filter((projectile) => projectile.y < WORLD.height + 30);

  for (let projectileIndex = state.projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
    const projectile = state.projectiles[projectileIndex];
    for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = state.enemies[enemyIndex];
      if (distanceSquared(projectile, enemy) > (projectile.radius + enemy.radius) ** 2) continue;
      state.projectiles.splice(projectileIndex, 1);
      enemy.hp -= 1;
      addBurst(state, projectile.x, projectile.y, enemy.heavy ? "#a786ff" : "#54f6dc", enemy.hp > 0 ? 4 : 11);
      if (enemy.hp <= 0) {
        state.enemies.splice(enemyIndex, 1);
        state.score += enemy.heavy ? 250 : 100;
      }
      break;
    }
  }

  for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
    const enemy = state.enemies[enemyIndex];
    if (enemy.y > WORLD.height + enemy.radius) {
      state.enemies.splice(enemyIndex, 1);
      continue;
    }
    if (distanceSquared(state.player, enemy) <= (state.player.radius + enemy.radius) ** 2) {
      state.enemies.splice(enemyIndex, 1);
      loseLife(state);
    }
  }

  for (let projectileIndex = state.enemyProjectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
    const projectile = state.enemyProjectiles[projectileIndex];
    if (distanceSquared(state.player, projectile) <= (state.player.radius + projectile.radius) ** 2) {
      state.enemyProjectiles.splice(projectileIndex, 1);
      loseLife(state);
    }
  }

  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
  return state;
}

export function getPublicState(state) {
  return {
    phase: state.phase,
    score: state.score,
    lives: state.lives,
    playerX: Math.round(state.player.x),
    playerY: Math.round(state.player.y),
    enemyCount: state.enemies.length,
    projectileCount: state.projectiles.length
  };
}
