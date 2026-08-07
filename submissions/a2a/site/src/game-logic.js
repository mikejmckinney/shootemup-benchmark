export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 600;
export const MAX_SCORE = 2_147_483_647;

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function rectanglesOverlap(first, second, padding = 0) {
  return (
    first.x - padding < second.x + second.width &&
    first.x + first.width + padding > second.x &&
    first.y - padding < second.y + second.height &&
    first.y + first.height + padding > second.y
  );
}

export function getThreatLevel(elapsedSeconds) {
  return 1 + Math.floor(Math.max(0, elapsedSeconds) / 20);
}

export function createInitialState() {
  return {
    phase: 'idle',
    score: 0,
    lives: 3,
    elapsed: 0,
    level: 1,
    spawnTimer: 0.45,
    fireCooldown: 0,
    invulnerable: 0,
    player: { x: WORLD_WIDTH / 2 - 18, y: WORLD_HEIGHT - 82, width: 36, height: 42 },
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    particles: []
  };
}

export function createEnemy({ x, y = -42, type = 'drone', level = 1 } = {}) {
  const isTank = type === 'tank';
  const isWisp = type === 'wisp';
  return {
    x,
    y,
    width: isTank ? 48 : isWisp ? 30 : 38,
    height: isTank ? 42 : isWisp ? 34 : 36,
    type,
    hp: isTank ? 2 + Math.floor(level / 3) : 1,
    maxHp: isTank ? 2 + Math.floor(level / 3) : 1,
    speed: (isTank ? 70 : isWisp ? 142 : 92) + level * (isWisp ? 7 : 5),
    phase: x * 0.017,
    fireTimer: isWisp ? 1.35 : 2.1,
    age: 0,
    points: isTank ? 240 : isWisp ? 180 : 100
  };
}

function spawnFromRng(state, rng) {
  const level = state.level;
  const roll = rng();
  const type = roll > 0.82 && level >= 2 ? 'tank' : roll > 0.58 ? 'wisp' : 'drone';
  const width = type === 'tank' ? 48 : type === 'wisp' ? 30 : 38;
  const x = 24 + rng() * (WORLD_WIDTH - width - 48);
  return createEnemy({ x, type, level });
}

function damagePlayer(state, events, reason) {
  if (state.invulnerable > 0 || state.phase !== 'running') return false;
  state.lives = Math.max(0, state.lives - 1);
  state.invulnerable = 1.05;
  events.push({ type: 'player-hit', reason, x: state.player.x + state.player.width / 2, y: state.player.y + state.player.height / 2 });
  if (state.lives === 0) {
    state.phase = 'game-over';
    events.push({ type: 'game-over', score: state.score });
  }
  return true;
}

export function stepGameState(state, input = {}, deltaSeconds = 0, rng = Math.random) {
  const events = [];
  if (state.phase !== 'running') return events;

  const dt = clamp(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0, 0.05);
  state.elapsed += dt;
  state.level = getThreatLevel(state.elapsed);
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  state.invulnerable = Math.max(0, state.invulnerable - dt);

  const horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const vertical = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(horizontal, vertical) || 1;
  const playerSpeed = 335;
  state.player.x = clamp(state.player.x + (horizontal / length) * playerSpeed * dt, 16, WORLD_WIDTH - state.player.width - 16);
  state.player.y = clamp(state.player.y + (vertical / length) * playerSpeed * dt, 24, WORLD_HEIGHT - state.player.height - 20);

  if (input.fire && state.fireCooldown <= 0) {
    state.projectiles.push({
      x: state.player.x + state.player.width / 2 - 3,
      y: state.player.y - 22,
      width: 6,
      height: 26,
      speed: 570
    });
    state.fireCooldown = 0.16;
    events.push({ type: 'fire', x: state.player.x + state.player.width / 2, y: state.player.y });
  }

  const interval = Math.max(0.28, 1.02 - state.elapsed * 0.009);
  state.spawnTimer -= dt;
  while (state.spawnTimer <= 0 && state.enemies.length < 26) {
    state.enemies.push(spawnFromRng(state, rng));
    state.spawnTimer += interval;
  }

  for (const projectile of state.projectiles) projectile.y -= projectile.speed * dt;
  state.projectiles = state.projectiles.filter((projectile) => projectile.y + projectile.height > -16);

  for (const projectile of state.enemyProjectiles) projectile.y += projectile.speed * dt;
  state.enemyProjectiles = state.enemyProjectiles.filter((projectile) => projectile.y < WORLD_HEIGHT + 24);

  for (const enemy of state.enemies) {
    enemy.age += dt;
    enemy.y += enemy.speed * dt;
    if (enemy.type === 'wisp') enemy.x += Math.sin(enemy.age * 4.2 + enemy.phase) * 58 * dt;
    if (enemy.type === 'tank') enemy.x += Math.sin(enemy.age * 1.7 + enemy.phase) * 18 * dt;
    enemy.x = clamp(enemy.x, 10, WORLD_WIDTH - enemy.width - 10);
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0 && enemy.y > 20 && enemy.y < WORLD_HEIGHT * 0.7) {
      state.enemyProjectiles.push({
        x: enemy.x + enemy.width / 2 - 3,
        y: enemy.y + enemy.height - 2,
        width: 6,
        height: 15,
        speed: 220 + state.level * 11
      });
      enemy.fireTimer = Math.max(0.7, (enemy.type === 'tank' ? 2.2 : 1.6) - state.elapsed * 0.004) + rng() * 0.8;
      events.push({ type: 'enemy-fire', x: enemy.x + enemy.width / 2, y: enemy.y + enemy.height });
    }
  }

  // Resolve player shots from newest to oldest so each projectile can score once.
  for (let projectileIndex = state.projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
    const projectile = state.projectiles[projectileIndex];
    let hit = false;
    for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = state.enemies[enemyIndex];
      if (!rectanglesOverlap(projectile, enemy, 3)) continue;
      hit = true;
      enemy.hp -= 1;
      events.push({ type: 'enemy-hit', x: enemy.x + enemy.width / 2, y: enemy.y + enemy.height / 2, destroyed: enemy.hp <= 0 });
      if (enemy.hp <= 0) {
        state.score = clamp(state.score + enemy.points, 0, MAX_SCORE);
        state.enemies.splice(enemyIndex, 1);
        events.push({ type: 'enemy-destroyed', x: enemy.x + enemy.width / 2, y: enemy.y + enemy.height / 2, points: enemy.points });
      }
      break;
    }
    if (hit) state.projectiles.splice(projectileIndex, 1);
  }

  for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
    const enemy = state.enemies[enemyIndex];
    if (enemy.y > WORLD_HEIGHT + 18) {
      state.enemies.splice(enemyIndex, 1);
      damagePlayer(state, events, 'breach');
    } else if (rectanglesOverlap(enemy, state.player, -4)) {
      state.enemies.splice(enemyIndex, 1);
      damagePlayer(state, events, 'impact');
    }
  }

  for (let projectileIndex = state.enemyProjectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
    if (!rectanglesOverlap(state.enemyProjectiles[projectileIndex], state.player, 1)) continue;
    state.enemyProjectiles.splice(projectileIndex, 1);
    damagePlayer(state, events, 'plasma');
  }

  return events;
}
