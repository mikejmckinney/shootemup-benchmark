export type Phase = 'idle' | 'running' | 'game-over';

export type GameState = {
  phase: Phase;
  score: number;
  lives: number;
  playerX: number;
  playerY: number;
  enemyCount: number;
  projectileCount: number;
};

export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  firing: boolean;
};

export type GameEngineOptions = {
  width?: number;
  height?: number;
  random?: () => number;
};

export type GameEvent = {
  type: 'fire' | 'hit' | 'damage' | 'game-over';
};

export type RenderEnemy = Readonly<{
  x: number;
  y: number;
  radius: number;
  variant: number;
}>;

export type RenderProjectile = Readonly<{
  x: number;
  y: number;
  radius: number;
}>;

export type GameRenderSnapshot = Readonly<{
  width: number;
  height: number;
  state: Readonly<GameState>;
  player: Readonly<{
    x: number;
    y: number;
    radius: number;
  }>;
  enemies: ReadonlyArray<RenderEnemy>;
  projectiles: ReadonlyArray<RenderProjectile>;
}>;

type Enemy = {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  radius: number;
  speed: number;
  variant: number;
};

type Projectile = {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  radius: number;
};

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 600;
const PLAYER_BOUND = 28;
const MIN_FIELD_SIZE = PLAYER_BOUND * 2;
const PLAYER_START_OFFSET = 60;
const PLAYER_SPEED = 320;
const PLAYER_RADIUS = 20;
const PROJECTILE_SPEED = 440;
const PROJECTILE_RADIUS = 5;
const ENEMY_RADIUS = 18;
const MIN_ENEMY_SPEED = 75;
const INITIAL_SPAWN_INTERVAL = 1_000;
const MIN_SPAWN_INTERVAL = 300;
const MAX_STEP_MS = 100;
const MAX_UPDATE_MS = 2_000;
const POINTS_PER_HIT = 100;
const INITIAL_LIVES = 3;

export class GameEngine {
  private readonly width: number;

  private readonly height: number;

  private readonly random: () => number;

  private state: GameState;

  private input: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    firing: false,
  };

  private enemies: Enemy[] = [];

  private projectiles: Projectile[] = [];

  private events: GameEvent[] = [];

  private spawnElapsedMs = 0;

  private previousPlayerX = 0;

  private previousPlayerY = 0;

  public constructor(options: GameEngineOptions = {}) {
    this.width = this.normalizeDimension(options.width, DEFAULT_WIDTH);
    this.height = this.normalizeDimension(options.height, DEFAULT_HEIGHT);
    this.random = options.random ?? Math.random;
    this.state = this.createInitialState('idle');
    this.previousPlayerX = this.state.playerX;
    this.previousPlayerY = this.state.playerY;
  }

  public getState(): GameState {
    return {
      ...this.state,
      enemyCount: this.enemies.length,
      projectileCount: this.projectiles.length,
    };
  }

  public getRenderSnapshot(): GameRenderSnapshot {
    return {
      width: this.width,
      height: this.height,
      state: this.getState(),
      player: {
        x: this.state.playerX,
        y: this.state.playerY,
        radius: PLAYER_RADIUS,
      },
      enemies: this.enemies.map((enemy) => ({
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius,
        variant: enemy.variant,
      })),
      projectiles: this.projectiles.map((projectile) => ({
        x: projectile.x,
        y: projectile.y,
        radius: projectile.radius,
      })),
    };
  }

  public start(): void {
    if (this.state.phase === 'game-over') {
      this.reset();
    }

    this.state.phase = 'running';
  }

  public reset(): void {
    this.state = this.createInitialState('idle');
    this.input = {
      left: false,
      right: false,
      up: false,
      down: false,
      firing: false,
    };
    this.enemies = [];
    this.projectiles = [];
    this.events = [];
    this.spawnElapsedMs = 0;
    this.previousPlayerX = this.state.playerX;
    this.previousPlayerY = this.state.playerY;
  }

  public setInput(input: Partial<InputState>): void {
    if (input.left !== undefined) {
      this.input.left = input.left;
    }
    if (input.right !== undefined) {
      this.input.right = input.right;
    }
    if (input.up !== undefined) {
      this.input.up = input.up;
    }
    if (input.down !== undefined) {
      this.input.down = input.down;
    }
    if (input.firing !== undefined) {
      this.input.firing = input.firing;
    }
  }

  public update(deltaMs: number): void {
    if (this.state.phase !== 'running') {
      return;
    }

    let remainingMs = this.boundDelta(deltaMs);
    while (remainingMs > 0 && this.state.phase === 'running') {
      const stepMs = Math.min(remainingMs, MAX_STEP_MS);
      this.updateStep(stepMs);
      remainingMs -= stepMs;
    }
  }

  public fire(): boolean {
    if (this.state.phase !== 'running') {
      return false;
    }

    this.projectiles.push({
      x: this.state.playerX,
      y: this.state.playerY,
      previousX: this.state.playerX,
      previousY: this.state.playerY,
      radius: PROJECTILE_RADIUS,
    });
    this.events.push({ type: 'fire' });
    return true;
  }

  public spawnEnemyForTest(x: number, y: number): void {
    if (this.state.phase !== 'running') {
      return;
    }

    this.enemies.push(this.createEnemy(x, y));
  }

  public getSpawnIntervalForTest(score = this.state.score): number {
    const boundedScore = Number.isFinite(score) ? Math.max(0, score) : 0;
    return Math.max(MIN_SPAWN_INTERVAL, INITIAL_SPAWN_INTERVAL - boundedScore * 0.1);
  }

  public endForTest(score: number): void {
    if (!Number.isInteger(score) || score < 0) {
      throw new Error('Score must be a non-negative integer');
    }

    this.finishGame(score);
  }

  public consumeEvents(): GameEvent[] {
    const events = [...this.events];
    this.events = [];
    return events;
  }

  private createInitialState(phase: Phase): GameState {
    return {
      phase,
      score: 0,
      lives: INITIAL_LIVES,
      playerX: this.clamp(this.width / 2, PLAYER_BOUND, this.width - PLAYER_BOUND),
      playerY: this.clamp(this.height - PLAYER_START_OFFSET, PLAYER_BOUND, this.height - PLAYER_BOUND),
      enemyCount: 0,
      projectileCount: 0,
    };
  }

  private updateStep(stepMs: number): void {
    const seconds = stepMs / 1_000;
    this.previousPlayerX = this.state.playerX;
    this.previousPlayerY = this.state.playerY;
    this.movePlayer(seconds);
    this.spawnElapsedMs += stepMs;

    const spawnInterval = this.getSpawnIntervalForTest();
    while (this.spawnElapsedMs >= spawnInterval) {
      this.spawnElapsedMs -= spawnInterval;
      this.spawnEnemy();
    }

    for (const projectile of this.projectiles) {
      projectile.previousX = projectile.x;
      projectile.previousY = projectile.y;
      projectile.y -= PROJECTILE_SPEED * seconds;
    }
    for (const enemy of this.enemies) {
      enemy.previousX = enemy.x;
      enemy.previousY = enemy.y;
      enemy.y += enemy.speed * seconds;
    }

    this.resolveProjectileCollisions();
    this.resolveEnemyCollisions();
    this.removeOffFieldEntities();
  }

  private movePlayer(seconds: number): void {
    const horizontalDirection = Number(this.input.right) - Number(this.input.left);
    const verticalDirection = Number(this.input.down) - Number(this.input.up);
    const minimum = PLAYER_BOUND;
    const maximumX = this.width - PLAYER_BOUND;
    const maximumY = this.height - PLAYER_BOUND;

    this.state.playerX = this.clamp(
      this.state.playerX + horizontalDirection * PLAYER_SPEED * seconds,
      minimum,
      maximumX,
    );
    this.state.playerY = this.clamp(
      this.state.playerY + verticalDirection * PLAYER_SPEED * seconds,
      minimum,
      maximumY,
    );
  }

  private spawnEnemy(): void {
    const spawnX = PLAYER_BOUND + this.randomUnit() * (this.width - PLAYER_BOUND * 2);
    this.enemies.push(this.createEnemy(spawnX, -ENEMY_RADIUS));
  }

  private createEnemy(x: number, y: number): Enemy {
    const variant = Math.floor(this.randomUnit() * 3);
    return {
      x,
      y,
      previousX: x,
      previousY: y,
      radius: ENEMY_RADIUS,
      speed: MIN_ENEMY_SPEED + variant * 15 + Math.min(100, this.state.score * 0.01),
      variant,
    };
  }

  private resolveProjectileCollisions(): void {
    const remainingProjectiles: Projectile[] = [];

    for (const projectile of this.projectiles) {
      const enemyIndex = this.enemies.findIndex((enemy) => this.isSweptColliding(projectile, enemy));
      if (enemyIndex === -1) {
        remainingProjectiles.push(projectile);
        continue;
      }

      this.enemies.splice(enemyIndex, 1);
      this.state.score += POINTS_PER_HIT;
      this.events.push({ type: 'hit' });
    }

    this.projectiles = remainingProjectiles;
  }

  private resolveEnemyCollisions(): void {
    const remainingEnemies: Enemy[] = [];
    const player = {
      x: this.state.playerX,
      y: this.state.playerY,
      previousX: this.previousPlayerX,
      previousY: this.previousPlayerY,
      radius: PLAYER_RADIUS,
    };

    for (const enemy of this.enemies) {
      if (!this.isSweptColliding(enemy, player)) {
        remainingEnemies.push(enemy);
        continue;
      }

      this.state.lives -= 1;
      this.events.push({ type: 'damage' });
      if (this.state.lives <= 0) {
        this.enemies = remainingEnemies;
        this.finishGame(this.state.score);
        return;
      }
    }

    this.enemies = remainingEnemies;
  }

  private removeOffFieldEntities(): void {
    this.projectiles = this.projectiles.filter(
      (projectile) => projectile.y + projectile.radius >= 0,
    );
    this.enemies = this.enemies.filter(
      (enemy) => enemy.y - enemy.radius <= this.height,
    );
  }

  private finishGame(score: number): void {
    const wasGameOver = this.state.phase === 'game-over';
    this.state.phase = 'game-over';
    this.state.score = score;
    this.state.lives = 0;
    this.enemies = [];
    this.projectiles = [];
    if (!wasGameOver) {
      this.events.push({ type: 'game-over' });
    }
  }

  private isSweptColliding(
    first: { x: number; y: number; previousX: number; previousY: number; radius: number },
    second: { x: number; y: number; previousX: number; previousY: number; radius: number },
  ): boolean {
    const startX = first.previousX - second.previousX;
    const startY = first.previousY - second.previousY;
    const movementX = (first.x - first.previousX) - (second.x - second.previousX);
    const movementY = (first.y - first.previousY) - (second.y - second.previousY);
    const movementLengthSquared = movementX * movementX + movementY * movementY;
    const closestTime = movementLengthSquared === 0
      ? 0
      : this.clamp(
        -(startX * movementX + startY * movementY) / movementLengthSquared,
        0,
        1,
      );
    const closestX = startX + movementX * closestTime;
    const closestY = startY + movementY * closestTime;
    const radius = first.radius + second.radius;
    return closestX * closestX + closestY * closestY <= radius * radius;
  }

  private randomUnit(): number {
    return this.clamp(this.random(), 0, 0.9999999999999999);
  }

  private boundDelta(deltaMs: number): number {
    if (!Number.isFinite(deltaMs)) {
      return 0;
    }

    return Math.min(Math.max(deltaMs, 0), MAX_UPDATE_MS);
  }

  private normalizeDimension(value: number | undefined, fallback: number): number {
    return value !== undefined && Number.isFinite(value)
      ? Math.max(MIN_FIELD_SIZE, value)
      : fallback;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
  }
}
