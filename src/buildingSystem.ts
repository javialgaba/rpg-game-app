import type { BuildingEntity } from './gameTypes';

export function getBuildingHealthColor(ratio: number): number {
  if (ratio > 0.6) { return 0x59c96b; }
  if (ratio > 0.3) { return 0xf2c94c; }
  return 0xe65a45;
}

export function computeWeightedHealth(buildings: BuildingEntity[]): number {
  return buildings.reduce((sum, building) => (
    sum + (building.hp / building.max) * (building.importance ?? 1)
  ), 0);
}

export function computeTotalImportance(buildings: BuildingEntity[]): number {
  return buildings.reduce((sum, building) => sum + (building.importance ?? 1), 0);
}

export function computeVillageSafety(
  buildings: BuildingEntity[],
  currentSafety: number,
): number {
  const totalImportance = computeTotalImportance(buildings);
  const weightedHealth = computeWeightedHealth(buildings);
  const target = totalImportance > 0 ? Math.round((weightedHealth / totalImportance) * 100) : 100;
  return Math.max(0, Math.min(100, Math.round((currentSafety * 3 + target) / 4)));
}



