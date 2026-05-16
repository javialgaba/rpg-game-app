import type {
  AssetRegistry,
  AssetRegistryEntry,
  AssetRenderMetadata,
  Footprint,
  GeneratedLevel,
  GridPoint,
  LevelConfig,
  LevelPlacement,
  LevelToken,
  LevelValidationResult,
  ProtectedTargetPlacement,
} from './levelTypes';
import { findGridPath, pathCost } from './pathfinding';
import { SeededRandom } from './seededRandom';

const PROTECTED_EDGE_PADDING = 4;
const MIN_SPAWN_TARGET_PATH = 10;
const FULL_TREE_FRAMES = new Set(['world-pine-full', 'world-tree-oak']);
const PARTIAL_TREE_FRAMES = new Set(['world-forest-cluster', 'world-pine']);

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

const isOuterEdgeCell = (point: GridPoint, width: number, height: number) => (
  point.x === 0 || point.y === 0 || point.x === width - 1 || point.y === height - 1
);

const getEdgeDistance = (point: GridPoint, width: number, height: number) => Math.min(
  point.x,
  point.y,
  width - 1 - point.x,
  height - 1 - point.y,
);

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

const getCardinalNeighborCells = (point: GridPoint) => [
  { x: point.x + 1, y: point.y },
  { x: point.x - 1, y: point.y },
  { x: point.x, y: point.y + 1 },
  { x: point.x, y: point.y - 1 },
];

const canCarveRoadToken = (token: LevelToken | undefined) => (
  token === 'G' || token === 'D' || token === 'P' || token === 'V' || token === 'PS'
);

const isRoadToken = (token: LevelToken | undefined) => (
  token === 'P' || token === 'V' || token === 'PS'
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
  if (entry.token === 'SP') {
    return registry.SP;
  }
  if (entry.token === 'T') {
    return registry.G;
  }
  return registry.G;
};

const createRoadPlan = (
  config: LevelConfig,
  registry: AssetRegistry,
) => {
  const matrix = config.matrix.map((row) => [...row]);
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  const blockedGrid = makeGrid(width, height, false);
  const warnings: string[] = [];
  const protectedAnchors: GridPoint[] = [];
  const utilityAnchors: GridPoint[] = [];
  const chestAnchors: GridPoint[] = [];
  let playerSpawn: GridPoint | null = null;

  matrix.forEach((row, y) => {
    row.forEach((token, x) => {
      const entry = registry[token];
      if (!entry) {
        return;
      }
      if (token === 'PS') {
        playerSpawn = { x, y };
      }
      if (entry.protected) {
        protectedAnchors.push({ x, y });
      } else if (token === 'W') {
        utilityAnchors.push({ x, y });
      } else if (token === 'CH') {
        chestAnchors.push({ x, y });
      }
      if (!entry.blocksMovement) {
        return;
      }
      getAnchorFootprintCells({ x, y }, entry.footprint ?? { w: 1, h: 1 }).forEach((cell) => {
        if (isInside(cell, width, height)) {
          blockedGrid[cell.y][cell.x] = true;
        }
      });
    });
  });

  const center = playerSpawn ?? { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const isRoadable = (point: GridPoint) => (
    isInside(point, width, height)
    && !blockedGrid[point.y][point.x]
    && canCarveRoadToken(matrix[point.y]?.[point.x])
  );
  const walkableForRoads = blockedGrid.map((row) => row.map((blocked) => !blocked));

  const carveRoadCell = (point: GridPoint) => {
    if (!isRoadable(point)) {
      return;
    }
    const token = matrix[point.y][point.x];
    if (token === 'G' || token === 'D' || token === 'V') {
      matrix[point.y][point.x] = 'P';
    }
  };

  const findConnectionCells = (anchor: GridPoint) => {
    const entry = registry[matrix[anchor.y]?.[anchor.x]];
    const cells = getAnchorFootprintCells(anchor, entry?.footprint ?? { w: 1, h: 1 });
    const seen = new Set<string>();
    const candidates = cells.flatMap(getCardinalNeighborCells)
      .filter(isRoadable)
      .filter((candidate) => {
        const key = pointKey(candidate);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((a, b) => (
        Math.abs(a.x - center.x) + Math.abs(a.y - center.y)
        - (Math.abs(b.x - center.x) + Math.abs(b.y - center.y))
      ));
    return candidates.length > 0 ? candidates : (isRoadable(anchor) ? [anchor] : []);
  };

  const connectTo = (anchor: GridPoint, label: string) => {
    const endpoints = findConnectionCells(anchor);
    if (!endpoints.length || !isRoadable(center)) {
      warnings.push(`Road generator could not connect ${label} at ${pointKey(anchor)}.`);
      return;
    }
    const path = endpoints
      .map((endpoint) => findGridPath(walkableForRoads, center, [endpoint]))
      .filter(Boolean)
      .sort((a, b) => pathCost(a) - pathCost(b))[0];
    if (!path) {
      warnings.push(`Road generator could not find a route to ${label} at ${pointKey(anchor)}.`);
      return;
    }
    path.forEach(carveRoadCell);
  };

  [...protectedAnchors, ...utilityAnchors, ...chestAnchors].forEach((anchor) => {
    connectTo(anchor, matrix[anchor.y]?.[anchor.x] ?? 'target');
  });

  const roadGrid = makeGrid(width, height, false);
  matrix.forEach((row, y) => {
    row.forEach((token, x) => {
      roadGrid[y][x] = isRoadToken(token);
    });
  });

  return { matrix, roadGrid, warnings };
};

export const generateLevel = (config: LevelConfig, registry: AssetRegistry) => {
  const roadPlan = createRoadPlan(config, registry);
  const generatedConfig = { ...config, matrix: roadPlan.matrix };
  const height = generatedConfig.matrix.length;
  const width = generatedConfig.matrix[0]?.length ?? 0;
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
  warnings.push(...roadPlan.warnings);

  generatedConfig.matrix.forEach((row, y) => {
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
  const attackCellKeys = new Set(protectedTargets.flatMap((target) => target.attackCells.map(pointKey)));
  const canDecorate = (grid: GridPoint) => {
    if (!isInside(grid, width, height)) {
      return false;
    }
    const token = generatedConfig.matrix[grid.y]?.[grid.x];
    const distanceFromCenter = Math.abs(grid.x - center.x) + Math.abs(grid.y - center.y);
    if (
      blockedGrid[grid.y][grid.x]
      || attackCellKeys.has(pointKey(grid))
      || spawnGrid[grid.y][grid.x]
      || decorationGrid[grid.y][grid.x]
      || roadPlan.roadGrid[grid.y][grid.x]
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
  const saplingRender: AssetRenderMetadata = {
    textureKey: 'worldSheet',
    frameKey: 'world-pine-full',
    displaySize: [68, 102],
    origin: [0.5, 0.84],
    alpha: 0.82,
    z: 11,
  };
  const fullTreeRender: AssetRenderMetadata = {
    textureKey: 'worldSheet',
    frameKey: 'world-pine-full',
    displaySize: [82, 124],
    origin: [0.5, 0.84],
    alpha: 0.86,
    z: 12,
  };
  const oakTreeRender: AssetRenderMetadata = {
    textureKey: 'worldSheet',
    frameKey: 'world-tree-oak',
    displaySize: [106, 122],
    origin: [0.5, 0.84],
    alpha: 0.84,
    z: 12,
  };
  const lampRender: AssetRenderMetadata = {
    textureKey: 'worldSheet',
    frameKey: 'world-lamp',
    displaySize: [30, 70],
    origin: [0.5, 0.86],
    alpha: 0.86,
    z: 9,
  };
  const fenceRender: AssetRenderMetadata = {
    textureKey: 'worldSheet',
    frameKey: 'world-fence',
    displaySize: [70, 46],
    origin: [0.5, 0.82],
    alpha: 0.84,
    z: 8,
  };
  const signRender: AssetRenderMetadata = {
    textureKey: 'worldSheet',
    frameKey: 'world-sign',
    displaySize: [54, 64],
    origin: [0.5, 0.86],
    alpha: 0.86,
    z: 9,
  };

  terrain.forEach((placement) => {
    const token = generatedConfig.matrix[placement.grid.y]?.[placement.grid.x];
    if ((token === 'G' || token === 'D') && rng.chance(config.decorationDensity * 0.08)) {
      addDecoration(placement.grid, 'flowers', 'Tiny Flowers');
    }
  });

  protectedTargets.forEach((target) => {
    getNeighborCells(target.grid, 2).forEach((cell) => {
      if (rng.chance(config.decorationDensity * 0.18)) {
        addDecoration(cell, 'flowers', `${target.label} Flower Patch`);
      }
      if ((target.token === 'H1' || target.token === 'H2' || target.token === 'M') && rng.chance(config.decorationDensity * 0.13)) {
        addDecoration(cell, 'fence', `${target.label} Fence`, fenceRender);
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
    const token = generatedConfig.matrix[placement.grid.y]?.[placement.grid.x];
    const isEdge = placement.grid.x <= 1
      || placement.grid.y <= 1
      || placement.grid.x >= width - 2
      || placement.grid.y >= height - 2;
    if (token === 'G' && isEdge && rng.chance(config.decorationDensity * 0.12)) {
      addDecoration(placement.grid, 'magicPlant', 'Glowing Edge Sprout', magicPlantRender);
    }
    if (token === 'G' && isEdge && rng.chance(config.decorationDensity * 0.58)) {
      addDecoration(
        placement.grid,
        rng.chance(0.7) ? 'fullTree' : 'sapling',
        'Forest Edge Tree',
        rng.chance(0.18) ? oakTreeRender : fullTreeRender,
      );
    }
    if (token === 'G' && !isEdge && rng.chance(config.decorationDensity * 0.16)) {
      addDecoration(placement.grid, 'sapling', 'Young Pine', saplingRender);
    }
    if (token === 'G' && rng.chance(config.decorationDensity * 0.05)) {
      addDecoration(placement.grid, 'sparkles', 'Fairy Sparkles');
    }
  });

  terrain.forEach((placement) => {
    if (!roadPlan.roadGrid[placement.grid.y]?.[placement.grid.x]) {
      return;
    }
    const roadNeighbors = getCardinalNeighborCells(placement.grid)
      .filter((cell) => isInside(cell, width, height) && roadPlan.roadGrid[cell.y][cell.x]);
    getCardinalNeighborCells(placement.grid).forEach((cell) => {
      if (roadNeighbors.length >= 3 && rng.chance(config.decorationDensity * 0.08)) {
        addDecoration(cell, 'sign', 'Village Sign', signRender);
      } else if (rng.chance(config.decorationDensity * 0.06)) {
        addDecoration(cell, 'lamp', 'Path Lamp', lampRender);
      }
    });
  });

  return {
    config: generatedConfig,
    width,
    height,
    walkableGrid,
    blockedGrid,
    buildingGrid,
    decorationGrid,
    spawnGrid,
    targetGrid,
    roadGrid: roadPlan.roadGrid,
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
    if (!isOuterEdgeCell(spawn, level.width, level.height)) {
      errors.push(`Monster spawn ${spawn.x},${spawn.y} must be on the outer map edge.`);
    }
    const path = findGridPath(level.walkableGrid, spawn, allAttackCells);
    if (!path) {
      errors.push(`Monster spawn ${spawn.x},${spawn.y} cannot reach any protected building.`);
    } else if (pathCost(path) < MIN_SPAWN_TARGET_PATH) {
      warnings.push(`Monster spawn ${spawn.x},${spawn.y} is too close to protected targets (${pathCost(path)} steps).`);
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
    const edgeDistance = Math.min(...target.cells.map((cell) => getEdgeDistance(cell, level.width, level.height)));
    if (edgeDistance < PROTECTED_EDGE_PADDING) {
      errors.push(`${target.label} must be at least ${PROTECTED_EDGE_PADDING} cells from the map edge.`);
    }
    if (!target.attackCells.length) {
      errors.push(`${target.label} has no attack cells.`);
    }
    if (!target.attackCells.some((cell) => level.roadGrid[cell.y]?.[cell.x])) {
      errors.push(`${target.label} needs at least one adjacent walkway cell.`);
    }
    const reachableFromAnySpawn = level.spawnPoints.some((spawn) => (
      isInsideLevel(level, spawn) && Boolean(findGridPath(level.walkableGrid, spawn, target.attackCells))
    ));
    if (!reachableFromAnySpawn) {
      warnings.push(`${target.label} cannot currently be reached by any monster spawn.`);
    }
  });

  if (level.playerSpawn) {
    level.protectedTargets.forEach((target) => {
      if (!findGridPath(level.walkableGrid, level.playerSpawn as GridPoint, target.attackCells)) {
        errors.push(`Player spawn cannot reach ${target.label}.`);
      }
    });

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

  [...level.objects, ...level.decorations].forEach((placement) => {
    if (!isInsideLevel(level, placement.grid)) {
      errors.push(`${placement.label} is outside board bounds.`);
    }
    const frameKey = placement.render?.frameKey;
    if ((placement.token === 'T' || placement.decorationKind === 'sapling' || placement.decorationKind === 'fullTree') && !FULL_TREE_FRAMES.has(frameKey ?? '')) {
      errors.push(`${placement.label} must use a full-tree frame, not ${frameKey ?? 'an unnamed frame'}.`);
    }
    if (frameKey && PARTIAL_TREE_FRAMES.has(frameKey) && placement.decorationKind !== 'fullTree') {
      errors.push(`${placement.label} uses clipped frame ${frameKey} as a normal prop.`);
    }
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
