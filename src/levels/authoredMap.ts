import { DEFAULT_PLAYABLE_BOUNDS } from '../sceneVariants';
import type {
  AuthoredMapCell,
  AuthoredMarkerRole,
  AuthoredObjectRole,
  AuthoredTerrainRole,
  GateDirection,
  GeneratedGate,
  GridPoint,
  LevelConfig,
  LevelToken,
  TimeOfDay,
} from './levelTypes';

export const AUTHORED_MAP_SIZE = 29;

const TERRAIN_ROLES = new Set<AuthoredTerrainRole>([
  'grass',
  'flower_grass',
  'stone_road',
  'plaza',
  'forest_floor',
  'gate_road',
]);
const OBJECT_ROLES = new Set<AuthoredObjectRole>([
  'tree_broadleaf',
  'tree_conifer',
  'rock_large',
  'pond',
  'bush',
  'flowers',
  'grass_tuft',
  'magic_patch',
  'lamp',
  'fence',
  'sign',
  'castle',
  'cottage',
  'bakery',
  'market',
  'well',
  'gate_n',
  'gate_e',
  'gate_s',
  'gate_w',
]);
const MARKER_ROLES = new Set<AuthoredMarkerRole>([
  'player_spawn',
  'enemy_threshold_n',
  'enemy_threshold_e',
  'enemy_threshold_s',
  'enemy_threshold_w',
]);
const MARKER_DIRECTIONS: Record<Exclude<AuthoredMarkerRole, 'player_spawn'>, GateDirection> = {
  enemy_threshold_n: 'north',
  enemy_threshold_e: 'east',
  enemy_threshold_s: 'south',
  enemy_threshold_w: 'west',
};
const UNIQUE_BUILDING_OBJECTS = new Set<AuthoredObjectRole>([
  'castle',
  'cottage',
  'bakery',
  'market',
  'well',
]);
const OBJECT_TOKENS: Partial<Record<AuthoredObjectRole, LevelToken>> = {
  tree_broadleaf: 'tree',
  tree_conifer: 'tree',
  castle: 'castle',
  cottage: 'house-1',
  bakery: 'house-2',
  market: 'market',
  well: 'well',
};

const pointKey = (point: GridPoint) => `${point.x},${point.y}`;
const MAX_UNDRESSED_CLEARING_SIZE = 5;
const MAX_CONNECTED_PLAIN_GRASS_CELLS = 14;
const GATE_CENTERLINE_INTERIOR_DEPTH = 4;
const GATE_CLEARING_DEPTH = 5;
const GATE_SIGHTLINE_PADDING = 1;

const uniquePoints = (points: GridPoint[]) => {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = pointKey(point);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return point.x >= 0 && point.y >= 0 && point.x < AUTHORED_MAP_SIZE && point.y < AUTHORED_MAP_SIZE;
  });
};

const expandCells = (cells: GridPoint[], padding: number) => uniquePoints(cells.flatMap((cell) => (
  Array.from({ length: padding * 2 + 1 }, (_, y) => (
    Array.from({ length: padding * 2 + 1 }, (__, x) => ({
      x: cell.x + x - padding,
      y: cell.y + y - padding,
    }))
  )).flat()
)));

const widenCorridor = (cells: GridPoint[], isVertical: boolean) => uniquePoints(cells.flatMap((cell) => (
  [-1, 0, 1].map((offset) => (
    isVertical
      ? { x: cell.x + offset, y: cell.y }
      : { x: cell.x, y: cell.y + offset }
  ))
)));

const createGate = (direction: GateDirection, threshold: GridPoint): GeneratedGate => {
  const isVertical = direction === 'north' || direction === 'south';
  const step = direction === 'north' || direction === 'west' ? 1 : -1;
  const exteriorStart = direction === 'north'
    ? { x: threshold.x, y: 0 }
    : direction === 'south'
      ? { x: threshold.x, y: AUTHORED_MAP_SIZE - 1 }
      : direction === 'west'
        ? { x: 0, y: threshold.y }
        : { x: AUTHORED_MAP_SIZE - 1, y: threshold.y };
  const roadEnd = isVertical
    ? { x: threshold.x, y: threshold.y + step * GATE_CENTERLINE_INTERIOR_DEPTH }
    : { x: threshold.x + step * GATE_CENTERLINE_INTERIOR_DEPTH, y: threshold.y };
  const centerline: GridPoint[] = [];
  for (
    let axis = isVertical ? exteriorStart.y : exteriorStart.x;
    step > 0 ? axis <= (isVertical ? roadEnd.y : roadEnd.x) : axis >= (isVertical ? roadEnd.y : roadEnd.x);
    axis += step
  ) {
    centerline.push(isVertical ? { x: threshold.x, y: axis } : { x: axis, y: threshold.y });
  }
  const approachCells = centerline.filter((cell) => (
    isVertical
      ? Math.abs(cell.y - threshold.y) <= 2 || (direction === 'north' ? cell.y < threshold.y : cell.y > threshold.y)
      : Math.abs(cell.x - threshold.x) <= 2 || (direction === 'west' ? cell.x < threshold.x : cell.x > threshold.x)
  ));
  return {
    id: `gate-${direction}`,
    direction,
    threshold,
    visualEntry: exteriorStart,
    approachCells,
    clearCells: widenCorridor(approachCells.slice(0, GATE_CLEARING_DEPTH), isVertical),
    roadCells: centerline,
    sightlineCells: expandCells(centerline, GATE_SIGHTLINE_PADDING),
  };
};

const cellToToken = (cell: AuthoredMapCell): LevelToken => {
  if (cell.marker === 'player_spawn') {
    return 'player-spawn';
  }
  if (cell.marker?.startsWith('enemy_threshold_')) {
    return 'monster-spawn';
  }
  const objectToken = cell.object ? OBJECT_TOKENS[cell.object] : undefined;
  if (objectToken) {
    return objectToken;
  }
  if (cell.terrain === 'stone_road' || cell.terrain === 'gate_road') {
    return 'path';
  }
  if (cell.terrain === 'plaza') {
    return 'village-center';
  }
  if (cell.terrain === 'flower_grass') {
    return 'decoration';
  }
  return 'grass';
};

const isPlainPlayableGrass = (cell: AuthoredMapCell) => (
  cell.terrain === 'grass' && !cell.object && !cell.marker
);

const collectPlainGrassRegion = (
  cells: AuthoredMapCell[][],
  start: GridPoint,
  visited: Set<string>,
) => {
  const region: GridPoint[] = [];
  const queue = [start];
  visited.add(pointKey(start));
  while (queue.length > 0) {
    const current = queue.shift()!;
    region.push(current);
    [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ].forEach((next) => {
      const key = pointKey(next);
      if (
        visited.has(key)
        || next.x < DEFAULT_PLAYABLE_BOUNDS.minX
        || next.x > DEFAULT_PLAYABLE_BOUNDS.maxX
        || next.y < DEFAULT_PLAYABLE_BOUNDS.minY
        || next.y > DEFAULT_PLAYABLE_BOUNDS.maxY
        || !isPlainPlayableGrass(cells[next.y][next.x])
      ) {
        return;
      }
      visited.add(key);
      queue.push(next);
    });
  }
  return region;
};

const getPlainGrassCoverageErrors = (id: string, cells: AuthoredMapCell[][]) => {
  const errors: string[] = [];
  const visited = new Set<string>();
  for (let y = DEFAULT_PLAYABLE_BOUNDS.minY; y <= DEFAULT_PLAYABLE_BOUNDS.maxY; y += 1) {
    for (let x = DEFAULT_PLAYABLE_BOUNDS.minX; x <= DEFAULT_PLAYABLE_BOUNDS.maxX; x += 1) {
      const point = { x, y };
      const key = pointKey(point);
      if (visited.has(key) || !isPlainPlayableGrass(cells[y][x])) {
        continue;
      }
      const region = collectPlainGrassRegion(cells, point, visited);
      if (region.length > MAX_CONNECTED_PLAIN_GRASS_CELLS) {
        errors.push(
          `Authored map ${id} has an undressed plain grass region of ${region.length} cells starting at ${pointKey(region[0])}.`,
        );
        return errors;
      }
    }
  }
  return errors;
};

export interface AuthoredMapConfigOptions {
  seed?: string;
  timeOfDay?: TimeOfDay;
  tileSize?: number;
  difficulty?: number;
}

export const parseAuthoredMapCsv = (
  id: string,
  csv: string,
  options: AuthoredMapConfigOptions = {},
): LevelConfig => {
  const errors: string[] = [];
  const rows = csv.trim().split(/\r?\n/).filter((row) => row.trim().length > 0);
  if (rows.length !== AUTHORED_MAP_SIZE) {
    errors.push(`Authored map ${id} has ${rows.length} rows; expected ${AUTHORED_MAP_SIZE}.`);
  }
  const cells: AuthoredMapCell[][] = Array.from({ length: AUTHORED_MAP_SIZE }, (_, y) => {
    const values = rows[y]?.split(',') ?? [];
    if (values.length !== AUTHORED_MAP_SIZE) {
      errors.push(`Authored map ${id} row ${y + 1} has ${values.length} cells; expected ${AUTHORED_MAP_SIZE}.`);
    }
    return Array.from({ length: AUTHORED_MAP_SIZE }, (__, x) => {
      const parts = (values[x] ?? 'grass||').trim().split('|');
      if (parts.length !== 3) {
        errors.push(`Authored map ${id} cell ${x},${y} must contain terrain|object|marker.`);
      }
      const rawTerrain = parts[0].trim();
      const terrain = (rawTerrain || 'grass') as AuthoredTerrainRole;
      const object = (parts[1] || undefined) as AuthoredObjectRole | undefined;
      const marker = (parts[2] || undefined) as AuthoredMarkerRole | undefined;
      if (rawTerrain && !TERRAIN_ROLES.has(terrain)) {
        errors.push(`Authored map ${id} cell ${x},${y} has unknown terrain "${parts[0]}".`);
      }
      if (object && !OBJECT_ROLES.has(object)) {
        errors.push(`Authored map ${id} cell ${x},${y} has unknown object "${parts[1]}".`);
      }
      if (marker && !MARKER_ROLES.has(marker)) {
        errors.push(`Authored map ${id} cell ${x},${y} has unknown marker "${parts[2]}".`);
      }
      return {
        terrain: TERRAIN_ROLES.has(terrain) ? terrain : 'grass',
        object: object && OBJECT_ROLES.has(object) ? object : undefined,
        marker: marker && MARKER_ROLES.has(marker) ? marker : undefined,
      };
    });
  });
  const thresholds = new Map<GateDirection, GridPoint>();
  const gateObjects = new Map<GateDirection, GridPoint>();
  const buildingObjects = new Map<AuthoredObjectRole, GridPoint>();
  let playerSpawnCount = 0;
  cells.forEach((row, y) => row.forEach((cell, x) => {
    if (cell.marker === 'player_spawn') {
      playerSpawnCount += 1;
    }
    if (cell.marker && cell.marker !== 'player_spawn') {
      const direction = MARKER_DIRECTIONS[cell.marker];
      if (thresholds.has(direction)) {
        errors.push(`Authored map ${id} contains duplicate ${direction} enemy thresholds.`);
      }
      thresholds.set(direction, { x, y });
    }
    if (cell.object?.startsWith('gate_')) {
      const direction = ({ gate_n: 'north', gate_e: 'east', gate_s: 'south', gate_w: 'west' } as const)[cell.object as 'gate_n' | 'gate_e' | 'gate_s' | 'gate_w'];
      if (gateObjects.has(direction)) {
        errors.push(`Authored map ${id} contains duplicate ${direction} gates.`);
      }
      gateObjects.set(direction, { x, y });
    }
    if (cell.object && UNIQUE_BUILDING_OBJECTS.has(cell.object)) {
      const existing = buildingObjects.get(cell.object);
      if (existing) {
        errors.push(`Authored map ${id} contains duplicate ${cell.object} buildings at ${pointKey(existing)} and ${x},${y}.`);
      } else {
        buildingObjects.set(cell.object, { x, y });
      }
    }
  }));
  if (playerSpawnCount === 0) {
    errors.push(`Authored map ${id} is missing its player_spawn marker.`);
  } else if (playerSpawnCount > 1) {
    errors.push(`Authored map ${id} contains ${playerSpawnCount} player_spawn markers; expected exactly one.`);
  }
  for (let y = DEFAULT_PLAYABLE_BOUNDS.minY; y <= DEFAULT_PLAYABLE_BOUNDS.maxY - MAX_UNDRESSED_CLEARING_SIZE + 1; y += 1) {
    for (let x = DEFAULT_PLAYABLE_BOUNDS.minX; x <= DEFAULT_PLAYABLE_BOUNDS.maxX - MAX_UNDRESSED_CLEARING_SIZE + 1; x += 1) {
      const hasUndressedClearing = Array.from({ length: MAX_UNDRESSED_CLEARING_SIZE }, (__, row) => (
        Array.from({ length: MAX_UNDRESSED_CLEARING_SIZE }, (___, column) => cells[y + row][x + column])
      )).flat().every((cell) => (
        cell.terrain === 'grass' && !cell.object && !cell.marker
      ));
      if (hasUndressedClearing) {
        errors.push(`Authored map ${id} has an undressed ${MAX_UNDRESSED_CLEARING_SIZE}x${MAX_UNDRESSED_CLEARING_SIZE} grass clearing at ${x},${y}.`);
        y = DEFAULT_PLAYABLE_BOUNDS.maxY;
        break;
      }
    }
  }
  errors.push(...getPlainGrassCoverageErrors(id, cells));
  const directions: GateDirection[] = ['north', 'east', 'south', 'west'];
  const gates = directions.flatMap((direction) => {
    const threshold = thresholds.get(direction);
    const gateObject = gateObjects.get(direction);
    if (!threshold) {
      errors.push(`Authored map ${id} is missing its ${direction} threshold marker.`);
      return [];
    }
    if (!gateObject || pointKey(gateObject) !== pointKey(threshold)) {
      errors.push(`Authored map ${id} ${direction} gate object must share its threshold cell.`);
    }
    const gate = createGate(direction, threshold);
    gate.roadCells.forEach((cell) => {
      if (cells[cell.y]?.[cell.x]?.terrain !== 'gate_road') {
        errors.push(`Authored map ${id} ${direction} entrance centerline cell ${pointKey(cell)} must use gate_road terrain.`);
      }
    });
    return [gate];
  });
  return {
    seed: options.seed ?? id,
    timeOfDay: options.timeOfDay ?? 'morning',
    tileSize: options.tileSize ?? 60,
    decorationDensity: 0,
    difficulty: options.difficulty ?? 1,
    playableBounds: { ...DEFAULT_PLAYABLE_BOUNDS },
    matrix: cells.map((row) => row.map(cellToToken)),
    gates,
    authoredMap: { id, cells, errors },
  };
};
