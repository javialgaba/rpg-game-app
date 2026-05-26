import type { GeneratedGate, GateDirection, LevelConfig, LevelToken } from './levelTypes';
import { SCENE_VARIANTS, type OptionalBoardBuilding, type SeasonPreset } from '../sceneVariants';
import { SeededRandom } from './seededRandom';

const BOARD_SIZE = 29;
const PLAYABLE_MIN = 3;
const PLAYABLE_MAX = 25;
const BOARD_CENTER = Math.floor((PLAYABLE_MIN + PLAYABLE_MAX) / 2);
const LAYOUT_EXPANSION_OFFSET = 2;
const GATE_CORRIDOR_HALF_WIDTH = 1;
const GATE_INTERIOR_DEPTH = 2;
const GATE_AVENUE_INTERIOR_DEPTH = 4;
const GATE_SIGHTLINE_PADDING = 1;

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

const createGate = (direction: GateDirection): GeneratedGate => {
  const threshold = direction === 'north'
    ? { x: BOARD_CENTER, y: PLAYABLE_MIN }
    : direction === 'east'
      ? { x: PLAYABLE_MAX, y: BOARD_CENTER }
      : direction === 'south'
        ? { x: BOARD_CENTER, y: PLAYABLE_MAX }
        : { x: PLAYABLE_MIN, y: BOARD_CENTER };
  const visualEntry = direction === 'north'
    ? { x: BOARD_CENTER, y: 0 }
    : direction === 'east'
      ? { x: BOARD_SIZE - 1, y: BOARD_CENTER }
      : direction === 'south'
        ? { x: BOARD_CENTER, y: BOARD_SIZE - 1 }
        : { x: 0, y: BOARD_CENTER };
  const approachCells: BoardPoint[] = [];
  const clearCells: BoardPoint[] = [];
  const from = direction === 'north' || direction === 'west'
    ? 0
    : PLAYABLE_MAX - GATE_INTERIOR_DEPTH + 1;
  const to = direction === 'north' || direction === 'west'
    ? PLAYABLE_MIN + GATE_INTERIOR_DEPTH - 1
    : BOARD_SIZE - 1;
  for (let axis = from; axis <= to; axis += 1) {
    const centerline = direction === 'north' || direction === 'south'
      ? { x: BOARD_CENTER, y: axis }
      : { x: axis, y: BOARD_CENTER };
    approachCells.push(centerline);
    for (let offset = -GATE_CORRIDOR_HALF_WIDTH; offset <= GATE_CORRIDOR_HALF_WIDTH; offset += 1) {
      clearCells.push(direction === 'north' || direction === 'south'
        ? { x: BOARD_CENTER + offset, y: axis }
        : { x: axis, y: BOARD_CENTER + offset });
    }
  }
  return {
    id: `gate-${direction}`,
    direction,
    threshold,
    visualEntry,
    approachCells,
    clearCells,
    roadCells: clearCells,
    sightlineCells: [],
  };
};

const GENERATED_GATES = (['north', 'east', 'south', 'west'] as GateDirection[]).map(createGate);

const pointKey = (point: BoardPoint) => `${point.x},${point.y}`;

const uniquePoints = (points: BoardPoint[]) => {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = pointKey(point);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const isInsideBoard = (point: BoardPoint) => (
  point.x >= 0 && point.y >= 0 && point.x < BOARD_SIZE && point.y < BOARD_SIZE
);

const expandCells = (cells: BoardPoint[], padding: number) => uniquePoints(
  cells.flatMap((cell) => (
    Array.from({ length: padding * 2 + 1 }, (_, row) => (
      Array.from({ length: padding * 2 + 1 }, (__, column) => ({
        x: cell.x + column - padding,
        y: cell.y + row - padding,
      }))
    )).flat()
  )).filter(isInsideBoard),
);

const createGateAvenue = (gate: GeneratedGate): GeneratedGate => {
  const centerline: BoardPoint[] = [];
  if (gate.direction === 'north') {
    for (let y = 0; y <= PLAYABLE_MIN + GATE_AVENUE_INTERIOR_DEPTH; y += 1) {
      centerline.push({ x: BOARD_CENTER, y });
    }
  } else if (gate.direction === 'south') {
    for (let y = BOARD_SIZE - 1; y >= PLAYABLE_MAX - GATE_AVENUE_INTERIOR_DEPTH; y -= 1) {
      centerline.push({ x: BOARD_CENTER, y });
    }
  } else if (gate.direction === 'west') {
    for (let x = 0; x <= PLAYABLE_MIN + GATE_AVENUE_INTERIOR_DEPTH; x += 1) {
      centerline.push({ x, y: BOARD_CENTER });
    }
  } else {
    for (let x = BOARD_SIZE - 1; x >= PLAYABLE_MAX - GATE_AVENUE_INTERIOR_DEPTH; x -= 1) {
      centerline.push({ x, y: BOARD_CENTER });
    }
  }
  const roadCells = expandCells(centerline, GATE_CORRIDOR_HALF_WIDTH);
  return {
    ...gate,
    approachCells: centerline,
    roadCells,
    sightlineCells: expandCells(roadCells, GATE_SIGHTLINE_PADDING),
  };
};

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

const hasGateSightlineClearance = (candidate: BoardBuildingPlacement, gates: GeneratedGate[]) => {
  const sightlineKeys = new Set(gates.flatMap((gate) => gate.sightlineCells.map(pointKey)));
  return getFootprintCells(candidate.token, candidate.point)
    .every((cell) => !sightlineKeys.has(pointKey(cell)));
};

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

const shiftPoint = (point: BoardPoint) => ({
  x: point.x + LAYOUT_EXPANSION_OFFSET,
  y: point.y + LAYOUT_EXPANSION_OFFSET,
});

const expandTemplate = (template: LayoutTemplate): LayoutTemplate => ({
  castle: shiftPoint(template.castle),
  house: shiftPoint(template.house),
  playerSpawn: shiftPoint(template.playerSpawn),
  villageCenters: template.villageCenters.map(shiftPoint),
  extraSlots: {
    market: template.extraSlots.market.map(shiftPoint),
    well: template.extraSlots.well.map(shiftPoint),
    'house-2': template.extraSlots['house-2'].map(shiftPoint),
  },
  decorations: template.decorations.map(shiftPoint),
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

const placeScenicToken = (matrix: LevelToken[][], token: LevelToken, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) {
    return;
  }
  matrix[y][x] = token;
};

const carveGateAvenues = (matrix: LevelToken[][], gates: GeneratedGate[]) => {
  const roadKeys = new Set(gates.flatMap((gate) => gate.roadCells.map(pointKey)));
  gates.forEach((gate) => {
    gate.roadCells.forEach((cell) => placeScenicToken(matrix, 'path', cell.x, cell.y));
    gate.sightlineCells.forEach((cell) => {
      const outsidePlayable = cell.x < PLAYABLE_MIN
        || cell.y < PLAYABLE_MIN
        || cell.x > PLAYABLE_MAX
        || cell.y > PLAYABLE_MAX;
      if (outsidePlayable && !roadKeys.has(pointKey(cell))) {
        placeScenicToken(matrix, 'grass', cell.x, cell.y);
      }
    });
  });
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
  const template = expandTemplate(LAYOUT_TEMPLATES[rng.integer(0, LAYOUT_TEMPLATES.length - 1)]);
  const sceneVariant = SCENE_VARIANTS[worldKey];
  const optionalPool = sceneVariant.boardGeneration.optionalBuildings as Array<OptionalBoardBuilding | null>;
  const selectedOptionalBuilding = optionalPool[rng.integer(0, optionalPool.length - 1)] as OptionalBuildingToken | null;
  const optionalCandidates = getOptionalCandidates(optionalPool, selectedOptionalBuilding);
  const matrix = createBaseMatrix();
  const gates = GENERATED_GATES.map(createGateAvenue);
  const placedBuildings: BoardBuildingPlacement[] = [
    { token: 'castle', point: template.castle },
    { token: 'house-1', point: template.house },
  ];

  carveGateAvenues(matrix, gates);
  template.villageCenters.forEach((point) => place(matrix, 'village-center', point.x, point.y));
  stampSpawnPlaza(matrix, template.playerSpawn, sceneVariant.boardGeneration.spawnPlazaOffsets);
  const boardHub = template.villageCenters[0] ?? template.playerSpawn;
  paintWideLane(matrix, template.playerSpawn, boardHub, sceneVariant.boardGeneration.laneHalfWidth);
  paintWideLane(matrix, boardHub, template.castle, sceneVariant.boardGeneration.laneHalfWidth);
  paintWideLane(matrix, boardHub, template.house, sceneVariant.boardGeneration.laneHalfWidth);
  gates.forEach((gate) => {
    const avenueEnd = gate.approachCells[gate.approachCells.length - 1] ?? gate.threshold;
    paintWideLane(matrix, avenueEnd, boardHub, 0);
  });
  place(matrix, 'player-spawn', template.playerSpawn.x, template.playerSpawn.y);
  place(matrix, 'castle', template.castle.x, template.castle.y);
  place(matrix, 'house-1', template.house.x, template.house.y);
  gates.forEach((gate) => place(matrix, 'monster-spawn', gate.threshold.x, gate.threshold.y));

  for (const optionalBuilding of optionalCandidates) {
    const slot = template.extraSlots[optionalBuilding]
      .find((point) => {
        const candidate = { token: optionalBuilding, point };
        return hasBuildingClearance(candidate, placedBuildings)
          && hasPlayerSpawnClearance(candidate, template.playerSpawn)
          && hasGateSightlineClearance(candidate, gates);
      });
    if (!slot) {
      continue;
    }
    paintWideLane(matrix, boardHub, slot, sceneVariant.boardGeneration.laneHalfWidth);
    place(matrix, optionalBuilding, slot.x, slot.y);
    placedBuildings.push({ token: optionalBuilding, point: slot });
    break;
  }

  const gateSightlineKeys = new Set(gates.flatMap((gate) => gate.sightlineCells.map(pointKey)));
  template.decorations.forEach((point, index) => {
    if (!gateSightlineKeys.has(pointKey(point)) && (rng.chance(0.56) || index < 1)) {
      place(matrix, 'decoration', point.x, point.y);
    }
  });

  return {
    ...config,
    seed: `${config.seed}-${worldKey}-${worldCycle}`,
    tileSize: Math.max(config.tileSize, sceneVariant.boardTileSizeMin),
    matrix,
    gates: gates.map((gate) => ({
      ...gate,
      threshold: { ...gate.threshold },
      visualEntry: { ...gate.visualEntry },
      approachCells: gate.approachCells.map((cell) => ({ ...cell })),
      clearCells: gate.clearCells.map((cell) => ({ ...cell })),
      roadCells: gate.roadCells.map((cell) => ({ ...cell })),
      sightlineCells: gate.sightlineCells.map((cell) => ({ ...cell })),
    })),
  } satisfies LevelConfig;
};
