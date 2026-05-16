import type {
  AssetRegistry,
  AssetRegistryEntry,
  Footprint,
  GeneratedLevel,
  GridPoint,
  LevelConfig,
  LevelPlacement,
  LevelValidationResult,
  ProtectedTargetPlacement,
} from './levelTypes';
import { findGridPath } from './pathfinding';
import { SeededRandom } from './seededRandom';

const clonePoint = (point: GridPoint) => ({ x: point.x, y: point.y });

const makeGrid = <T>(width: number, height: number, value: T) => (
  Array.from({ length: height }, () => Array.from({ length: width }, () => value))
);

const getAnchorFootprintCells = (anchor: GridPoint, footprint: Footprint) => {
  const offsetX = Math.floor(footprint.w / 2);
  const offsetY = Math.floor(footprint.h / 2);
  return Array.from({ length: footprint.h }, (_, row) => (
    Array.from({ length: footprint.w }, (__, col) => ({
      x: anchor.x - offsetX + col,
      y: anchor.y - offsetY + row,
    }))
  )).flat();
};

const isInside = (point: GridPoint, width: number, height: number) => (
  point.x >= 0 && point.y >= 0 && point.x < width && point.y < height
);

const getAttackCells = (
  cells: GridPoint[],
  blockedGrid: boolean[][],
  width: number,
  height: number,
) => {
  const blockedKeys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  const candidates = cells.flatMap((cell) => [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ]);
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.x},${candidate.y}`;
    if (seen.has(key) || blockedKeys.has(key)) {
      return false;
    }
    seen.add(key);
    return isInside(candidate, width, height) && !blockedGrid[candidate.y][candidate.x];
  });
};

const createPlacement = (
  id: string,
  token: LevelPlacement['token'],
  entry: AssetRegistryEntry,
  grid: GridPoint,
) => {
  const footprint = entry.footprint ?? { w: 1, h: 1 };
  const cells = getAnchorFootprintCells(grid, footprint);
  return {
    id,
    token,
    label: entry.label,
    type: entry.type,
    grid: clonePoint(grid),
    iso: clonePoint(grid),
    footprint,
    cells,
    render: entry.render,
    blocksMovement: entry.blocksMovement,
  } satisfies LevelPlacement;
};

const getTerrainEntry = (entry: AssetRegistryEntry, registry: AssetRegistry) => {
  if (entry.type === 'path' || entry.token === 'V' || entry.token === 'PS') {
    return registry.P;
  }
  if (entry.token === 'D') {
    return registry.D;
  }
  if (entry.token === 'SP' || entry.token === 'T') {
    return registry.G;
  }
  return registry.G;
};

export const generateLevel = (config: LevelConfig, registry: AssetRegistry) => {
  const height = config.matrix.length;
  const width = config.matrix[0]?.length ?? 0;
  const rng = new SeededRandom(config.seed);
  const walkableGrid = makeGrid(width, height, true);
  const blockedGrid = makeGrid(width, height, false);
  const buildingGrid = makeGrid<ProtectedTargetPlacement | null>(width, height, null);
  const decorationGrid = makeGrid<LevelPlacement | null>(width, height, null);
  const spawnGrid = makeGrid(width, height, false);
  const targetGrid = makeGrid(width, height, false);
  const terrain: LevelPlacement[] = [];
  const objects: LevelPlacement[] = [];
  const decorations: LevelPlacement[] = [];
  const chests: LevelPlacement[] = [];
  const spawnPoints: GridPoint[] = [];
  const protectedTargets: ProtectedTargetPlacement[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let playerSpawn: GridPoint | null = null;

  config.matrix.forEach((row, y) => {
    if (row.length !== width) {
      errors.push(`Row ${y} has ${row.length} cells; expected ${width}.`);
    }
    row.forEach((token, x) => {
      const entry = registry[token];
      if (!entry) {
        errors.push(`Unknown token ${token} at ${x},${y}.`);
        return;
      }

      const terrainEntry = getTerrainEntry(entry, registry);
      terrain.push(createPlacement(`terrain-${x}-${y}`, terrainEntry.token, terrainEntry, { x, y }));

      if (token === 'PS') {
        playerSpawn = { x, y };
      }
      if (token === 'SP') {
        spawnPoints.push({ x, y });
        spawnGrid[y][x] = true;
      }
      if (entry.type === 'terrain' || entry.type === 'path' || entry.type === 'marker' || entry.type === 'spawn') {
        return;
      }

      const placement = createPlacement(`${token.toLowerCase()}-${x}-${y}`, token, entry, { x, y });
      const illegalCells = placement.cells.filter((cell) => !isInside(cell, width, height));
      if (illegalCells.length > 0) {
        errors.push(`${entry.label} at ${x},${y} has a footprint outside level bounds.`);
      }

      const overlappingCells = placement.cells.filter((cell) => (
        isInside(cell, width, height) && blockedGrid[cell.y][cell.x]
      ));
      if (overlappingCells.length > 0) {
        errors.push(`${entry.label} at ${x},${y} overlaps another blocker.`);
      }

      if (entry.blocksMovement) {
        placement.cells.forEach((cell) => {
          if (!isInside(cell, width, height)) {
            return;
          }
          blockedGrid[cell.y][cell.x] = true;
          walkableGrid[cell.y][cell.x] = false;
        });
      }

      if (entry.protected) {
        const target = {
          ...placement,
          maxHealth: entry.maxHealth ?? 60,
          currentHealth: entry.maxHealth ?? 60,
          importance: entry.importance ?? 1,
          attackCells: [],
        } satisfies ProtectedTargetPlacement;
        protectedTargets.push(target);
        placement.cells.forEach((cell) => {
          if (isInside(cell, width, height)) {
            buildingGrid[cell.y][cell.x] = target;
            targetGrid[cell.y][cell.x] = true;
          }
        });
        objects.push(target);
      } else if (entry.type === 'interactable') {
        chests.push(placement);
        objects.push(placement);
      } else {
        objects.push(placement);
      }
    });
  });

  protectedTargets.forEach((target) => {
    target.attackCells = getAttackCells(target.cells, blockedGrid, width, height);
    if (!target.attackCells.length) {
      errors.push(`${target.label} has no reachable attack cells.`);
    }
  });

  terrain.forEach((placement) => {
    const token = config.matrix[placement.grid.y]?.[placement.grid.x];
    if (token !== 'G' || !rng.chance(config.decorationDensity * 0.08)) {
      return;
    }
    if (blockedGrid[placement.grid.y][placement.grid.x] || spawnGrid[placement.grid.y][placement.grid.x]) {
      return;
    }
    const decoration = {
      ...placement,
      id: `deco-${placement.grid.x}-${placement.grid.y}`,
      token: 'D',
      label: 'Tiny Flowers',
    } satisfies LevelPlacement;
    decorations.push(decoration);
    decorationGrid[placement.grid.y][placement.grid.x] = decoration;
  });

  if (!playerSpawn) {
    warnings.push('No PS player spawn found; using village center fallback.');
    playerSpawn = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  }

  if (!spawnPoints.length) {
    warnings.push('No SP monster spawns found; using edge fallback spawns.');
    spawnPoints.push(
      { x: 0, y: Math.floor(height / 2) },
      { x: width - 1, y: Math.floor(height / 2) },
    );
  }

  return {
    config,
    width,
    height,
    walkableGrid,
    blockedGrid,
    buildingGrid,
    decorationGrid,
    spawnGrid,
    targetGrid,
    terrain,
    objects,
    decorations,
    chests,
    spawnPoints,
    playerSpawn,
    protectedTargets,
    warnings,
    errors,
  } satisfies GeneratedLevel;
};

export const validateGeneratedLevel = (level: GeneratedLevel): LevelValidationResult => {
  const errors = [...level.errors];
  const warnings = [...level.warnings];

  if (level.width <= 0 || level.height <= 0) {
    errors.push('Level dimensions must be greater than zero.');
  }
  if (!level.playerSpawn) {
    errors.push('Player spawn is missing.');
  } else if (level.blockedGrid[level.playerSpawn.y]?.[level.playerSpawn.x]) {
    errors.push('Player spawn is blocked.');
  }
  if (!level.spawnPoints.length) {
    errors.push('At least one monster spawn is required.');
  }
  if (!level.protectedTargets.length) {
    errors.push('At least one protected building is required.');
  }

  level.spawnPoints.forEach((spawn) => {
    if (level.blockedGrid[spawn.y]?.[spawn.x]) {
      errors.push(`Monster spawn ${spawn.x},${spawn.y} is blocked.`);
      return;
    }
    const goals = level.protectedTargets.flatMap((target) => target.attackCells);
    const path = findGridPath(level.walkableGrid, spawn, goals);
    if (!path) {
      errors.push(`Monster spawn ${spawn.x},${spawn.y} cannot reach any protected building.`);
    }
  });

  if (level.playerSpawn) {
    level.chests.forEach((chest) => {
      const path = findGridPath(level.walkableGrid, level.playerSpawn as GridPoint, [chest.grid]);
      if (!path) {
        warnings.push(`Chest ${chest.grid.x},${chest.grid.y} is not reachable from player spawn.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
};
