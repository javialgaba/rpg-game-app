import type { PlayableBounds } from './levelTypes';

export interface FootprintPoint {
  x: number;
  y: number;
}

export const PLAYER_FOOTPRINT_RADIUS = 0.24;

const DIAGONAL_SAMPLE_OFFSET = PLAYER_FOOTPRINT_RADIUS * 0.72;

export const PLAYER_FOOTPRINT_SAMPLES: FootprintPoint[] = [
  { x: 0, y: 0 },
  { x: PLAYER_FOOTPRINT_RADIUS, y: 0 },
  { x: -PLAYER_FOOTPRINT_RADIUS, y: 0 },
  { x: 0, y: PLAYER_FOOTPRINT_RADIUS },
  { x: 0, y: -PLAYER_FOOTPRINT_RADIUS },
  { x: DIAGONAL_SAMPLE_OFFSET, y: DIAGONAL_SAMPLE_OFFSET },
  { x: -DIAGONAL_SAMPLE_OFFSET, y: DIAGONAL_SAMPLE_OFFSET },
  { x: DIAGONAL_SAMPLE_OFFSET, y: -DIAGONAL_SAMPLE_OFFSET },
  { x: -DIAGONAL_SAMPLE_OFFSET, y: -DIAGONAL_SAMPLE_OFFSET },
];

const isInsideBounds = (x: number, y: number, bounds?: PlayableBounds) => {
  if (!bounds) {
    return true;
  }
  return x >= bounds.minX && y >= bounds.minY && x <= bounds.maxX && y <= bounds.maxY;
};

export const isFootprintWalkable = (
  walkableGrid: boolean[][],
  point: FootprintPoint,
  bounds?: PlayableBounds,
) => PLAYER_FOOTPRINT_SAMPLES.every((sample) => {
  const x = Math.round(point.x + sample.x);
  const y = Math.round(point.y + sample.y);
  if (!isInsideBounds(x, y, bounds)) {
    return false;
  }
  return Boolean(walkableGrid[y]?.[x]);
});

export const buildPlayerWalkableGrid = (
  walkableGrid: boolean[][],
  bounds?: PlayableBounds,
) => walkableGrid.map((row, y) => row.map((_, x) => isFootprintWalkable(walkableGrid, { x, y }, bounds)));

const CARDINAL_DIRECTIONS: FootprintPoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const toCell = (point: FootprintPoint) => ({ x: Math.round(point.x), y: Math.round(point.y) });

const isGridCellOpen = (grid: boolean[][], point: FootprintPoint) => Boolean(grid[point.y]?.[point.x]);

const getCardinalOpenNeighbors = (grid: boolean[][], point: FootprintPoint) => CARDINAL_DIRECTIONS
  .map((direction) => ({ x: point.x + direction.x, y: point.y + direction.y }))
  .filter((neighbor) => isGridCellOpen(grid, neighbor));

export const buildPlayerReachableGrid = (
  playerWalkableGrid: boolean[][],
  origin: FootprintPoint | null,
) => {
  const reachableGrid = playerWalkableGrid.map((row) => row.map(() => false));
  if (!origin) {
    return reachableGrid;
  }
  const start = toCell(origin);
  if (!isGridCellOpen(playerWalkableGrid, start)) {
    return reachableGrid;
  }
  const queue = [start];
  reachableGrid[start.y][start.x] = true;
  while (queue.length > 0) {
    const current = queue.shift() as FootprintPoint;
    getCardinalOpenNeighbors(playerWalkableGrid, current).forEach((neighbor) => {
      if (reachableGrid[neighbor.y]?.[neighbor.x]) {
        return;
      }
      reachableGrid[neighbor.y][neighbor.x] = true;
      queue.push(neighbor);
    });
  }
  return reachableGrid;
};

export const getPlayerPocketCells = (
  playerWalkableGrid: boolean[][],
  reachableGrid: boolean[][],
) => playerWalkableGrid.flatMap((row, y) => row.flatMap((walkable, x) => (
  walkable && !reachableGrid[y]?.[x] ? [{ x, y }] : []
)));

export const isPlayerSafeCell = (
  reachableGrid: boolean[][],
  point: FootprintPoint,
) => {
  const cell = toCell(point);
  return isGridCellOpen(reachableGrid, cell) && getCardinalOpenNeighbors(reachableGrid, cell).length > 0;
};

export const findNearestPlayerSafeCell = (
  reachableGrid: boolean[][],
  point: FootprintPoint,
) => {
  let nearest: FootprintPoint | null = null;
  let nearestDistance = Infinity;
  reachableGrid.forEach((row, y) => row.forEach((reachable, x) => {
    if (!reachable || !isPlayerSafeCell(reachableGrid, { x, y })) {
      return;
    }
    const distance = Math.hypot(x - point.x, y - point.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = { x, y };
    }
  }));
  return nearest;
};
