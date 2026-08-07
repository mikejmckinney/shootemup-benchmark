import { MAX_SCORE } from './config';
import type { GameSession, Enemy } from './types';

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function resolveCollisions(session: GameSession): GameSession {
  const remainingEnemies: Enemy[] = [];
  const consumedProjectiles = new Set<number>();
  let score = session.score;
  let lives = session.lives;
  let player = { ...session.player };

  for (const enemy of session.enemies) {
    let enemyHp = enemy.hp;
    let destroyed = false;

    for (const projectile of session.projectiles) {
      if (consumedProjectiles.has(projectile.id) || !overlaps(enemy, projectile)) continue;

      consumedProjectiles.add(projectile.id);
      enemyHp -= projectile.damage;
      if (enemyHp <= 0) {
        destroyed = true;
        score = Math.min(MAX_SCORE, score + 100);
        break;
      }
    }

    if (destroyed) continue;

    if (player.invulnerableMs <= 0 && overlaps(player, enemy)) {
      lives = Math.max(0, lives - 1);
      player = { ...player, invulnerableMs: 900 };
      continue;
    }

    remainingEnemies.push({ ...enemy, hp: enemyHp });
  }

  return {
    ...session,
    score,
    lives,
    phase: lives === 0 ? 'game-over' : session.phase,
    player,
    enemies: remainingEnemies,
    projectiles: session.projectiles.filter((projectile) => !consumedProjectiles.has(projectile.id)),
  };
}
