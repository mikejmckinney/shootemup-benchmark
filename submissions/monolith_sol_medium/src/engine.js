export const WIDTH = 800;
export const HEIGHT = 900;

export function createGame(random = Math.random) {
  const game = {
    phase: 'ready', score: 0, lives: 3, playerX: WIDTH / 2, playerY: HEIGHT - 105,
    enemies: [], projectiles: [], enemyShots: [], particles: [], elapsed: 0,
    spawnTimer: 0, shotTimer: 0, fireCooldown: 0, invulnerable: 0, shake: 0,
    level: 1, combo: 0, nextId: 1, random
  };
  return game;
}

export function startGame(g) {
  Object.assign(g, createGame(g.random));
  g.phase = 'playing';
  return g;
}

function spawnEnemy(g) {
  const elite = g.random() < Math.min(.12 + g.level * .018, .3);
  const radius = elite ? 28 : 21;
  g.enemies.push({
    id: g.nextId++, x: 55 + g.random() * (WIDTH - 110), y: -radius,
    vx: (g.random() - .5) * (55 + g.level * 5), vy: 70 + g.level * 10 + g.random() * 35,
    radius, hp: elite ? 3 : 1, elite, phase: g.random() * Math.PI * 2
  });
}

function burst(g, x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const a = g.random() * Math.PI * 2, speed = 50 + g.random() * 170;
    g.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .35 + g.random() * .35, color });
  }
}

function hitPlayer(g) {
  if (g.invulnerable > 0 || g.phase !== 'playing') return;
  g.lives -= 1; g.invulnerable = 1.5; g.shake = .35; g.combo = 0;
  burst(g, g.playerX, g.playerY, '#ff3fb4', 24);
  if (g.lives <= 0) g.phase = 'gameover';
}

const near = (a, b, extra = 0) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.radius + (b.radius || 4) + extra) ** 2;

export function updateGame(g, dt, input = {}) {
  dt = Math.min(dt, .05);
  if (g.phase !== 'playing') return g;
  g.elapsed += dt;
  g.level = 1 + Math.floor(g.elapsed / 18);
  g.invulnerable = Math.max(0, g.invulnerable - dt);
  g.shake = Math.max(0, g.shake - dt);
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy) || 1;
  g.playerX = Math.max(28, Math.min(WIDTH - 28, g.playerX + dx / len * 340 * dt));
  g.playerY = Math.max(70, Math.min(HEIGHT - 38, g.playerY + dy / len * 340 * dt));
  g.fireCooldown -= dt;
  if (input.fire && g.fireCooldown <= 0) {
    g.projectiles.push({ x: g.playerX - 11, y: g.playerY - 26, vy: -620, radius: 4 });
    g.projectiles.push({ x: g.playerX + 11, y: g.playerY - 26, vy: -620, radius: 4 });
    g.fireCooldown = .14;
  }
  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0) {
    spawnEnemy(g);
    if (g.level > 3 && g.random() < .22) spawnEnemy(g);
    g.spawnTimer = Math.max(.25, .88 - g.level * .055);
  }
  g.shotTimer -= dt;
  if (g.shotTimer <= 0 && g.enemies.length) {
    const enemy = g.enemies[Math.floor(g.random() * g.enemies.length)];
    const angle = Math.atan2(g.playerY - enemy.y, g.playerX - enemy.x);
    const speed = 155 + g.level * 11;
    g.enemyShots.push({ x: enemy.x, y: enemy.y + 10, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 6 });
    g.shotTimer = Math.max(.35, 1.25 - g.level * .06);
  }
  for (const p of g.projectiles) p.y += p.vy * dt;
  for (const p of g.enemyShots) { p.x += p.vx * dt; p.y += p.vy * dt; if (near({x:g.playerX,y:g.playerY,radius:19}, p)) { p.dead = true; hitPlayer(g); } }
  for (const e of g.enemies) {
    e.phase += dt * 2.2; e.x += (e.vx + Math.sin(e.phase) * 25) * dt; e.y += e.vy * dt;
    if (e.x < e.radius || e.x > WIDTH - e.radius) e.vx *= -1;
    if (near({x:g.playerX,y:g.playerY,radius:20}, e)) { e.dead = true; hitPlayer(g); }
    if (e.y > HEIGHT + 35) { e.dead = true; hitPlayer(g); }
    for (const p of g.projectiles) if (!p.dead && !e.dead && near(e, p)) {
      p.dead = true; e.hp -= 1; burst(g, p.x, p.y, '#57f5ff', 4);
      if (e.hp <= 0) {
        e.dead = true; g.combo += 1; g.score += (e.elite ? 250 : 100) + Math.min(g.combo, 20) * 10;
        g.shake = .12; burst(g, e.x, e.y, e.elite ? '#ffcf57' : '#ff3fb4', e.elite ? 24 : 15);
      }
    }
  }
  for (const p of g.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; p.life -= dt; }
  g.projectiles = g.projectiles.filter(p => !p.dead && p.y > -30);
  g.enemyShots = g.enemyShots.filter(p => !p.dead && p.y < HEIGHT + 30 && p.x > -30 && p.x < WIDTH + 30);
  g.enemies = g.enemies.filter(e => !e.dead);
  g.particles = g.particles.filter(p => p.life > 0);
  return g;
}

export function stateView(g) {
  return { phase: g.phase, score: g.score, lives: g.lives, playerX: Math.round(g.playerX), playerY: Math.round(g.playerY), enemyCount: g.enemies.length, projectileCount: g.projectiles.length };
}

export function endGame(g, score) {
  if (!Number.isSafeInteger(score) || score < 0) throw new TypeError('Score must be a non-negative integer');
  g.score = score; g.lives = 0; g.phase = 'gameover';
  return g;
}
