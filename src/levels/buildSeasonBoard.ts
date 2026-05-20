import type { LevelConfig, LevelToken } from './levelTypes';
import { SCENE_VARIANTS, type OptionalBoardBuilding, type SeasonPreset } from '../sceneVariants';
import { SeededRandom } from './seededRandom';

const BOARD_SIZE = 19;
const PLAYABLE_MIN = 2;
const PLAYABLE_MAX = 16;

type OptionalBuildingToken = 'market' | 'well' | 'house-2';

interface LayoutTemplate {
  castle: { x: number; y: number };
  house: { x: number; y: number };
  playerSpawn: { x: number; y: number };
  villageCenters: Array<{ x: number; y: number }>;
  extraSlots: Record<OptionalBuildingToken, { x: number; y: number }>;
  decorations: Array<{ x: number; y: number }>;
}

const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    castle: { x: 10, y: 9 },
    house: { x: 6, y: 11 },
    playerSpawn: { x: 6, y: 7 },
    villageCenters: [{ x: 9, y: 9 }, { x: 10, y: 10 }, { x: 8, y: 8 }],
    extraSlots: {
      market: { x: 13, y: 11 },
      well: { x: 12, y: 7 },
      'house-2': { x: 13, y: 8 },
    },
    decorations: [{ x: 4, y: 6 }, { x: 14, y: 5 }, { x: 5, y: 14 }, { x: 14, y: 14 }],
  },
  {
    castle: { x: 8, y: 9 },
    house: { x: 12, y: 7 },
    playerSpawn: { x: 6, y: 12 },
    villageCenters: [{ x: 9, y: 9 }, { x: 8, y: 10 }, { x: 10, y: 8 }],
    extraSlots: {
      market: { x: 8, y: 13 },
      well: { x: 12, y: 12 },
      'house-2': { x: 13, y: 10 },
    },
    decorations: [{ x: 4, y: 5 }, { x: 14, y: 6 }, { x: 6, y: 15 }, { x: 15, y: 13 }],
  },
  {
    castle: { x: 9, y: 10 },
    house: { x: 7, y: 7 },
    playerSpawn: { x: 12, y: 12 },
    villageCenters: [{ x: 9, y: 9 }, { x: 10, y: 9 }, { x: 8, y: 11 }],
    extraSlots: {
      market: { x: 12, y: 10 },
      well: { x: 6, y: 11 },
      'house-2': { x: 13, y: 13 },
    },
    decorations: [{ x: 5, y: 5 }, { x: 14, y: 6 }, { x: 6, y: 14 }, { x: 14, y: 15 }],
  },
];

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

const stamp = (
  matrix: LevelToken[][],
  token: Extract<LevelToken, 'path' | 'village-center'>,
  x: number,
  y: number,
) => {
  const point = clampPoint(x, y);
  const current = matrix[point.y][point.x];
  if (current === 'monster-spawn') {
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
  const optionalBuilding = optionalPool[rng.integer(0, optionalPool.length - 1)] as OptionalBuildingToken | null;
  const matrix = createBaseMatrix();

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

  if (optionalBuilding) {
    const slot = template.extraSlots[optionalBuilding];
    paintWideLane(matrix, boardHub, slot, sceneVariant.boardGeneration.laneHalfWidth);
    place(matrix, optionalBuilding, slot.x, slot.y);
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
