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