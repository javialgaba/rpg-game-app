import type {
  AssetRegistry,
  AssetRegistryEntry,
  AssetRenderMetadata,
  Footprint,
  GeneratedLevel,
  GridPoint,
  LevelConfig,
  LevelToken,
  LevelPlacement,
  LevelValidationResult,
  PlayableBounds,
  ProtectedTargetPlacement,
} from './levelTypes';
import { findGridPath, pathCost } from './pathfinding';
import { buildPlayerReachableGrid, buildPlayerWalkableGrid, getPlayerPocketCells } from './playerFootprint';
import { SeededRandom } from './seededRandom';

const PROTECTED_EDGE_PADDING = 4;
const MIN_SPAWN_TARGET_PATH = 10;
const MIN_BUILDING_FOOTPRINT_DISTANCE = 3;
const BUILDING_CLEARANCE_TOKENS = new Set<LevelToken>(['castle', 'house-1', 'house-2', 'market', 'well']);
const FULL_TREE_FRAMES = new Set(['pine_tree_01', 'oak_tree_01']);
const PARTIAL_TREE_FRAMES = new Set(['world-forest-cluster', 'world-pine']);
const VALID_TERRAIN_FRAMES = new Set(['grass_01', 'grass_02', 'stone_path_01', 'flower_bed_01']);
const BLOCKING_DECORATION_KINDS = new Set<NonNullable<LevelPlacement['decorationKind']>>([
  'rocks',
  'sapling',
  'fullTree',
  'treeCluster',
  'puddle',
]);

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

const resolvePlayableBounds = (config: LevelConfig): PlayableBounds => {
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

const isInsidePlayableBounds = (point: GridPoint, bounds: PlayableBounds) => (
  point.x >= bounds.minX
  && point.y >= bounds.minY
  && point.x <= bounds.maxX
  && point.y <= bounds.maxY
);

const isPlayableBoundsEdgeCell = (point: GridPoint, bounds: PlayableBounds) => (
  point.x === bounds.minX
  || point.y === bounds.minY
  || point.x === bounds.maxX
  || point.y === bounds.maxY
);

const getEdgeDistance = (point: GridPoint, width: number, height: number) => Math.min(
  point.x,
  point.y,
  width - 1 - point.x,
  height - 1 - point.y,
);

const getBoundsEdgeDistance = (point: GridPoint, bounds: PlayableBounds) => Math.min(
  point.x - bounds.minX,
  point.y - bounds.minY,
  bounds.maxX - point.x,
  bounds.maxY - point.y,
);

const pointKey = (point: GridPoint) => `${point.x},${point.y}`;

const getCellDistance = (a: GridPoint, b: GridPoint) => Math.max(
  Math.abs(a.x - b.x),
  Math.abs(a.y - b.y),
);

const getFootprintDistance = (a: GridPoint[], b: GridPoint[]) => (
  a.reduce((best, aCell) => Math.min(
    best,
    b.reduce((cellBest, bCell) => Math.min(cellBest, getCellDistance(aCell, bCell)), Infinity),
  ), Infinity)
);

const shouldEnforceBuildingClearance = (placement: LevelPlacement) => (
  BUILDING_CLEARANCE_TOKENS.has(placement.token)
);

const getBuildingClearanceErrors = (placements: LevelPlacement[]) => {
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
  token === 'grass'
  || token === 'decoration'
  || token === 'path'
  || token === 'village-center'
  || token === 'player-spawn'
);

const isRoadToken = (token: LevelToken | undefined) => (
  token === 'path' || token === 'village-center' || token === 'player-spawn'
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
  const iso = {
    x: cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length,
    y: cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length,
  };
  return {
    id,
    token,
    label: entry.label,
    type: entry.type,
    grid: clonePoint(grid),
    iso,
    footprint,
    cells,
    render: entry.render,
    blocksMovement: entry.blocksMovement,
  } satisfies LevelPlacement;
};

const getTerrainEntry = (entry: AssetRegistryEntry, registry: AssetRegistry) => {
  if (entry.type === 'path' || entry.token === 'village-center' || entry.token === 'player-spawn') {
    return registry.path;
  }
  if (entry.token === 'decoration') {
    return registry.decoration;
  }
  if (entry.token === 'monster-spawn') {
    return registry['monster-spawn'];
  }
  if (entry.token === 'tree') {
    return registry.grass;
  }
  return registry.grass;
};

const createRoadPlan = (
  config: LevelConfig,
  registry: AssetRegistry,
) => {
  const matrix = config.matrix.map((row) => [...row]);
  const height = matrix.length;
  const width = matrix[0]?.length ?? 0;
  const playableBounds = resolvePlayableBounds(config);
  const blockedGrid = makeGrid(width, height, false);
  const warnings: string[] = [];
  const protectedAnchors: GridPoint[] = [];
  const utilityAnchors: GridPoint[] = [];
  const villageCenters: GridPoint[] = [];
  const requiredRoadKeys = new Set<string>();
  let playerSpawn: GridPoint | null = null;

  matrix.forEach((row, y) => {
    row.forEach((token, x) => {
      if (!isInsidePlayableBounds({ x, y }, playableBounds)) {
        return;
      }
      const entry = registry[token];
      if (!entry) {
        return;
      }
      if (token === 'player-spawn') {
        playerSpawn = { x, y };
      } else if (token === 'village-center') {
        villageCenters.push({ x, y });
      }
      if (entry.protected) {
        protectedAnchors.push({ x, y });
      } else if (token === 'well') {
        utilityAnchors.push({ x, y });
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

  const center = villageCenters[0] ?? playerSpawn ?? {
    x: Math.floor((playableBounds.minX + playableBounds.maxX) / 2),
    y: Math.floor((playableBounds.minY + playableBounds.maxY) / 2),
  };
  const isRoadable = (point: GridPoint) => (
    isInside(point, width, height)
    && isInsidePlayableBounds(point, playableBounds)
    && !blockedGrid[point.y][point.x]
    && canCarveRoadToken(matrix[point.y]?.[point.x])
  );
  const walkableForRoads = blockedGrid.map((row, y) => row.map((blocked, x) => (
    !blocked
    && isInsidePlayableBounds({ x, y }, playableBounds)
    && canCarveRoadToken(matrix[y]?.[x])
  )));

  const markRoadCell = (point: GridPoint) => {
    if (!isRoadable(point)) {
      return;
    }
    requiredRoadKeys.add(pointKey(point));
    const token = matrix[point.y][point.x];
    if (token === 'grass' || token === 'decoration' || token === 'path' || token === 'village-center') {
      matrix[point.y][point.x] = 'path';
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
    path.forEach(markRoadCell);
  };

  if (playerSpawn && isRoadable(center)) {
    const path = findGridPath(walkableForRoads, playerSpawn, [center]);
    if (path) {
      path.forEach(markRoadCell);
    } else {
      warnings.push(`Road generator could not connect player spawn at ${pointKey(playerSpawn)} to the village hub.`);
    }
  }
  [...protectedAnchors, ...utilityAnchors].forEach((anchor) => {
    connectTo(anchor, matrix[anchor.y]?.[anchor.x] ?? 'target');
  });

  const roadGrid = makeGrid(width, height, false);
  matrix.forEach((row, y) => {
    row.forEach((token, x) => {
      if ((token === 'path' || token === 'village-center') && !requiredRoadKeys.has(pointKey({ x, y }))) {
        matrix[y][x] = 'grass';
      }
      roadGrid[y][x] = isRoadToken(matrix[y][x]) && (
        requiredRoadKeys.has(pointKey({ x, y }))
        || matrix[y][x] === 'player-spawn'
      );
    });
  });

  return { matrix, roadGrid, warnings };
};

export const generateLevel = (config: LevelConfig, registry: AssetRegistry) => {
  const roadPlan = createRoadPlan(config, registry);
  const generatedConfig = { ...config, matrix: roadPlan.matrix };
  const height = generatedConfig.matrix.length;
  const width = generatedConfig.matrix[0]?.length ?? 0;
  const playableBounds = resolvePlayableBounds(generatedConfig);
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
  const spawnPoints: GridPoint[] = [];
  const protectedTargets: ProtectedTargetPlacement[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let playerSpawn: GridPoint | null = null;
  warnings.push(...roadPlan.warnings);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isInsidePlayableBounds({ x, y }, playableBounds)) {
        walkableGrid[y][x] = false;
        blockedGrid[y][x] = true;
      }
    }
  }

  generatedConfig.matrix.forEach((row, y) => {
    if (row.length !== width) {
      errors.push(`Row ${y} has ${row.length} cells; expected ${width}.`);
    }
    row.forEach((token, x) => {
      if (!isInsidePlayableBounds({ x, y }, playableBounds)) {
        return;
      }
      const entry = registry[token];
      if (!entry) {
        errors.push(`Unknown token ${token} at ${x},${y}.`);
        return;
      }

      const terrainEntry = getTerrainEntry(entry, registry);
      terrain.push(createPlacement(`terrain-${x}-${y}`, terrainEntry.token, terrainEntry, { x, y }));

      if (token === 'player-spawn') {
        playerSpawn = { x, y };
      }
      if (token === 'monster-spawn') {
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
      } else {
        objects.push(placement);
      }
    });
  });

  errors.push(...getBuildingClearanceErrors(objects));

  protectedTargets.forEach((target) => {
    target.attackCells = getAttackCells(target.cells, blockedGrid, width, height);
    if (!target.attackCells.length) {
      errors.push(`${target.label} has no reachable attack cells.`);
    }
  });

  if (!playerSpawn) {
    warnings.push('No player-spawn token found; using village center fallback.');
    playerSpawn = {
      x: Math.floor((playableBounds.minX + playableBounds.maxX) / 2),
      y: Math.floor((playableBounds.minY + playableBounds.maxY) / 2),
    };
  }

  if (!spawnPoints.length) {
    warnings.push('No monster-spawn tokens found; using edge fallback spawns.');
    spawnPoints.push(
      { x: playableBounds.minX, y: Math.floor((playableBounds.minY + playableBounds.maxY) / 2) },
      { x: Math.floor((playableBounds.minX + playableBounds.maxX) / 2), y: playableBounds.minY },
      { x: playableBounds.maxX, y: Math.floor((playableBounds.minY + playableBounds.maxY) / 2) },
      { x: Math.floor((playableBounds.minX + playableBounds.maxX) / 2), y: playableBounds.maxY },
    );
  }

  const center = {
    x: (playableBounds.minX + playableBounds.maxX) / 2,
    y: (playableBounds.minY + playableBounds.maxY) / 2,
  };
  const attackCellKeys = new Set(protectedTargets.flatMap((target) => target.attackCells.map(pointKey)));
  const canDecorate = (grid: GridPoint, options?: { allowNearEdge?: boolean; blocksMovement?: boolean }) => {
    if (!isInside(grid, width, height) || !isInsidePlayableBounds(grid, playableBounds)) {
      return false;
    }
    const token = generatedConfig.matrix[grid.y]?.[grid.x];
    const distanceFromCenter = Math.abs(grid.x - center.x) + Math.abs(grid.y - center.y);
    const edgeDistance = getBoundsEdgeDistance(grid, playableBounds);
    if (
      blockedGrid[grid.y][grid.x]
      || attackCellKeys.has(pointKey(grid))
      || spawnGrid[grid.y][grid.x]
      || decorationGrid[grid.y][grid.x]
      || roadPlan.roadGrid[grid.y][grid.x]
      || (!options?.allowNearEdge && edgeDistance < 4)
      || (options?.allowNearEdge && edgeDistance < 1)
      || token === 'path'
      || token === 'village-center'
      || token === 'player-spawn'
      || token === 'monster-spawn'
      || (playerSpawn && grid.x === playerSpawn.x && grid.y === playerSpawn.y)
      || (options?.blocksMovement && playerSpawn && getCellDistance(grid, playerSpawn) <= 1)
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
    options?: { allowNearEdge?: boolean; blocksMovement?: boolean },
  ) => {
    const blocksMovement = options?.blocksMovement ?? BLOCKING_DECORATION_KINDS.has(decorationKind);
    if (!canDecorate(grid, { ...options, blocksMovement })) {
      return false;
    }
    const decoration = {
      ...createPlacement(
        `deco-${decorationKind}-${grid.x}-${grid.y}-${decorations.length}`,
        'decoration',
        registry.decoration,
        grid,
      ),
      label,
      decorationKind,
      render,
      blocksMovement,
    } satisfies LevelPlacement;
    decorations.push(decoration);
    decorationGrid[grid.y][grid.x] = decoration;
    if (blocksMovement) {
      blockedGrid[grid.y][grid.x] = true;
      walkableGrid[grid.y][grid.x] = false;
      const candidatePlayerGrid = buildPlayerWalkableGrid(walkableGrid, playableBounds);
      const candidateReachableGrid = buildPlayerReachableGrid(candidatePlayerGrid, playerSpawn);
      if (getPlayerPocketCells(candidatePlayerGrid, candidateReachableGrid).length > 0) {
        blockedGrid[grid.y][grid.x] = false;
        walkableGrid[grid.y][grid.x] = true;
        decorationGrid[grid.y][grid.x] = null;
        decorations.pop();
        return false;
      }
    }
    return true;
  };

  const magicPlantRender: AssetRenderMetadata = {
    textureKey: 'worldTilesAtlas',
    frameKey: 'magic_plant_01',
    displaySize: [119, 115],
    origin: [0.5, 0.86],
    alpha: 1,
    z: 8,
  };
  const saplingRender: AssetRenderMetadata = {
    textureKey: 'worldTilesAtlas',
    frameKey: 'pine_tree_01',
    displaySize: [168, 144],
    origin: [0.5, 0.84],
    alpha: 1,
    z: 11,
  };
  const fullTreeRender: AssetRenderMetadata = {
    textureKey: 'worldTilesAtlas',
    frameKey: 'pine_tree_01',
    displaySize: [204, 175],
    origin: [0.5, 0.84],
    alpha: 1,
    z: 12,
  };
  const oakTreeRender: AssetRenderMetadata = {
    textureKey: 'worldTilesAtlas',
    frameKey: 'oak_tree_01',
    displaySize: [135, 140],
    origin: [0.5, 0.84],
    alpha: 1,
    z: 12,
  };
  const signRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'sign_post',
    displaySize: [136, 156],
    origin: [0.5, 0.86],
    alpha: 1,
    z: 9,
  };
  const flowerPatchRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'flower_patch_wild',
    displaySize: [150, 118],
    origin: [0.5, 0.84],
    alpha: 1,
    z: 7,
  };
  const grassPatchRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'grass_tuft_patch',
    displaySize: [148, 114],
    origin: [0.5, 0.84],
    alpha: 1,
    z: 7,
  };
  const rockClusterRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'rock_cluster_round',
    displaySize: [142, 124],
    origin: [0.5, 0.84],
    alpha: 1,
    z: 8,
  };
  const puddleRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'pond_tile',
    displaySize: [138, 110],
    origin: [0.5, 0.72],
    alpha: 0.92,
    z: 3,
  };
  const mushroomPatchRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'mushroom_patch',
    displaySize: [148, 126],
    origin: [0.5, 0.84],
    alpha: 1,
    z: 8,
  };
  const bushRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'bush_foreground',
    displaySize: [162, 128],
    origin: [0.5, 0.84],
    alpha: 1,
    z: 9,
  };
  const treeClusterRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'tree_cluster_edge',
    displaySize: [228, 212],
    origin: [0.5, 0.86],
    alpha: 1,
    z: 11,
  };
  const lanternRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'lantern_post',
    displaySize: [108, 158],
    origin: [0.5, 0.86],
    alpha: 1,
    z: 9,
  };
  const fenceSegmentRender: AssetRenderMetadata = {
    textureKey: 'environmentFrameAtlas',
    frameKey: 'fence_segment',
    displaySize: [150, 116],
    origin: [0.5, 0.84],
    alpha: 1,
    z: 8,
  };

  terrain.forEach((placement) => {
    const token = generatedConfig.matrix[placement.grid.y]?.[placement.grid.x];
    if ((token === 'grass' || token === 'decoration') && rng.chance(config.decorationDensity * 0.15)) {
      const roll = rng.next();
      if (roll < 0.52) {
        addDecoration(placement.grid, 'flowers', 'Wildflower Patch', flowerPatchRender);
      } else if (roll < 0.8) {
        addDecoration(placement.grid, 'grassPatch', 'Soft Grass Tuft', grassPatchRender);
      } else {
        addDecoration(placement.grid, 'rocks', 'Gentle Rock Cluster', rockClusterRender);
      }
    }
  });

  protectedTargets.forEach((target) => {
    getNeighborCells(target.grid, 2).forEach((cell) => {
      if (rng.chance(config.decorationDensity * 0.16)) {
        const render = rng.chance(0.68) ? flowerPatchRender : bushRender;
        addDecoration(cell, render === bushRender ? 'bush' : 'flowers', `${target.label} Garden`, render);
      }
      if ((target.token === 'house-1' || target.token === 'house-2' || target.token === 'market') && rng.chance(config.decorationDensity * 0.10)) {
        addDecoration(cell, 'fence', `${target.label} Fence`, fenceSegmentRender);
      }
    });
  });

  objects
    .filter((placement) => placement.token === 'tree')
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
          isMagicPlant ? magicPlantRender : mushroomPatchRender,
        );
      });
    });

  terrain.forEach((placement) => {
    const token = generatedConfig.matrix[placement.grid.y]?.[placement.grid.x];
    const edgeDistance = getBoundsEdgeDistance(placement.grid, playableBounds);
    const isNearEdge = edgeDistance <= 2;
    const isInnerEdgeBand = edgeDistance >= 1 && edgeDistance <= 2;
    if (token === 'grass' && isInnerEdgeBand && rng.chance(config.decorationDensity * 0.12)) {
      addDecoration(placement.grid, 'magicPlant', 'Glowing Edge Sprout', magicPlantRender, { allowNearEdge: true });
    }
    if (token === 'grass' && isInnerEdgeBand && rng.chance(config.decorationDensity * 0.42)) {
      const useCluster = rng.chance(0.64);
      const render = useCluster
        ? treeClusterRender
        : (rng.chance(0.18) ? oakTreeRender : fullTreeRender);
      addDecoration(
        placement.grid,
        useCluster ? 'treeCluster' : 'fullTree',
        'Forest Edge Growth',
        render,
        { allowNearEdge: true },
      );
    }
    if (token === 'grass' && isInnerEdgeBand && rng.chance(config.decorationDensity * 0.22)) {
      const edgeRender = rng.chance(0.58) ? bushRender : rockClusterRender;
      addDecoration(
        placement.grid,
        edgeRender === bushRender ? 'bush' : 'rocks',
        'Outer Edge Filler',
        edgeRender,
        { allowNearEdge: true },
      );
    }
    if (token === 'grass' && isNearEdge && rng.chance(config.decorationDensity * 0.1)) {
      addDecoration(placement.grid, 'flowers', 'Soft Edge Flowers', flowerPatchRender, { allowNearEdge: true });
    }
    if (token === 'grass' && !isNearEdge && rng.chance(config.decorationDensity * 0.13)) {
      addDecoration(placement.grid, 'sapling', 'Young Pine', saplingRender);
    }
    if (token === 'grass' && !isNearEdge && rng.chance(config.decorationDensity * 0.045)) {
      addDecoration(placement.grid, 'puddle', 'Rain Puddle', puddleRender);
    }
    if (token === 'grass' && !isNearEdge && rng.chance(config.decorationDensity * 0.10)) {
      const interiorRender = rng.chance(0.52) ? bushRender : flowerPatchRender;
      addDecoration(
        placement.grid,
        interiorRender === bushRender ? 'bush' : 'flowers',
        'Village Green Detail',
        interiorRender,
      );
    }
    if (token === 'grass' && rng.chance(config.decorationDensity * 0.035)) {
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
        addDecoration(cell, 'lamp', 'Path Lamp', lanternRender);
      }
    });
  });

  const playerWalkableGrid = buildPlayerWalkableGrid(walkableGrid, playableBounds);
  const playerReachableGrid = buildPlayerReachableGrid(playerWalkableGrid, playerSpawn);
  const playerPocketCells = getPlayerPocketCells(playerWalkableGrid, playerReachableGrid);

  return {
    config: generatedConfig,
    width,
    height,
    playableBounds,
    walkableGrid,
    playerWalkableGrid,
    playerReachableGrid,
    playerPocketCells,
    blockedGrid,
    buildingGrid,
    decorationGrid,
    spawnGrid,
    targetGrid,
    roadGrid: roadPlan.roadGrid,
    terrain,
    objects,
    decorations,
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
  } else if (!level.playerWalkableGrid[level.playerSpawn.y]?.[level.playerSpawn.x]) {
    errors.push('Player spawn does not support the player footprint.');
  } else {
    const nearbyCells = getNeighborCells(level.playerSpawn, 1)
      .filter((cell) => isInsideLevel(level, cell));
    const walkableClearance = nearbyCells
      .filter((cell) => level.playerWalkableGrid[cell.y]?.[cell.x])
      .length;
    if (walkableClearance < 8) {
      errors.push('Player spawn does not have enough nearby clearance for smooth movement.');
    }
    const playerExitCount = getCardinalNeighborCells(level.playerSpawn)
      .filter((cell) => isInsideLevel(level, cell) && level.playerWalkableGrid[cell.y]?.[cell.x])
      .length;
    if (playerExitCount < 3) {
      errors.push('Player spawn does not have enough open exits for smooth movement.');
    }
    const nearbyBlockedCount = nearbyCells
      .filter((cell) => level.blockedGrid[cell.y]?.[cell.x])
      .length;
    if (nearbyBlockedCount > 4) {
      warnings.push('Player spawn is too close to several blockers.');
    }
  }
  if (!level.spawnPoints.length) {
    errors.push('At least one monster spawn is required.');
  }
  if (!level.protectedTargets.length) {
    errors.push('At least one protected building is required.');
  }
  if (!level.protectedTargets.some((target) => target.token === 'castle')) {
    errors.push('A Castle token is required for this defense mode.');
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
    if (!isPlayableBoundsEdgeCell(spawn, level.playableBounds)) {
      errors.push(`Monster spawn ${spawn.x},${spawn.y} must be on the playable region edge.`);
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
  const attackCellKeys = new Set(level.protectedTargets.flatMap((target) => target.attackCells.map(pointKey)));
  if (level.playerSpawn && attackCellKeys.has(pointKey(level.playerSpawn))) {
    errors.push('Player spawn overlaps a protected building attack zone.');
  }

  if (level.playerSpawn) {
    level.protectedTargets.forEach((target) => {
      const footprintSafeAttackCells = target.attackCells.filter((cell) => level.playerWalkableGrid[cell.y]?.[cell.x]);
      if (!footprintSafeAttackCells.length) {
        errors.push(`${target.label} is only reachable through cells narrower than the player footprint.`);
        return;
      }
      if (!findGridPath(level.playerWalkableGrid, level.playerSpawn as GridPoint, footprintSafeAttackCells)) {
        errors.push(`Player spawn cannot reach ${target.label}.`);
      }
    });

  }
  if (level.playerPocketCells.length > 0) {
    errors.push(`Player clearance contains ${level.playerPocketCells.length} unreachable pocket cell(s).`);
  }

  const blockedDecorationCells = level.decorations.filter((decoration) => (
    !isInsideLevel(level, decoration.grid)
    || level.blockedGrid[decoration.grid.y]?.[decoration.grid.x]
    || level.spawnGrid[decoration.grid.y]?.[decoration.grid.x]
  ));
  blockedDecorationCells.forEach((decoration) => {
    if (!decoration.blocksMovement) {
      warnings.push(`${decoration.label} decoration at ${pointKey(decoration.grid)} is on a blocked or spawn cell.`);
    }
  });

  getBuildingClearanceErrors(level.objects).forEach((error) => {
    if (!errors.includes(error)) {
      errors.push(error);
    }
  });

  [...level.objects, ...level.decorations].forEach((placement) => {
    if (!isInsideLevel(level, placement.grid)) {
      errors.push(`${placement.label} is outside board bounds.`);
    }
    if (placement.decorationKind && BLOCKING_DECORATION_KINDS.has(placement.decorationKind)) {
      if (placement.cells.length !== 1) {
        errors.push(`${placement.label} must use exactly one collision cell.`);
      }
      if (!placement.blocksMovement || !level.blockedGrid[placement.grid.y]?.[placement.grid.x]) {
        errors.push(`${placement.label} must block exactly its anchor cell.`);
      }
    }
    const frameKey = placement.render?.frameKey;
    if ((placement.token === 'tree' || placement.decorationKind === 'sapling' || placement.decorationKind === 'fullTree') && !FULL_TREE_FRAMES.has(frameKey ?? '')) {
      errors.push(`${placement.label} must use a full-tree frame, not ${frameKey ?? 'an unnamed frame'}.`);
    }
    if (frameKey && PARTIAL_TREE_FRAMES.has(frameKey) && placement.decorationKind !== 'fullTree') {
      errors.push(`${placement.label} uses clipped frame ${frameKey} as a normal prop.`);
    }
  });

  level.terrain.forEach((placement) => {
    const frameKey = placement.render?.frameKey;
    if (frameKey && !VALID_TERRAIN_FRAMES.has(frameKey)) {
      warnings.push(`${placement.label} terrain uses unexpected frame ${frameKey}.`);
    }
  });

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
};
