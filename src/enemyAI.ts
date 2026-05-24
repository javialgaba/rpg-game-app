import type { GridPoint, BuildingEntity } from './gameTypes';

// ---- Pure helper functions ----

export function getNearestForestExit(
  iso: GridPoint,
  generatedLevelActive: boolean,
  generatedLevelWidth: number | null,
  generatedLevelHeight: number | null,
): GridPoint {
  const maxX = generatedLevelActive && generatedLevelWidth ? generatedLevelWidth - 0.8 : 14.2;
  const maxY = generatedLevelActive && generatedLevelHeight ? generatedLevelHeight - 0.8 : 14.2;
  const exits: GridPoint[] = [
    { x: iso.x, y: 0.8 },
    { x: maxX, y: iso.y },
    { x: iso.x, y: maxY },
    { x: 0.8, y: iso.y },
  ];
  return exits.reduce((best, exit) => {
    const distBest = Math.hypot(iso.x - best.x, iso.y - best.y);
    const distExit = Math.hypot(iso.x - exit.x, iso.y - exit.y);
    return distExit < distBest ? exit : best;
  }, exits[0]);
}

export function findBestTarget(
  buildings: BuildingEntity[],
  generatedLevelActive: boolean,
  enterGameOver: (reason: string) => void,
): BuildingEntity | null {
  const aliveBuildings = buildings.filter((building) => building.hp > 0);
  const castle = buildings.find((building) => building.name === 'Castle');
  if (!castle || castle.hp <= 0) {
    enterGameOver('The castle needs a rescue rest!');
    return null;
  }
  if (generatedLevelActive) {
    return aliveBuildings.reduce<BuildingEntity>(
      (best, building) => {
        return (building.importance ?? 1) > (best.importance ?? 1) ? building : best;
      },
      aliveBuildings[0] ?? castle,
    );
  }
  const villageTargets = aliveBuildings.filter((building) => building.name !== 'Castle');
  // In non-generated mode, pick a random village target
  const randomIndex = Math.floor(Math.random() * (villageTargets.length > 0 ? villageTargets.length : 1));
  return villageTargets.length > 0 ? villageTargets[randomIndex] : castle;
}

export function getPathProgress(
  path: GridPoint[],
  pathIndex: number,
  iso: GridPoint,
  waypointArrivalRadius: number,
): { pathIndex: number; targetIso: GridPoint } {
  let currentIndex = pathIndex;
  let currentWaypoint = path[Math.min(currentIndex, path.length - 1)];

  while (
    currentIndex < path.length - 1
    && Math.hypot(iso.x - currentWaypoint.x, iso.y - currentWaypoint.y) <= waypointArrivalRadius
  ) {
    currentIndex += 1;
    currentWaypoint = path[Math.min(currentIndex, path.length - 1)];
  }

  return { pathIndex: currentIndex, targetIso: currentWaypoint };
}

export function hasReachedAttackZone(
  path: GridPoint[] | null,
  pathIndex: number,
  distToTarget: number,
): boolean {
  return (!path || !path.length || pathIndex >= path.length - 1) && distToTarget <= 0.45;
}

export function canDamagePlayer(
  playerPos: GridPoint,
  enemyPos: GridPoint,
  retreating: boolean,
  heroTouchCooldown: number,
  time: number,
): boolean {
  if (retreating) {
    return false;
  }
  const playerDist = Math.hypot(playerPos.x - enemyPos.x, playerPos.y - enemyPos.y);
  return playerDist <= 0.58 && time > heroTouchCooldown;
}

export function canDamageBuilding(
  retreating: boolean,
  reachedAttackZone: boolean,
  dist: number,
  touchCooldown: number,
  time: number,
): boolean {
  return !retreating && reachedAttackZone && dist <= 0.45 && time > touchCooldown;
}

export function isRetreatComplete(enemyPos: GridPoint, exitPos: GridPoint): boolean {
  return Math.hypot(enemyPos.x - exitPos.x, enemyPos.y - exitPos.y) < 0.55;
}
