import type { LevelConfig, LevelToken } from './levelTypes';
import { SCENE_VARIANTS, type OptionalBoardBuilding, type SeasonPreset } from '../sceneVariants';
import { SeededRandom } from './seededRandom';

const BOARD_SIZE = 25;
const PLAYABLE_MIN = 3;
const PLAYABLE_MAX = 21;

type OptionalBuildingToken = 'market' | 'well' | 'house-2';
type BoardBuildingToken = 'castle' | 'house-1' | OptionalBuildingToken;
type BoardPoint = { x: number; y: number };

interface LayoutTemplate {
  castle: BoardPoint;
  house: BoardPoint;
  playerSpawn: BoardPoint;
  villageCenters: BoardPoint[];
  extraSlots: Record<OptionalBuildingToken, BoardPoint[]>;
  decorations: BoardPoint[];
}

interface BoardBuildingPlacement {
  token: BoardBuildingToken;
  point: BoardPoint;
}

const REQUIRED_BUILDING_CLEARANCE = 3;
const BUILDING_FOOTPRINTS: Record<BoardBuildingToken, { w: number; h: number }> = {
  castle: { w: 3, h: 3 },
  'house-1': { w: 3, h: 2 },
  'house-2': { w: 3, h: 2 },
  market: { w: 3, h: 2 },
  well: { w: 2, h: 2 },
};

const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    castle: { x: 12, y: 11 },
    house: { x: 7, y: 17 },
    playerSpawn: { x: 9, y: 10 },
    villageCenters: [{ x: 11, y: 12 }, { x: 12, y: 13 }, { x: 10, y: 11 }],
    extraSlots: {
      market: [{ x: 15, y: 17 }, { x: 16, y: 17 }, { x: 17, y: 16 }, { x: 18, y: 16 }],
      well: [{ x: 7, y: 12 }, { x: 16, y: 16 }, { x: 17, y: 15 }, { x: 7, y: 11 }],
      'house-2': [{ x: 16, y: 17 }, { x: 17, y: 16 }, { x: 18, y: 16 }, { x: 16, y: 18 }],
    },
    decorations: [{ x: 5, y: 8 }, { x: 19, y: 7 }, { x: 6, y: 19 }, { x: 19, y: 19 }, { x: 5, y: 14 }, { x: 19, y: 13 }],
  },
  {
    castle: { x: 11, y: 11 },
    house: { x: 17, y: 8 },
    playerSpawn: { x: 8, y: 16 },
    villageCenters: [{ x: 12, y: 13 }, { x: 11, y: 14 }, { x: 13, y: 12 }],
    extraSlots: {
      market: [{ x: 14, y: 18 }, { x: 15, y: 18 }, { x: 16, y: 17 }, { x: 18, y: 14 }],
      well: [{ x: 7, y: 12 }, { x: 14, y: 17 }, { x: 16, y: 15 }, { x: 7, y: 13 }],
      'house-2': [{ x: 15, y: 18 }, { x: 16, y: 17 }, { x: 18, y: 14 }, { x: 16, y: 18 }],
    },
    decorations: [{ x: 5, y: 7 }, { x: 19, y: 8 }, { x: 7, y: 20 }, { x: 20, y: 17 }, { x: 5, y: 15 }, { x: 19, y: 12 }],
  },
  {
    castle: { x: 13, y: 13 },
    house: { x: 7, y: 7 },
    playerSpawn: { x: 17, y: 17 },
    villageCenters: [{ x: 12, y: 12 }, { x: 13, y: 11 }, { x: 11, y: 13 }],
    extraSlots: {
      market: [{ x: 6, y: 14 }, { x: 15, y: 7 }, { x: 6, y: 15 }, { x: 16, y: 7 }],
      well: [{ x: 7, y: 13 }, { x: 15, y: 7 }, { x: 6, y: 13 }, { x: 7, y: 14 }],
      'house-2': [{ x: 6, y: 14 }, { x: 15, y: 7 }, { x: 6, y: 15 }, { x: 16, y: 7 }],
    },
    decorations: [{ x: 5, y: 5 }, { x: 19, y: 8 }, { x: 7, y: 19 }, { x: 19, y: 20 }, { x: 5, y: 16 }, { x: 18, y: 14 }],
  },
];

const getFootprintCells = (token: BoardBuildingToken, point: BoardPoint) => {
  const footprint = BUILDING_FOOTPRINTS[token];
  const offsetX = Math.floor(footprint.w / 2);
  const offsetY = Math.floor(footprint.h / 2);
  return Array.from({ length: footprint.h }, (_, row) => (
    Array.from({ length: footprint.w }, (__, col) => ({
      x: point.x - offsetX + col,
      y: point.y - offsetY + row,
    }))
  )).flat();
};

const getFootprintDistance = (a: BoardBuildingPlacement, b: BoardBuildingPlacement) => (
  getFootprintCells(a.token, a.point).reduce((best, aCell) => Math.min(
    best,
    getFootprintCells(b.token, b.point).reduce((cellBest, bCell) => Math.min(
      cellBest,
      Math.max(Math.abs(aCell.x - bCell.x), Math.abs(aCell.y - bCell.y)),
    ), Infinity),
  ), Infinity)
);

const hasPlayerSpawnClearance = (candidate: BoardBuildingPlacement, playerSpawn: BoardPoint) => (
  getFootprintCells(candidate.token, candidate.point)
    .every((cell) => Math.max(Math.abs(cell.x - playerSpawn.x), Math.abs(cell.y - playerSpawn.y)) > 1)
);

const hasBuildingClearance = (candidate: BoardBuildingPlacement, placed: BoardBuildingPlacement[]) => (
  placed.every((placement) => getFootprintDistance(candidate, placement) >= REQUIRED_BUILDING_CLEARANCE)
);

const getOptionalCandidates = (
  optionalPool: Array<OptionalBoardBuilding | null>,
  selected: OptionalBuildingToken | null,
) => {
  if (!selected) {
    return [];
  }
  return [selected, ...optionalPool.filter((token): token is OptionalBuildingToken => (
    Boolean(token) && token !== selected
  ))].filter((token, index, candidates) => candidates.indexOf(token) === index);
};

const clampPoint = (x: number, y: number) => ({
  x: Math.max(PLAYABLE_MIN, Math.min(PLAYABLE_MAX, x)),
  y: Math.max(PLAYABLE_MIN, Math.min(PLAYABLE_MAX, y)),
});

const createBaseMatrix = (): LevelToken[][] => (
  Array.from({ length: BOARD_SIZE }, (_, y) => (
    Array.from({ length: BOARD_SIZE }, (_, x) => {
      if (x === 0 || y === 0 || x === BOARD_SIZE - 1 || y === BOARD_SIZE - 1) {
        return 'tree';
      }
      if (x < PLAYABLE_MIN || y < PLAYABLE_MIN || x > PLAYABLE_MAX || y > PLAYABLE_MAX) {
        return 'tree';
      }
      return 'grass';
    })
  ))
);

const place = (matrix: LevelToken[][], token: LevelToken, x: number, y: number) => {
  const point = clampPoint(x, y);
  matrix[point.y][point.x] = token;
};

const canCarveLaneToken = (token: LevelToken) => (
  token === 'grass'
  || token === 'decoration'
  || token === 'path'
  || token === 'village-center'
  || token === 'player-spawn'
);

const stamp = (
  matrix: LevelToken[][],
  token: Extract<LevelToken, 'path' | 'village-center'>,
  x: number,
  y: number,
) => {
  const point = clampPoint(x, y);
  const current = matrix[point.y][point.x];
  if (!canCarveLaneToken(current)) {
    return;
  }
  matrix[point.y][point.x] = token;
};

const paintLaneBand = (
  matrix: LevelToken[][],
  point: { x: number; y: number },
  orientation: 'horizontal' | 'vertical',
  halfWidth: number,
) => {
  for (let offset = -halfWidth; offset <= halfWidth; offset += 1) {
    if (orientation === 'horizontal') {
      stamp(matrix, 'path', point.x, point.y + offset);
    } else {
      stamp(matrix, 'path', point.x + offset, point.y);
    }
  }
};

const paintWideLane = (
  matrix: LevelToken[][],
  start: { x: number; y: number },
  end: { x: number; y: number },
  halfWidth: number,
) => {
  const stepX = start.x <= end.x ? 1 : -1;
  const stepY = start.y <= end.y ? 1 : -1;
  for (let x = start.x; x !== end.x; x += stepX) {
    paintLaneBand(matrix, { x, y: start.y }, 'horizontal', halfWidth);
  }
  paintLaneBand(matrix, { x: end.x, y: start.y }, 'horizontal', halfWidth);
  for (let y = start.y; y !== end.y; y += stepY) {
    paintLaneBand(matrix, { x: end.x, y }, 'vertical', halfWidth);
  }
  paintLaneBand(matrix, end, 'vertical', halfWidth);
};

const stampSpawnPlaza = (
  matrix: LevelToken[][],
  playerSpawn: { x: number; y: number },
  offsets: Array<{ x: number; y: number }>,
) => {
  offsets.forEach((offset) => {
    stamp(matrix, 'village-center', playerSpawn.x + offset.x, playerSpawn.y + offset.y);
  });
};

export const buildSeasonBoardConfig = (
  config: LevelConfig,
  worldKey: SeasonPreset,
  worldCycle: number,
) => {
  const rng = new SeededRandom(`${config.seed}-${worldKey}-${worldCycle}`);
  const template = LAYOUT_TEMPLATES[rng.integer(0, LAYOUT_TEMPLATES.length - 1)];
  const sceneVariant = SCENE_VARIANTS[worldKey];
  const optionalPool = sceneVariant.boardGeneration.optionalBuildings as Array<OptionalBoardBuilding | null>;
  const selectedOptionalBuilding = optionalPool[rng.integer(0, optionalPool.length - 1)] as OptionalBuildingToken | null;
  const optionalCandidates = getOptionalCandidates(optionalPool, selectedOptionalBuilding);
  const matrix = createBaseMatrix();
  const placedBuildings: BoardBuildingPlacement[] = [
    { token: 'castle', point: template.castle },
    { token: 'house-1', point: template.house },
  ];

  [
    { x: PLAYABLE_MIN, y: PLAYABLE_MIN },
    { x: PLAYABLE_MAX, y: PLAYABLE_MIN },
    { x: PLAYABLE_MAX, y: PLAYABLE_MAX },
    { x: PLAYABLE_MIN, y: PLAYABLE_MAX },
  ].forEach((point) => place(matrix, 'monster-spawn', point.x, point.y));

  template.villageCenters.forEach((point) => place(matrix, 'village-center', point.x, point.y));
  stampSpawnPlaza(matrix, template.playerSpawn, sceneVariant.boardGeneration.spawnPlazaOffsets);
  const boardHub = template.villageCenters[0] ?? template.playerSpawn;
  paintWideLane(matrix, template.playerSpawn, boardHub, sceneVariant.boardGeneration.laneHalfWidth);
  paintWideLane(matrix, boardHub, template.castle, sceneVariant.boardGeneration.laneHalfWidth);
  paintWideLane(matrix, boardHub, template.house, sceneVariant.boardGeneration.laneHalfWidth);
  place(matrix, 'player-spawn', template.playerSpawn.x, template.playerSpawn.y);
  place(matrix, 'castle', template.castle.x, template.castle.y);
  place(matrix, 'house-1', template.house.x, template.house.y);

  for (const optionalBuilding of optionalCandidates) {
    const slot = template.extraSlots[optionalBuilding]
      .find((point) => {
        const candidate = { token: optionalBuilding, point };
        return hasBuildingClearance(candidate, placedBuildings)
          && hasPlayerSpawnClearance(candidate, template.playerSpawn);
      });
    if (!slot) {
      continue;
    }
    paintWideLane(matrix, boardHub, slot, sceneVariant.boardGeneration.laneHalfWidth);
    place(matrix, optionalBuilding, slot.x, slot.y);
    placedBuildings.push({ token: optionalBuilding, point: slot });
    break;
  }

  template.decorations.forEach((point, index) => {
    if (rng.chance(0.56) || index < 1) {
      place(matrix, 'decoration', point.x, point.y);
    }
  });

  return {
    ...config,
    seed: `${config.seed}-${worldKey}-${worldCycle}`,
    tileSize: Math.max(config.tileSize, sceneVariant.boardTileSizeMin),
    matrix,
  } satisfies LevelConfig;
};
