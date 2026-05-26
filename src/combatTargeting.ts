export interface CombatTarget {
  defeated?: boolean;
  retreating?: boolean;
  entranceState?: string;
  iso: { x: number; y: number };
}

export function isCombatTargetEligible(enemy: CombatTarget) {
  return !enemy.defeated && !enemy.retreating && enemy.entranceState !== 'approaching';
}

export function getNearestCombatTarget<T extends CombatTarget>(
  enemies: T[],
  origin: { x: number; y: number },
  maxRange: number,
) {
  let nearest: T | null = null;
  let nearestDistance = Infinity;
  enemies.forEach((enemy) => {
    if (!isCombatTargetEligible(enemy)) {
      return;
    }
    const distance = Math.hypot(enemy.iso.x - origin.x, enemy.iso.y - origin.y);
    if (distance <= maxRange && distance < nearestDistance) {
      nearest = enemy;
      nearestDistance = distance;
    }
  });
  return nearest;
}
