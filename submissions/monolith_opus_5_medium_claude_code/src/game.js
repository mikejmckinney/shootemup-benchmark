// Pure gameplay simulation for Neon Barrage.
// No DOM, no canvas, no audio: everything here is deterministic given a seed,
// which is what the unit tests exercise.

export const WORLD = { width: 480, height: 720 };

export const PHASE = {
  READY: 'ready',
  PLAYING: 'playing',
  GAME_OVER: 'gameover',
};

const PLAYER = {
  width: 30,
  height: 26,
  speed: 300,
  fireInterval: 0.18,
  spawnY: WORLD.height - 70,
  invulnAfterHit: 1.6,
};

const BULLET = { width: 3, height: 14, speed: 620 };
const ENEMY_BULLET = { width: 4, height: 10, speed: 210 };

const ENEMY_KINDS = {
  drone: { width: 28, height: 22, hp: 1, points: 100, speed: 46, fireChance: 0.16, color: '#38f2ff' },
  weaver: { width: 30, height: 24, hp: 2, points: 220, speed: 58, fireChance: 0.3, color: '#ff4fd8' },
  bruiser: { width: 40, height: 34, hp: 5, points: 550, speed: 32, fireChance: 0.45, color: '#ffd166' },
};

// Small deterministic PRNG so tests can replay a run.
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function overlaps(a, b) {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w &&
    Math.abs(a.y - b.y) * 2 < a.h + b.h
  );
}

export function createGame({ seed = Date.now(), onEvent = (/** @type {any} */ _event) => {} } = {}) {
  const rng = makeRng(seed);

  const state = {
    phase: PHASE.READY,
    score: 0,
    lives: 3,
    wave: 1,
    combo: 0,
    bestCombo: 0,
    time: 0,
    shake: 0,
    player: { x: WORLD.width / 2, y: PLAYER.spawnY, w: PLAYER.width, h: PLAYER.height, invuln: 0, cooldown: 0 },
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    stars: Array.from({ length: 70 }, () => ({
      x: rng() * WORLD.width,
      y: rng() * WORLD.height,
      z: 0.3 + rng() * 0.9,
    })),
    input: { left: false, right: false, up: false, down: false, fire: false },
    spawnTimer: 0,
    waveTimer: 0,
    floatingTexts: [],
  };

  function reset() {
    state.phase = PHASE.READY;
    state.score = 0;
    state.lives = 3;
    state.wave = 1;
    state.combo = 0;
    state.bestCombo = 0;
    state.time = 0;
    state.shake = 0;
    state.player.x = WORLD.width / 2;
    state.player.y = PLAYER.spawnY;
    state.player.invuln = 0;
    state.player.cooldown = 0;
    state.bullets.length = 0;
    state.enemyBullets.length = 0;
    state.enemies.length = 0;
    state.particles.length = 0;
    state.floatingTexts.length = 0;
    state.spawnTimer = 0.5;
    state.waveTimer = 0;
    for (const k of Object.keys(state.input)) state.input[k] = false;
  }

  function start() {
    reset();
    state.phase = PHASE.PLAYING;
    onEvent({ type: 'start' });
  }

  function endGame(forcedScore) {
    if (typeof forcedScore === 'number') {
      state.score = Math.max(0, Math.floor(forcedScore));
    }
    state.phase = PHASE.GAME_OVER;
    state.lives = 0;
    onEvent({ type: 'gameover', score: state.score });
  }

  function burst(x, y, color, count, power = 1) {
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const speed = (40 + rng() * 200) * power;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + rng() * 0.5,
        maxLife: 0.85,
        color,
        size: 1.5 + rng() * 2.5,
      });
    }
  }

  function float(x, y, text) {
    state.floatingTexts.push({ x, y, text, life: 0.9 });
  }

  // Difficulty ramps with wave: faster spawns, tougher mixes, quicker descent.
  function difficulty() {
    const w = state.wave;
    return {
      spawnInterval: Math.max(0.32, 1.35 - w * 0.085),
      speedScale: 1 + (w - 1) * 0.09,
      fireScale: 1 + (w - 1) * 0.12,
      bruiserChance: w >= 4 ? Math.min(0.22, 0.04 * (w - 3)) : 0,
      weaverChance: Math.min(0.5, 0.1 + w * 0.05),
    };
  }

  function spawnEnemy() {
    const d = difficulty();
    const roll = rng();
    let kindName = 'drone';
    if (roll < d.bruiserChance) kindName = 'bruiser';
    else if (roll < d.bruiserChance + d.weaverChance) kindName = 'weaver';

    const kind = ENEMY_KINDS[kindName];
    const margin = kind.width / 2 + 8;
    state.enemies.push({
      kind: kindName,
      x: margin + rng() * (WORLD.width - margin * 2),
      y: -kind.height,
      w: kind.width,
      h: kind.height,
      hp: kind.hp,
      maxHp: kind.hp,
      points: kind.points,
      color: kind.color,
      speed: kind.speed * d.speedScale,
      sway: (rng() * 2 - 1) * (kindName === 'weaver' ? 90 : 34),
      phase: rng() * Math.PI * 2,
      fireTimer: 0.7 + rng() * 2.2,
      hitFlash: 0,
    });
  }

  function playerShoot() {
    const p = state.player;
    if (p.cooldown > 0) return;
    p.cooldown = PLAYER.fireInterval;
    const spread = state.wave >= 5 ? 1 : 0;
    state.bullets.push({ x: p.x, y: p.y - 16, w: BULLET.width, h: BULLET.height, vx: 0 });
    if (spread) {
      state.bullets.push({ x: p.x - 9, y: p.y - 8, w: BULLET.width, h: BULLET.height, vx: -70 });
      state.bullets.push({ x: p.x + 9, y: p.y - 8, w: BULLET.width, h: BULLET.height, vx: 70 });
    }
    onEvent({ type: 'shoot' });
  }

  function hitPlayer() {
    const p = state.player;
    if (p.invuln > 0) return;
    state.lives -= 1;
    state.combo = 0;
    p.invuln = PLAYER.invulnAfterHit;
    state.shake = 1;
    burst(p.x, p.y, '#ff5470', 34, 1.4);
    onEvent({ type: 'playerHit', lives: state.lives });
    if (state.lives <= 0) {
      endGame();
    }
  }

  function damageEnemy(enemy, amount) {
    enemy.hp -= amount;
    enemy.hitFlash = 0.12;
    if (enemy.hp > 0) {
      burst(enemy.x, enemy.y, enemy.color, 4, 0.5);
      onEvent({ type: 'enemyHit' });
      return false;
    }
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const multiplier = 1 + Math.min(4, Math.floor(state.combo / 5));
    const gained = enemy.points * multiplier;
    state.score += gained;
    burst(enemy.x, enemy.y, enemy.color, 18, 1);
    float(enemy.x, enemy.y, multiplier > 1 ? `${gained} x${multiplier}` : `${gained}`);
    state.shake = Math.max(state.shake, 0.35);
    onEvent({ type: 'explosion', points: gained });
    return true;
  }

  function update(dtRaw) {
    const dt = Math.min(dtRaw, 0.05); // guard against tab-switch time jumps
    state.time += dt;

    for (const star of state.stars) {
      star.y += (18 + star.z * 90) * dt;
      if (star.y > WORLD.height) {
        star.y = -2;
        star.x = rng() * WORLD.width;
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floatingTexts.length - 1; i >= 0; i -= 1) {
      const t = state.floatingTexts[i];
      t.life -= dt;
      t.y -= 30 * dt;
      if (t.life <= 0) state.floatingTexts.splice(i, 1);
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 3);

    if (state.phase !== PHASE.PLAYING) return;

    // Wave escalation every 22 seconds of survival.
    state.waveTimer += dt;
    if (state.waveTimer >= 22) {
      state.waveTimer = 0;
      state.wave += 1;
      onEvent({ type: 'wave', wave: state.wave });
    }

    const d = difficulty();
    const p = state.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);

    let dx = 0;
    let dy = 0;
    if (state.input.left) dx -= 1;
    if (state.input.right) dx += 1;
    if (state.input.up) dy -= 1;
    if (state.input.down) dy += 1;
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    p.x = Math.min(WORLD.width - p.w / 2, Math.max(p.w / 2, p.x + dx * PLAYER.speed * dt));
    p.y = Math.min(WORLD.height - p.h / 2, Math.max(WORLD.height * 0.35, p.y + dy * PLAYER.speed * dt));
    if (state.input.fire) playerShoot();

    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.y -= BULLET.speed * dt;
      b.x += (b.vx || 0) * dt;
      if (b.y < -20) state.bullets.splice(i, 1);
    }
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > WORLD.height + 20 || b.x < -20 || b.x > WORLD.width + 20) {
        state.enemyBullets.splice(i, 1);
      }
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = d.spawnInterval * (0.7 + rng() * 0.6);
      spawnEnemy();
      if (state.wave >= 6 && rng() < 0.3) spawnEnemy();
    }

    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      e.y += e.speed * dt;
      e.x += Math.sin(state.time * 1.6 + e.phase) * e.sway * dt;
      e.x = Math.min(WORLD.width - e.w / 2, Math.max(e.w / 2, e.x));
      if (e.hitFlash > 0) e.hitFlash -= dt;

      e.fireTimer -= dt * d.fireScale;
      if (e.fireTimer <= 0 && e.y > 0 && e.y < WORLD.height * 0.8) {
        e.fireTimer = 1.1 + rng() * 2.4;
        if (rng() < ENEMY_KINDS[e.kind].fireChance + state.wave * 0.02) {
          const aimX = p.x - e.x;
          const aimY = p.y - e.y;
          const len = Math.hypot(aimX, aimY) || 1;
          const speed = ENEMY_BULLET.speed * (1 + state.wave * 0.03);
          state.enemyBullets.push({
            x: e.x,
            y: e.y + e.h / 2,
            w: ENEMY_BULLET.width,
            h: ENEMY_BULLET.height,
            vx: (aimX / len) * speed,
            vy: (aimY / len) * speed,
          });
          onEvent({ type: 'enemyShoot' });
        }
      }

      if (e.y - e.h / 2 > WORLD.height) {
        state.enemies.splice(i, 1);
        state.combo = 0;
        continue;
      }

      // Enemy body vs player.
      if (overlaps({ x: e.x, y: e.y, w: e.w, h: e.h }, { x: p.x, y: p.y, w: p.w, h: p.h })) {
        state.enemies.splice(i, 1);
        burst(e.x, e.y, e.color, 14, 1);
        hitPlayer();
        continue;
      }

      // Player bullets vs enemy.
      let killed = false;
      for (let j = state.bullets.length - 1; j >= 0; j -= 1) {
        const b = state.bullets[j];
        if (overlaps({ x: e.x, y: e.y, w: e.w, h: e.h }, { x: b.x, y: b.y, w: b.w, h: b.h })) {
          state.bullets.splice(j, 1);
          if (damageEnemy(e, 1)) { killed = true; break; }
        }
      }
      if (killed) state.enemies.splice(i, 1);
    }

    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      if (overlaps({ x: b.x, y: b.y, w: b.w, h: b.h }, { x: p.x, y: p.y, w: p.w * 0.8, h: p.h * 0.8 })) {
        state.enemyBullets.splice(i, 1);
        hitPlayer();
      }
    }
  }

  return {
    state,
    start,
    reset,
    update,
    endGame,
    setInput(key, value) {
      if (key in state.input) state.input[key] = value;
    },
    snapshot() {
      return {
        phase: state.phase,
        score: state.score,
        lives: state.lives,
        playerX: Math.round(state.player.x),
        playerY: Math.round(state.player.y),
        enemyCount: state.enemies.length,
        projectileCount: state.bullets.length + state.enemyBullets.length,
      };
    },
  };
}
