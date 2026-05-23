import { MAP_H, MAP_W } from './gameConfig';
import type { GridPoint } from './levels/levelTypes';

export interface GeneratedLevelData {
  width: number;
  height: number;
  spawnPoints: GridPoint[];
  walkableGrid: boolean[][];
  playableBounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export function isoToGridCell(
  iso: GridPoint,
  generatedLevel: GeneratedLevelData | null,
): GridPoint {
  const maxX = (generatedLevel?.width ?? MAP_W) - 1;
  const maxY = (generatedLevel?.height ?? MAP_H) - 1;
  const x = Math.max(0, Math.min(Math.round(iso.x), maxX));
  const y = Math.max(0, Math.min(Math.round(iso.y), maxY));
  return { x, y };
}

export function getGeneratedEdgeSpawnPoints(
  generatedLevel: GeneratedLevelData | null,
): GridPoint[] {
  if (!generatedLevel?.spawnPoints.length) {
    return [];
  }
  const { minX, minY, maxX, maxY } = generatedLevel.playableBounds;
  return generatedLevel.spawnPoints.filter((spawn) => (
    spawn.x === minX
    || spawn.y === minY
    || spawn.x === maxX
    || spawn.y === maxY
  ));
}

export function getGeneratedFallbackSpawnAnchors(
  generatedLevel: GeneratedLevelData | null,
): GridPoint[] {
  if (!generatedLevel) {
    return [];
  }
  const { minX, minY, maxX, maxY } = generatedLevel.playableBounds;
  const midX = Math.floor((minX + maxX) / 2);
  const midY = Math.floor((minY + maxY) / 2);
  return [
    { x: minX, y: midY },
    { x: midX, y: minY },
    { x: maxX, y: midY },
    { x: midX, y: maxY },
  ];
}

export function getGeneratedPlayableEdgeCells(
  generatedLevel: GeneratedLevelData | null,
): GridPoint[] {
  if (!generatedLevel) {
    return [];
  }
  const cells: GridPoint[] = [];
  const { minX, minY, maxX, maxY } = generatedLevel.playableBounds;
  const seen = new Set<string>();
  for (let x = minX; x <= maxX; x += 1) {
    cells.push({ x, y: minY });
    cells.push({ x, y: maxY });
  }
  for (let y = minY + 1; y < maxY; y += 1) {
    cells.push({ x: minX, y });
    cells.push({ x: maxX, y });
  }
  return cells.filter((cell) => {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return generatedLevel.walkableGrid[cell.y]?.[cell.x] ?? false;
  });
}
