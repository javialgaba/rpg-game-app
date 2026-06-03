import type {
  AuthoredMapCell,
  Footprint,
  GeneratedLevel,
  GridPoint,
  LevelConfig,
  LevelPlacement,
  LevelToken,
  PlayableBounds,
} from './levelTypes';

const MIN_BUILDING_FOOTPRINT_DISTANCE = 3;
const BUILDING_CLEARANCE_TOKENS = new Set<LevelToken>(['castle', 'house-1', 'house-2', 'market', 'well']);

export const clonePoint = (point: GridPoint): GridPoint => ({ x: point.x, y: point.y });

export const makeGrid = <T>(width: number, height: number, value: T): T[][] => (
  Array.from({ length: height }, () => Array.from({ length: width }, () => value))
);

export const getAnchorFootprintCells = (anchor: GridPoint, footprint: Footprint): GridPoint[] => {
  const offsetX = Math.floor(footprint.w / 2);
  const offsetY = Math.floor(footprint.h / 2);
  return Array.from({ length: footprint.h }, (_, row) => (
    Array.from({ length: footprint.w }, (__, col) => ({
      x: anchor.x - offsetX + col,
      y: anchor.y - offsetY + row,
    }))
  )).flat();
};

export const isInside = (point: GridPoint, width: number, height: number): boolean => (
  point.x >= 0 && point.y >= 0 && point.x < width && point.y < height
);

export const isInsideLevel = (level: GeneratedLevel, point: GridPoint): boolean => (
  isInside(point, level.width, level.height)
);

export const resolvePlayableBounds = (config: LevelConfig): PlayableBounds => {
  const height = config.matrix.length;
  const width = config.matrix[0]?.length ?? 0;
  if (!config.playableBounds) {
    return {
      minX: 0,
      minY: 0,
      maxX: Math.max(0, width - 1),
      maxY: Math.max(0, height - 1),
    };
  }
  return {
    minX: Math.max(0, Math.min(width - 1, config.playableBounds.minX)),
    minY: Math.max(0, Math.min(height - 1, config.playableBounds.minY)),
    maxX: Math.max(0, Math.min(width - 1, config.playableBounds.maxX)),
    maxY: Math.max(0, Math.min(height - 1, config.playableBounds.maxY)),
  };
};

export const isInsidePlayableBounds = (point: GridPoint, bounds: PlayableBounds): boolean => (
  point.x >= bounds.minX
  && point.y >= bounds.minY
  && point.x <= bounds.maxX
  && point.y <= bounds.maxY
);

export const isPlayableBoundsEdgeCell = (point: GridPoint, bounds: PlayableBounds): boolean => (
  point.x === bounds.minX
  || point.y === bounds.minY
  || point.x === bounds.maxX
  || point.y === bounds.maxY
);

export const getEdgeDistance = (point: GridPoint, width: number, height: number): number => Math.min(
  point.x,
  point.y,
  width - 1 - point.x,
  height - 1 - point.y,
);

export const getBoundsEdgeDistance = (point: GridPoint, bounds: PlayableBounds): number => Math.min(
  point.x - bounds.minX,
  point.y - bounds.minY,
  bounds.maxX - point.x,
  bounds.maxY - point.y,
);

export const pointKey = (point: GridPoint): string => `${point.x},${point.y}`;

export const getAuthoredCell = (config: LevelConfig, point: GridPoint): AuthoredMapCell | undefined => (
  config.authoredMap?.cells[point.y]?.[point.x]
);

export const getCellDistance = (a: GridPoint, b: GridPoint): number => Math.max(
  Math.abs(a.x - b.x),
  Math.abs(a.y - b.y),
);

export const getFootprintDistance = (a: GridPoint[], b: GridPoint[]): number => (
  a.reduce((best, aCell) => Math.min(
    best,
    b.reduce((cellBest, bCell) => Math.min(cellBest, getCellDistance(aCell, bCell)), Infinity),
  ), Infinity)
);

export const shouldEnforceBuildingClearance = (placement: LevelPlacement): boolean => (
  BUILDING_CLEARANCE_TOKENS.has(placement.token)
);

export const getBuildingClearanceErrors = (placements: LevelPlacement[]): string[] => {
  const clearanced = placements.filter(shouldEnforceBuildingClearance);
  const errors: string[] = [];
  clearanced.forEach((placement, index) => {
    clearanced.slice(index + 1).forEach((other) => {
      const distance = getFootprintDistance(placement.cells, other.cells);
      if (distance < MIN_BUILDING_FOOTPRINT_DISTANCE) {
        errors.push(`${placement.label} at ${pointKey(placement.grid)} and ${other.label} at ${pointKey(other.grid)} must keep 2 clear cells between building footprints.`);
      }
    });
  });
  return errors;
};

export const getNeighborCells = (point: GridPoint, radius = 1): GridPoint[] => {
  const cells: GridPoint[] = [];
  for (let y = point.y - radius; y <= point.y + radius; y += 1) {
    for (let x = point.x - radius; x <= point.x + radius; x += 1) {
      if (x === point.x && y === point.y) {
        continue;
      }
      cells.push({ x, y });
    }
  }
  return cells;
};

export const getCardinalNeighborCells = (point: GridPoint): GridPoint[] => [
  { x: point.x + 1, y: point.y },
  { x: point.x - 1, y: point.y },
  { x: point.x, y: point.y + 1 },
  { x: point.x, y: point.y - 1 },
];
