/**
 * A small, DOM-free simulation for Neon Barrage.
 *
 * Coordinates are measured in canvas pixels.  `playerX`/`playerY`, enemy
 * coordinates, and projectile coordinates are centers; width and height are
 * included on every drawable entity.  Time passed to `stepGame` is in seconds.
 *
 * The state returned by this module is deliberately plain data.  The random
 * source is kept in a private WeakMap so a canvas renderer can safely copy or
 * serialize the state without carrying a function with it.
 */

const DEFAULTS = {
  arenaWidth: 480,
  arenaHeight: 720,
  playerWidth: 28,
  playerHeight: 22,
  playerSpeed: 300,
  projectileWidth: 4,
  projectileHeight: 14,
  projectileSpeed: 520,
  fireCooldown: 0.16,
  enemyWidth: 30,
  enemyHeight: 24,
  enemySpeed: 92,
  enemySpawnInterval: 0.9,
  minEnemySpawnInterval: 0.24,
  maxEnemies: 32,
  initialLives: 3,
  levelDuration: 18,
  pointsPerWave: 500,
  enemyPoints: 100,
  difficultySpeedStep: 0.16,
  difficultySpawnFactor: 0.84,
  seed: 0x4e424152,
};

const DEFAULT_FRAME_SECONDS = 1 / 60;
const MAX_SAFE_SCORE = Number.MAX_SAFE_INTEGER;
const CONTEXTS = new WeakMap();

/** The lifecycle phases exposed in the renderable state. */
export const GAME_PHASES = Object.freeze({
  READY: "ready",
  PLAYING: "playing",
  GAME_OVER: "game-over",
});

function isObject(value) {
  return value !== null && typeof value === "object";
}

function assertState(state) {
  if (!isObject(state)) {
    throw new TypeError("A game state object is required");
  }
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function integerAtLeast(value, fallback, minimum = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum
    ? Math.floor(number)
    : fallback;
}

function clamp(value, minimum, maximum) {
  if (minimum > maximum) {
    return (minimum + maximum) / 2;
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeSeed(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return Math.trunc(seed) >>> 0;
  }

  if (typeof seed === "string" && seed.length > 0) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  return DEFAULTS.seed;
}

/**
 * Create a small deterministic random source.  Passing the same seed gives
 * the same sequence, which is useful for replay tests and reproducible bugs.
 */
export function createSeededRandom(seed = DEFAULTS.seed) {
  let value = normalizeSeed(seed);

  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizedRandomValue(randomSource) {
  const value = Number(randomSource());
  if (!Number.isFinite(value)) {
    return 0;
  }
  const fraction = value % 1;
  return fraction < 0 ? fraction + 1 : fraction;
}

function pickNumber(options, nested, key, fallback) {
  if (Object.prototype.hasOwnProperty.call(options, key)) {
    return options[key];
  }
  if (nested && Object.prototype.hasOwnProperty.call(nested, key)) {
    return nested[key];
  }
  return fallback;
}

function buildConfig(options) {
  const source = isObject(options) ? options : {};
  const arenaOptions = isObject(source.arena) ? source.arena : null;
  const playerOptions = isObject(source.player) ? source.player : null;
  const projectileOptions = isObject(source.projectile) ? source.projectile : null;
  const enemyOptions = isObject(source.enemy) ? source.enemy : null;

  const arenaWidth = positiveOr(
    pickNumber(source, arenaOptions, "arenaWidth", pickNumber(source, arenaOptions, "width", DEFAULTS.arenaWidth)),
    DEFAULTS.arenaWidth,
  );
  const arenaHeight = positiveOr(
    pickNumber(source, arenaOptions, "arenaHeight", pickNumber(source, arenaOptions, "height", DEFAULTS.arenaHeight)),
    DEFAULTS.arenaHeight,
  );

  const playerWidth = positiveOr(
    pickNumber(source, playerOptions, "playerWidth", pickNumber(source, playerOptions, "width", DEFAULTS.playerWidth)),
    DEFAULTS.playerWidth,
  );
  const playerHeight = positiveOr(
    pickNumber(source, playerOptions, "playerHeight", pickNumber(source, playerOptions, "height", DEFAULTS.playerHeight)),
    DEFAULTS.playerHeight,
  );

  const projectileWidth = positiveOr(
    pickNumber(
      source,
      projectileOptions,
      "projectileWidth",
      pickNumber(source, projectileOptions, "width", DEFAULTS.projectileWidth),
    ),
    DEFAULTS.projectileWidth,
  );
  const projectileHeight = positiveOr(
    pickNumber(
      source,
      projectileOptions,
      "projectileHeight",
      pickNumber(source, projectileOptions, "height", DEFAULTS.projectileHeight),
    ),
    DEFAULTS.projectileHeight,
  );

  const enemyWidth = positiveOr(
    pickNumber(source, enemyOptions, "enemyWidth", pickNumber(source, enemyOptions, "width", DEFAULTS.enemyWidth)),
    DEFAULTS.enemyWidth,
  );
  const enemyHeight = positiveOr(
    pickNumber(source, enemyOptions, "enemyHeight", pickNumber(source, enemyOptions, "height", DEFAULTS.enemyHeight)),
    DEFAULTS.enemyHeight,
  );

  const config = {
    arenaWidth,
    arenaHeight,
    playerWidth,
    playerHeight,
    playerSpeed: positiveOr(
      pickNumber(source, playerOptions, "playerSpeed", DEFAULTS.playerSpeed),
      DEFAULTS.playerSpeed,
    ),
    projectileWidth,
    projectileHeight,
    projectileSpeed: positiveOr(
      pickNumber(source, projectileOptions, "projectileSpeed", DEFAULTS.projectileSpeed),
      DEFAULTS.projectileSpeed,
    ),
    fireCooldown: Math.max(
      0,
      finiteOr(pickNumber(source, playerOptions, "fireCooldown", DEFAULTS.fireCooldown), DEFAULTS.fireCooldown),
    ),
    enemyWidth,
    enemyHeight,
    enemySpeed: positiveOr(
      pickNumber(source, enemyOptions, "enemySpeed", DEFAULTS.enemySpeed),
      DEFAULTS.enemySpeed,
    ),
    enemySpawnInterval: positiveOr(
      pickNumber(source, "enemySpawnInterval" in source ? null : enemyOptions, "enemySpawnInterval", DEFAULTS.enemySpawnInterval),
      DEFAULTS.enemySpawnInterval,
    ),
    minEnemySpawnInterval: positiveOr(
      pickNumber(source, null, "minEnemySpawnInterval", DEFAULTS.minEnemySpawnInterval),
      DEFAULTS.minEnemySpawnInterval,
    ),
    maxEnemies: Math.max(
      1,
      integerAtLeast(pickNumber(source, null, "maxEnemies", DEFAULTS.maxEnemies), DEFAULTS.maxEnemies, 1),
    ),
    initialLives: Math.max(
      1,
      integerAtLeast(
        pickNumber(source, null, "initialLives", pickNumber(source, null, "lives", DEFAULTS.initialLives)),
        DEFAULTS.initialLives,
        1,
      ),
    ),
    levelDuration: positiveOr(
      pickNumber(source, null, "levelDuration", DEFAULTS.levelDuration),
      DEFAULTS.levelDuration,
    ),
    pointsPerWave: positiveOr(
      pickNumber(source, null, "pointsPerWave", DEFAULTS.pointsPerWave),
      DEFAULTS.pointsPerWave,
    ),
    enemyPoints: Math.max(
      0,
      integerAtLeast(pickNumber(source, enemyOptions, "enemyPoints", DEFAULTS.enemyPoints), DEFAULTS.enemyPoints, 0),
    ),
    difficultySpeedStep: Math.max(
      0,
      finiteOr(pickNumber(source, null, "difficultySpeedStep", DEFAULTS.difficultySpeedStep), DEFAULTS.difficultySpeedStep),
    ),
    difficultySpawnFactor: clamp(
      finiteOr(pickNumber(source, null, "difficultySpawnFactor", DEFAULTS.difficultySpawnFactor), DEFAULTS.difficultySpawnFactor),
      0.1,
      1,
    ),
    playerStartX: finiteOr(
      pickNumber(source, playerOptions, "playerX", arenaWidth / 2),
      arenaWidth / 2,
    ),
    playerStartY: finiteOr(
      pickNumber(source, playerOptions, "playerY", arenaHeight - 48),
      arenaHeight - 48,
    ),
  };

  return config;
}

function getInitialPhase(options) {
  if (isObject(options) && Object.values(GAME_PHASES).includes(options.phase)) {
    return options.phase;
  }
  if (isObject(options) && (options.autoStart === false || options.startImmediately === false)) {
    return GAME_PHASES.READY;
  }
  return GAME_PHASES.PLAYING;
}

function createContext(options) {
  const source = isObject(options) ? options : {};
  const config = buildConfig(source);
  const suppliedRandom = typeof source.random === "function" ? source.random : null;
  const seed = normalizeSeed(source.seed);
  let randomSource = suppliedRandom || createSeededRandom(seed);

  return {
    config,
    initialPhase: getInitialPhase(source),
    random: () => normalizedRandomValue(randomSource),
    resetRandom: () => {
      if (!suppliedRandom) {
        randomSource = createSeededRandom(seed);
      }
    },
  };
}

function ensureContext(state) {
  let context = CONTEXTS.get(state);
  if (!context) {
    const config = isObject(state.config) ? state.config : state;
    context = createContext({ ...config, phase: state.phase });
    CONTEXTS.set(state, context);
  }
  return context;
}

function playerBounds(state) {
  const width = positiveOr(state.playerWidth, DEFAULTS.playerWidth);
  const height = positiveOr(state.playerHeight, DEFAULTS.playerHeight);
  const arenaWidth = positiveOr(state.arenaWidth, DEFAULTS.arenaWidth);
  const arenaHeight = positiveOr(state.arenaHeight, DEFAULTS.arenaHeight);
  return {
    minX: Math.min(width / 2, arenaWidth / 2),
    maxX: Math.max(width / 2, arenaWidth - width / 2),
    minY: Math.min(height / 2, arenaHeight / 2),
    maxY: Math.max(height / 2, arenaHeight - height / 2),
  };
}

function createState(context) {
  const { config } = context;
  const bounds = {
    minX: Math.min(config.playerWidth / 2, config.arenaWidth / 2),
    maxX: Math.max(config.playerWidth / 2, config.arenaWidth - config.playerWidth / 2),
    minY: Math.min(config.playerHeight / 2, config.arenaHeight / 2),
    maxY: Math.max(config.playerHeight / 2, config.arenaHeight - config.playerHeight / 2),
  };
  const playerX = clamp(config.playerStartX, bounds.minX, bounds.maxX);
  const playerY = clamp(config.playerStartY, bounds.minY, bounds.maxY);

  return {
    phase: context.initialPhase,
    score: 0,
    lives: config.initialLives,
    wave: 1,
    level: 1,
    difficultyLevel: 1,
    elapsed: 0,
    arenaWidth: config.arenaWidth,
    arenaHeight: config.arenaHeight,
    arena: { width: config.arenaWidth, height: config.arenaHeight },
    playerX,
    playerY,
    playerWidth: config.playerWidth,
    playerHeight: config.playerHeight,
    playerSpeed: config.playerSpeed,
    enemies: [],
    projectiles: [],
    enemyCount: 0,
    projectileCount: 0,
    input: { left: false, right: false, up: false, down: false, fire: false },
    fireCooldown: 0,
    enemySpawnTimer: config.enemySpawnInterval,
    nextEnemyId: 1,
    nextProjectileId: 1,
    difficulty: {
      level: 1,
      enemySpeed: config.enemySpeed,
      spawnInterval: config.enemySpawnInterval,
      enemySpeedMultiplier: 1,
      spawnRateMultiplier: 1,
    },
    config: { ...config },
  };
}

function syncCounts(state) {
  state.enemyCount = Array.isArray(state.enemies) ? state.enemies.length : 0;
  state.projectileCount = Array.isArray(state.projectiles) ? state.projectiles.length : 0;
}

function updateDifficulty(state, context) {
  const { config } = context;
  const elapsedWave = 1 + Math.floor(Math.max(0, state.elapsed) / config.levelDuration);
  const scoreWave = 1 + Math.floor(Math.max(0, state.score) / config.pointsPerWave);
  const wave = Math.max(1, elapsedWave, scoreWave);
  const levelOffset = wave - 1;
  const enemySpeedMultiplier = 1 + config.difficultySpeedStep * levelOffset;
  const spawnRateMultiplier = 1 / Math.pow(config.difficultySpawnFactor, levelOffset);
  const spawnInterval = Math.max(
    config.minEnemySpawnInterval,
    config.enemySpawnInterval * Math.pow(config.difficultySpawnFactor, levelOffset),
  );

  state.wave = wave;
  state.level = wave;
  state.difficultyLevel = wave;
  state.difficulty = {
    level: wave,
    enemySpeed: config.enemySpeed * enemySpeedMultiplier,
    spawnInterval,
    enemySpeedMultiplier,
    spawnRateMultiplier,
  };
}

function makeInputValue(source, nestedSources, names, fallback) {
  const sources = [source, ...nestedSources];
  for (const candidate of sources) {
    if (!isObject(candidate)) {
      continue;
    }
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(candidate, name)) {
        return Boolean(candidate[name]);
      }
    }
  }
  return fallback;
}

/**
 * Merge keyboard/touch-style controls into the state's current input.
 * Accepted names include left/right/up/down/fire and common Arrow/WASD/Space
 * spellings.  The helper mutates and returns the same state object.
 */
export function setInput(state, input = {}) {
  assertState(state);
  if (input === null || input === undefined) {
    return state;
  }

  const source = isObject(input) ? input : {};
  const nested = [source.keys, source.pressed];
  const previous = isObject(state.input) ? state.input : {};
  state.input = {
    left: makeInputValue(source, nested, ["left", "ArrowLeft", "a", "A"], Boolean(previous.left)),
    right: makeInputValue(source, nested, ["right", "ArrowRight", "d", "D"], Boolean(previous.right)),
    up: makeInputValue(source, nested, ["up", "ArrowUp", "w", "W"], Boolean(previous.up)),
    down: makeInputValue(source, nested, ["down", "ArrowDown", "s", "S"], Boolean(previous.down)),
    fire: makeInputValue(source, nested, ["fire", "space", "Space", " "], Boolean(previous.fire)),
  };
  return state;
}

function aabbIntersects(first, second) {
  const firstWidth = positiveOr(first.width, 0);
  const firstHeight = positiveOr(first.height, 0);
  const secondWidth = positiveOr(second.width, 0);
  const secondHeight = positiveOr(second.height, 0);
  return (
    Math.abs(finiteOr(first.x, 0) - finiteOr(second.x, 0)) * 2 <= firstWidth + secondWidth
    && Math.abs(finiteOr(first.y, 0) - finiteOr(second.y, 0)) * 2 <= firstHeight + secondHeight
  );
}

function playerRect(state) {
  return {
    x: state.playerX,
    y: state.playerY,
    width: state.playerWidth,
    height: state.playerHeight,
  };
}

/**
 * Fire one player projectile if the game is active and the fire cooldown has
 * elapsed.  Returns the new projectile, or null when firing was unavailable.
 */
export function fire(state) {
  assertState(state);
  const context = ensureContext(state);
  if (state.phase !== GAME_PHASES.PLAYING) {
    return null;
  }

  const cooldown = Math.max(0, finiteOr(state.fireCooldown, 0));
  if (cooldown > 0.0000001) {
    return null;
  }

  const { config } = context;
  const projectile = {
    id: state.nextProjectileId,
    x: finiteOr(state.playerX, config.arenaWidth / 2),
    y: finiteOr(state.playerY, config.arenaHeight - 48) - state.playerHeight / 2 - config.projectileHeight / 2,
    width: config.projectileWidth,
    height: config.projectileHeight,
    vx: 0,
    vy: -config.projectileSpeed,
    speed: config.projectileSpeed,
    damage: 1,
  };
  state.nextProjectileId += 1;
  state.projectiles.push(projectile);
  state.fireCooldown = config.fireCooldown;
  syncCounts(state);
  return projectile;
}

/**
 * Add a deterministic enemy to the active state.  Overrides are useful for
 * tests and for future wave patterns; normal gameplay can call it with no
 * overrides and gets an RNG-selected horizontal position.
 */
export function spawnEnemy(state, overrides = {}) {
  assertState(state);
  const context = ensureContext(state);
  if (state.phase === GAME_PHASES.GAME_OVER) {
    return null;
  }

  const source = isObject(overrides) ? overrides : {};
  if (state.enemies.length >= context.config.maxEnemies) {
    return null;
  }

  const width = positiveOr(source.width, context.config.enemyWidth);
  const height = positiveOr(source.height, context.config.enemyHeight);
  const minX = Math.min(width / 2, state.arenaWidth / 2);
  const maxX = Math.max(width / 2, state.arenaWidth - width / 2);
  const randomX = minX + context.random() * Math.max(0, maxX - minX);
  const hitPoints = Math.max(
    1,
    integerAtLeast(source.hp ?? source.health ?? source.hitPoints, 1, 1),
  );
  const speed = Math.max(
    0,
    finiteOr(source.speed, state.difficulty?.enemySpeed ?? context.config.enemySpeed),
  );
  const points = Math.max(
    0,
    integerAtLeast(source.points, context.config.enemyPoints, 0),
  );
  const enemy = {
    id: state.nextEnemyId,
    x: finiteOr(source.x, randomX),
    y: finiteOr(source.y, -height / 2),
    width,
    height,
    vx: finiteOr(source.vx, 0),
    speed,
    hp: hitPoints,
    maxHp: hitPoints,
    points,
    kind: typeof source.kind === "string" ? source.kind : "drone",
  };

  state.nextEnemyId += 1;
  state.enemies.push(enemy);
  syncCounts(state);
  return enemy;
}

function movePlayer(state, context, dt) {
  const input = state.input || {};
  let horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let vertical = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const length = Math.hypot(horizontal, vertical);
  if (length > 1) {
    horizontal /= length;
    vertical /= length;
  }

  const speed = context.config.playerSpeed;
  const bounds = playerBounds(state);
  state.playerX = clamp(finiteOr(state.playerX, bounds.minX) + horizontal * speed * dt, bounds.minX, bounds.maxX);
  state.playerY = clamp(finiteOr(state.playerY, bounds.minY) + vertical * speed * dt, bounds.minY, bounds.maxY);
}

function moveProjectiles(state, context, dt) {
  const active = [];
  for (const projectile of state.projectiles) {
    projectile.x = finiteOr(projectile.x, 0) + finiteOr(projectile.vx, 0) * dt;
    projectile.y = finiteOr(projectile.y, 0) + finiteOr(projectile.vy, -context.config.projectileSpeed) * dt;
    const halfWidth = positiveOr(projectile.width, context.config.projectileWidth) / 2;
    const halfHeight = positiveOr(projectile.height, context.config.projectileHeight) / 2;
    if (
      projectile.x + halfWidth >= 0
      && projectile.x - halfWidth <= state.arenaWidth
      && projectile.y + halfHeight >= 0
      && projectile.y - halfHeight <= state.arenaHeight
    ) {
      active.push(projectile);
    }
  }
  state.projectiles = active;
}

function spawnDueEnemies(state, context, dt) {
  state.enemySpawnTimer = finiteOr(state.enemySpawnTimer, context.config.enemySpawnInterval) - dt;
  let guard = 0;
  while (state.enemySpawnTimer <= 0 && state.enemies.length < context.config.maxEnemies && guard < 256) {
    spawnEnemy(state);
    state.enemySpawnTimer += Math.max(0.001, state.difficulty.spawnInterval);
    guard += 1;
  }

  if (state.enemySpawnTimer <= 0) {
    state.enemySpawnTimer = Math.max(0.001, state.difficulty.spawnInterval);
  }
}

function moveEnemies(state, dt) {
  for (const enemy of state.enemies) {
    enemy.x = finiteOr(enemy.x, 0) + finiteOr(enemy.vx, 0) * dt;
    enemy.y = finiteOr(enemy.y, 0) + Math.max(0, finiteOr(enemy.speed, 0)) * dt;
  }
}

function addScore(state, context, points) {
  const safePoints = Math.max(0, integerAtLeast(points, 0, 0));
  state.score = Math.min(MAX_SAFE_SCORE, Math.max(0, integerAtLeast(state.score, 0, 0)) + safePoints);
  updateDifficulty(state, context);
}

function resolveProjectileCollisions(state, context) {
  const removedEnemies = new Set();
  const activeProjectiles = [];

  for (const projectile of state.projectiles) {
    let projectileHit = false;
    for (const enemy of state.enemies) {
      if (removedEnemies.has(enemy) || !aabbIntersects(projectile, enemy)) {
        continue;
      }

      projectileHit = true;
      const damage = Math.max(1, integerAtLeast(projectile.damage, 1, 1));
      enemy.hp = integerAtLeast(enemy.hp, 1, 1) - damage;
      if (enemy.hp <= 0) {
        removedEnemies.add(enemy);
        addScore(state, context, enemy.points);
      }
      break;
    }
    if (!projectileHit) {
      activeProjectiles.push(projectile);
    }
  }

  state.projectiles = activeProjectiles;
  if (removedEnemies.size > 0) {
    state.enemies = state.enemies.filter((enemy) => !removedEnemies.has(enemy));
  }
}

function setGameOver(state) {
  state.phase = GAME_PHASES.GAME_OVER;
  state.lives = 0;
  state.input = { left: false, right: false, up: false, down: false, fire: false };
  state.fireCooldown = 0;
  state.enemies = [];
  state.projectiles = [];
  syncCounts(state);
}

function loseLife(state, amount = 1) {
  const loss = Math.max(1, integerAtLeast(amount, 1, 1));
  state.lives = Math.max(0, integerAtLeast(state.lives, 0, 0) - loss);
  if (state.lives <= 0) {
    setGameOver(state);
  }
}

function resolveEnemyContacts(state) {
  const player = playerRect(state);
  const activeEnemies = [];

  for (const enemy of state.enemies) {
    const collidedWithPlayer = aabbIntersects(enemy, player);
    const escapedArena = finiteOr(enemy.y, 0) - positiveOr(enemy.height, 0) / 2 >= state.arenaHeight;

    if (collidedWithPlayer || escapedArena) {
      loseLife(state);
      if (state.phase === GAME_PHASES.GAME_OVER) {
        return;
      }
      continue;
    }
    activeEnemies.push(enemy);
  }

  state.enemies = activeEnemies;
}

/**
 * Create a new plain-data game state.  The default phase is `playing`; pass
 * `{ phase: "ready" }` (or `{ autoStart: false }`) when the shell should own
 * the start button before simulation begins.  Pass `seed` or `random` for
 * reproducible or externally controlled enemy placement.
 */
export function createGame(options = {}) {
  const state = {};
  CONTEXTS.set(state, createContext(options));
  return resetGame(state);
}

/**
 * Advance one deterministic simulation frame.  `input` is a partial control
 * object (or null to retain the previous controls) and `dt` is seconds.  The
 * same mutable state object is returned for convenient renderer updates.
 */
export function stepGame(state, input, dt) {
  assertState(state);
  const context = ensureContext(state);

  // Supporting stepGame(state, dt) costs nothing and keeps older callers
  // friendly, while the documented integration contract is (state, input, dt).
  let controls = input;
  let seconds = dt;
  if (typeof input === "number" && dt === undefined) {
    seconds = input;
    controls = undefined;
  }
  if (seconds === undefined) {
    seconds = DEFAULT_FRAME_SECONDS;
  }
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError("dt must be a finite, non-negative number of seconds");
  }

  if (controls !== null && controls !== undefined && typeof controls !== "number") {
    setInput(state, controls);
  }
  if (state.phase !== GAME_PHASES.PLAYING) {
    syncCounts(state);
    return state;
  }

  state.elapsed = Math.max(0, finiteOr(state.elapsed, 0) + seconds);
  state.fireCooldown = Math.max(0, finiteOr(state.fireCooldown, 0) - seconds);
  updateDifficulty(state, context);
  movePlayer(state, context, seconds);
  if (state.input?.fire) {
    fire(state);
  }
  moveProjectiles(state, context, seconds);
  spawnDueEnemies(state, context, seconds);
  moveEnemies(state, seconds);
  resolveProjectileCollisions(state, context);
  resolveEnemyContacts(state);
  syncCounts(state);
  return state;
}

/**
 * Reset a state in place.  A seeded game's random sequence is rewound; a
 * caller-supplied random function remains the source it supplied.
 */
export function resetGame(state) {
  assertState(state);
  const context = ensureContext(state);
  context.resetRandom();
  Object.assign(state, createState(context));
  return state;
}

/**
 * Transition through the same game-over phase used by normal gameplay.
 * This is intentionally only a state transition; validation and score
 * submission remain the browser/database adapter's responsibility.
 */
export function forceGameOver(state, score) {
  assertState(state);
  if (!Number.isSafeInteger(score) || score < 0) {
    throw new RangeError("score must be a non-negative integer");
  }
  const context = ensureContext(state);
  state.score = score;
  updateDifficulty(state, context);
  setGameOver(state);
  return state;
}

/** Compatibility name for a browser test adapter. */
export const endGameForTest = forceGameOver;
