import type { LevelConfig, LevelToken } from './levelTypes';
import type { SeasonPreset } from '../sceneVariants';
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

const OPTIONAL_BUILDING_POOLS: Record<SeasonPreset, Array<OptionalBuildingToken | null>> = {
  day_spring: [null, null, 'well'],
  afternoon_summer: [null, 'market', 'well'],
  night_spring: [null, null, 'house-2'],
  noon_winter: [null, 'well', 'house-2'],
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

export const buildSeasonBoardConfig = (
  config: LevelConfig,
  worldKey: SeasonPreset,
  worldCycle: number,
) => {
  const rng = new SeededRandom(`${config.seed}-${worldKey}-${worldCycle}`);
  const template = LAYOUT_TEMPLATES[rng.integer(0, LAYOUT_TEMPLATES.length - 1)];
  const optionalPool = OPTIONAL_BUILDING_POOLS[worldKey];
  const optionalBuilding = optionalPool[rng.integer(0, optionalPool.length - 1)];
  const matrix = createBaseMatrix();

  [
    { x: PLAYABLE_MIN, y: PLAYABLE_MIN },
    { x: PLAYABLE_MAX, y: PLAYABLE_MIN },
    { x: PLAYABLE_MAX, y: PLAYABLE_MAX },
    { x: PLAYABLE_MIN, y: PLAYABLE_MAX },
  ].forEach((point) => place(matrix, 'monster-spawn', point.x, point.y));

  template.decorations.forEach((point, index) => {
    if (rng.chance(0.76) || index < 2) {
      place(matrix, 'decoration', point.x, point.y);
    }
  });

  template.villageCenters.forEach((point) => place(matrix, 'village-center', point.x, point.y));
  place(matrix, 'player-spawn', template.playerSpawn.x, template.playerSpawn.y);
  place(matrix, 'castle', template.castle.x, template.castle.y);
  place(matrix, 'house-1', template.house.x, template.house.y);

  if (optionalBuilding) {
    const slot = template.extraSlots[optionalBuilding];
    place(matrix, optionalBuilding, slot.x, slot.y);
  }

  return {
    ...config,
    seed: `${config.seed}-${worldKey}-${worldCycle}`,
    tileSize: Math.max(config.tileSize, 56),
    matrix,
  } satisfies LevelConfig;
};
