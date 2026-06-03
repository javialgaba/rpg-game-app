import type { GridPoint } from '../gameTypes';

export interface MovementTraceEntry {
  position: GridPoint;
  intendedScreen: GridPoint;
  intendedIso: GridPoint;
  selectedScreen: GridPoint | null;
  reason: string | null;
  blocked: boolean;
}

export interface MovementResultLike {
  intendedScreen: GridPoint;
  intendedIso: GridPoint;
  selectedScreen?: GridPoint | null;
  reason: string | null;
  blocked: boolean;
}

export function appendPlayerMovementTrace(
  trace: MovementTraceEntry[],
  position: GridPoint,
  result: MovementResultLike,
  limit: number,
): MovementTraceEntry[] {
  return [
    ...trace,
    {
      position: { ...position },
      intendedScreen: { ...result.intendedScreen },
      intendedIso: { ...result.intendedIso },
      selectedScreen: result.selectedScreen ? { ...result.selectedScreen } : null,
      reason: result.reason,
      blocked: result.blocked,
    },
  ].slice(-limit);
}

export interface AutoTargetEnemy {
  iso: GridPoint;
  retreating?: boolean;
  defeated?: boolean;
  entranceState?: string;
}

export function resolveAutoTargetIso(
  playerIso: GridPoint,
  facing: GridPoint,
  enemies: AutoTargetEnemy[],
  maxRange: number,
  clampIso: (point: GridPoint, padding?: number) => GridPoint,
): GridPoint {
  let bestEnemy: AutoTargetEnemy | null = null;
  let bestDistance = Infinity;
  enemies.forEach((enemy) => {
    if (enemy.retreating || enemy.defeated || enemy.entranceState === 'approaching') {
      return;
    }
    const distance = Math.hypot(playerIso.x - enemy.iso.x, playerIso.y - enemy.iso.y);
    if (distance <= maxRange && distance < bestDistance) {
      bestEnemy = enemy;
      bestDistance = distance;
    }
  });
  if (bestEnemy) {
    return { x: bestEnemy.iso.x, y: bestEnemy.iso.y };
  }
  return clampIso({
    x: playerIso.x + facing.x * maxRange,
    y: playerIso.y + facing.y * maxRange,
  }, 0.8);
}
