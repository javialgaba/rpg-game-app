import { REPAIR_RANGE } from './gameConfig';
import type { BuildingEntity, GridPoint } from './gameTypes';

export function getFootprintCells(
  x: number,
  y: number,
  footprint: { w: number; h: number } = { w: 1, h: 1 },
): GridPoint[] {
  const offsetX = Math.floor((footprint.w) / 2);
  const offsetY = Math.floor((footprint.h) / 2);
  const cells: GridPoint[] = [];
  for (let row = 0; row < footprint.h; row++) {
    for (let col = 0; col < footprint.w; col++) {
      cells.push({ x: x + col - offsetX, y: y + row - offsetY });
    }
  }
  return cells;
}

export function getBuildingFootprintCells(
  building: BuildingEntity,
  footprintCellsFn: (x: number, y: number, footprint?: { w: number; h: number }) => GridPoint[],
): GridPoint[] {
  return building.footprintCells ?? footprintCellsFn(building.iso.x, building.iso.y, building.footprint);
}

export function getRepairDistanceToBuilding(
  building: BuildingEntity,
  playerIso: GridPoint | null,
  footprintCellsFn: (x: number, y: number, footprint?: { w: number; h: number }) => GridPoint[],
): number {
  if (!playerIso) {
    return Infinity;
  }
  const footprintCells = getBuildingFootprintCells(building, footprintCellsFn);
  return footprintCells.reduce((bestDistance, cell) => {
    const dx = cell.x + 0.5 - playerIso.x;
    const dy = cell.y + 0.5 - playerIso.y;
    return Math.min(bestDistance, Math.hypot(dx, dy));
  }, Math.hypot(building.iso.x - playerIso.x, building.iso.y - playerIso.y));
}

export function getNearestDamagedBuilding(
  buildings: BuildingEntity[],
  playerIso: GridPoint | null,
  footprintCellsFn: (x: number, y: number, footprint?: { w: number; h: number }) => GridPoint[],
  range = REPAIR_RANGE,
): BuildingEntity | null {
  let nearest: BuildingEntity | null = null;
  let nearestDistance = Infinity;
  for (const building of buildings) {
    if (building.hp >= building.max) { continue; }
    if (building.name === 'Castle' && building.hp <= 0) { continue; }
    const distance = getRepairDistanceToBuilding(building, playerIso, footprintCellsFn);
    if (distance <= range && distance < nearestDistance) {
      nearest = building;
      nearestDistance = distance;
    }
  }
  return nearest;
}
