import type {
  AssetRegistry,
  AssetRegistryEntry,
  AssetRenderMetadata,
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

const isInsideLevel = (level: GeneratedLevel, point: GridPoint) => isInside(point, level.width, level.height);

const pointKey = (point: GridPoint) => `${point.x},${point.y}`;

const getNeighborCells = (point: GridPoint, radius = 1) => {
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

  const center = { x: width / 2, y: height / 2 };
  const canDecorate = (grid: GridPoint) => {
    if (!isInside(grid, width, height)) {
      return false;
    }
    const token = config.matrix[grid.y]?.[grid.x];
    const distanceFromCenter = Math.abs(grid.x - center.x) + Math.abs(grid.y - center.y);
    if (
      blockedGrid[grid.y][grid.x]
      || spawnGrid[grid.y][grid.x]
      || decorationGrid[grid.y][grid.x]
      || token === 'P'
      || token === 'V'
      || token === 'PS'
      || token === 'SP'
      || token === 'CH'
      || (playerSpawn && grid.x === playerSpawn.x && grid.y === playerSpawn.y)
      || distanceFromCenter < 2.6
    ) {
      return false;
    }
    return true;
  };

  const addDecoration = (
    grid: GridPoint,
    decorationKind: NonNullable<LevelPlacement['decorationKind']>,
    label: string,
    render?: AssetRenderMetadata,
  ) => {
    if (!canDecorate(grid)) {
      return false;
    }
    const decoration = {
      ...createPlacement(`deco-${decorationKind}-${grid.x}-${grid.y}-${decorations.length}`, 'D', registry.D, grid),
      label,
      decorationKind,
      render,
      blocksMovement: false,
    } satisfies LevelPlacement;
    decorations.push(decoration);
    decorationGrid[grid.y][grid.x] = decoration;
    return true;
  };

  const mushroomRender: AssetRenderMetadata = {
    textureKey: 'worldSheet',
    frameKey: 'world-mushroom',
    displaySize: [46, 42],
    origin: [0.5, 0.84],
    alpha: 0.86,
    z: 7,
  };
  const magicPlantRender: AssetRenderMetadata = {
    textureKey: 'worldSheet',
    frameKey: 'world-magic-plant',
    displaySize: [44, 62],
    origin: [0.5, 0.86],
    alpha: 0.82,
    z: 8,
  };

  terrain.forEach((placement) => {
    const token = config.matrix[placement.grid.y]?.[placement.grid.x];
    if ((token === 'G' || token === 'D') && rng.chance(config.decorationDensity * 0.08)) {
      addDecoration(placement.grid, 'flowers', 'Tiny Flowers');
    }
  });

  protectedTargets.forEach((target) => {
    target.attackCells.forEach((cell) => {
      if (rng.chance(config.decorationDensity * 0.22)) {
        addDecoration(cell, 'flowers', `${target.label} Flower Patch`);
      }
    });
  });

  objects
    .filter((placement) => placement.token === 'T')
    .forEach((tree) => {
      getNeighborCells(tree.grid, 1).forEach((cell) => {
        if (!rng.chance(config.decorationDensity * 0.18)) {
          return;
        }
        const isMagicPlant = rng.chance(0.28);
        addDecoration(
          cell,
          isMagicPlant ? 'magicPlant' : 'mushrooms',
          isMagicPlant ? 'Glowing Forest Sprout' : 'Mushroom Cluster',
          isMagicPlant ? magicPlantRender : mushroomRender,
        );
      });
    });

  terrain.forEach((placement) => {
    const token = config.matrix[placement.grid.y]?.[placement.grid.x];
    const isEdge = placement.grid.x <= 1
      || placement.grid.y <= 1
      || placement.grid.x >= width - 2
      || placement.grid.y >= height - 2;
    if (token === 'G' && isEdge && rng.chance(config.decorationDensity * 0.12)) {
      addDecoration(placement.grid, 'magicPlant', 'Glowing Edge Sprout', magicPlantRender);
    }
    if (token === 'G' && rng.chance(config.decorationDensity * 0.035)) {
      addDecoration(placement.grid, 'sparkles', 'Fairy Sparkles');
    }
  });

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
  const protectedIds = new Set<string>();

  if (level.width <= 0 || level.height <= 0) {
    errors.push('Level dimensions must be greater than zero.');
  }
  if (!level.playerSpawn) {
    errors.push('Player spawn is missing.');
  } else if (!isInsideLevel(level, level.playerSpawn)) {
    errors.push(`Player spawn ${level.playerSpawn.x},${level.playerSpawn.y} is outside level bounds.`);
  } else if (level.blockedGrid[level.playerSpawn.y]?.[level.playerSpawn.x]) {
    errors.push('Player spawn is blocked.');
  }
  if (!level.spawnPoints.length) {
    errors.push('At least one monster spawn is required.');
  }
  if (!level.protectedTargets.length) {
    errors.push('At least one protected building is required.');
  }
  if (!level.protectedTargets.some((target) => target.token === 'C')) {
    errors.push('A castle token (C) is required for this defense mode.');
  }

  const allAttackCells = level.protectedTargets.flatMap((target) => target.attackCells);
  level.spawnPoints.forEach((spawn) => {
    if (!isInsideLevel(level, spawn)) {
      errors.push(`Monster spawn ${spawn.x},${spawn.y} is outside level bounds.`);
      return;
    }
    if (level.blockedGrid[spawn.y]?.[spawn.x]) {
      errors.push(`Monster spawn ${spawn.x},${spawn.y} is blocked.`);
      return;
    }
    const path = findGridPath(level.walkableGrid, spawn, allAttackCells);
    if (!path) {
      errors.push(`Monster spawn ${spawn.x},${spawn.y} cannot reach any protected building.`);
    }
  });

  level.protectedTargets.forEach((target) => {
    if (protectedIds.has(target.id)) {
      errors.push(`Duplicate protected target id ${target.id}.`);
    }
    protectedIds.add(target.id);

    const invalidCells = target.cells.filter((cell) => !isInsideLevel(level, cell));
    if (invalidCells.length > 0) {
      errors.push(`${target.label} has footprint cells outside the level bounds.`);
    }
    if (!target.attackCells.length) {
      errors.push(`${target.label} has no attack cells.`);
    }
    const reachableFromAnySpawn = level.spawnPoints.some((spawn) => (
      isInsideLevel(level, spawn) && Boolean(findGridPath(level.walkableGrid, spawn, target.attackCells))
    ));
    if (!reachableFromAnySpawn) {
      warnings.push(`${target.label} cannot currently be reached by any monster spawn.`);
    }
  });

  if (level.playerSpawn) {
    const reachableTargets = level.protectedTargets.filter((target) => (
      Boolean(findGridPath(level.walkableGrid, level.playerSpawn as GridPoint, target.attackCells))
    ));
    if (!reachableTargets.length && level.protectedTargets.length > 0) {
      warnings.push('Player spawn cannot reach any protected building attack zone.');
    }

    level.chests.forEach((chest) => {
      const path = findGridPath(level.walkableGrid, level.playerSpawn as GridPoint, [chest.grid]);
      if (!path) {
        warnings.push(`Chest ${chest.grid.x},${chest.grid.y} is not reachable from player spawn.`);
      }
    });
  }

  const blockedDecorationCells = level.decorations.filter((decoration) => (
    !isInsideLevel(level, decoration.grid)
    || level.blockedGrid[decoration.grid.y]?.[decoration.grid.x]
    || level.spawnGrid[decoration.grid.y]?.[decoration.grid.x]
  ));
  blockedDecorationCells.forEach((decoration) => {
    warnings.push(`${decoration.label} decoration at ${pointKey(decoration.grid)} is on a blocked or spawn cell.`);
  });

  if (!level.chests.length) {
    warnings.push('No treasure chests are placed in this level.');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
};
