import type { PlayableBounds } from './levels/levelTypes';

export type SeasonPreset =
  | 'day_spring'
  | 'afternoon_summer'
  | 'night_spring'
  | 'noon_winter';

export type OptionalBoardBuilding = 'market' | 'well' | 'house-2';

export interface SceneVariantOverlapAnchor {
  frame: string;
  x: number;
  y: number;
  scale: number;
  depthBias: number;
  alpha?: number;
}

export interface SceneVariantConfig {
  key: SeasonPreset;
  season: 'spring' | 'summer' | 'winter';
  backgroundAssetKey: string;
  exteriorFrameAssetKey: string;
  foregroundFogAssetKey?: string;
  ambientTint: number;
  ambientAlpha: number;
  worldZoom: number;
  backgroundParallax: number;
  frameParallax: number;
  foregroundParallax: number;
  boardTileSizeMin: number;
  playableBounds: PlayableBounds;
  boardGeneration: {
    optionalBuildings: Array<OptionalBoardBuilding | null>;
    laneHalfWidth: number;
    spawnPlazaOffsets: Array<{ x: number; y: number }>;
  };
  overlapDecorAnchors: SceneVariantOverlapAnchor[];
  tilePalette: {
    grass: string[];
    path: string[];
    snow?: string[];
  };
  propPalette: {
    trees: string[];
    flowers: string[];
    rocks: string[];
    lamps?: string[];
    winterProps?: string[];
  };
}

export const DEFAULT_PLAYABLE_BOUNDS: PlayableBounds = {
  minX: 2,
  minY: 2,
  maxX: 16,
  maxY: 16,
};

const baseOverlapDecorAnchors: SceneVariantOverlapAnchor[] = [
  { frame: 'bush_foreground', x: -5.1, y: -4.2, scale: 1.02, depthBias: -26, alpha: 0.96 },
  { frame: 'rock_cluster_round', x: -3.4, y: -4.65, scale: 0.88, depthBias: -24, alpha: 0.98 },
  { frame: 'tree_cluster_edge', x: 4.8, y: -4.15, scale: 0.92, depthBias: -25, alpha: 0.96 },
  { frame: 'flower_patch_wild', x: -5.8, y: 3.5, scale: 0.92, depthBias: 12, alpha: 0.94 },
  { frame: 'bush_foreground', x: 5.6, y: 3.65, scale: 1, depthBias: 14, alpha: 0.94 },
  { frame: 'tree_cluster_edge', x: -4.45, y: 4.55, scale: 0.96, depthBias: 16, alpha: 0.92 },
  { frame: 'flower_patch_wild', x: 4.25, y: 4.4, scale: 0.9, depthBias: 14, alpha: 0.9 },
];

const DEFAULT_SPAWN_PLAZA_OFFSETS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export const SCENE_VARIANTS: Record<SeasonPreset, SceneVariantConfig> = {
  day_spring: {
    key: 'day_spring',
    season: 'spring',
    backgroundAssetKey: 'sceneVariantBackground_day_spring',
    exteriorFrameAssetKey: 'sceneVariantFrame_day_spring',
    foregroundFogAssetKey: 'sceneVariantForeground_day_spring',
    ambientTint: 0xffffff,
    ambientAlpha: 0,
    worldZoom: 1.22,
    backgroundParallax: 0.03,
    frameParallax: 0.06,
    foregroundParallax: 0.1,
    boardTileSizeMin: 60,
    playableBounds: DEFAULT_PLAYABLE_BOUNDS,
    boardGeneration: {
      optionalBuildings: [null, null, null, 'well'],
      laneHalfWidth: 1,
      spawnPlazaOffsets: DEFAULT_SPAWN_PLAZA_OFFSETS,
    },
    overlapDecorAnchors: baseOverlapDecorAnchors,
    tilePalette: {
      grass: ['grass_01', 'grass_02'],
      path: ['stone_path_01'],
    },
    propPalette: {
      trees: ['pine_tree_01', 'oak_tree_01'],
      flowers: ['flower_bed_01'],
      rocks: ['rock_cluster_round'],
      lamps: ['lamp_01'],
    },
  },
  afternoon_summer: {
    key: 'afternoon_summer',
    season: 'summer',
    backgroundAssetKey: 'sceneVariantBackground_afternoon_summer',
    exteriorFrameAssetKey: 'sceneVariantFrame_afternoon_summer',
    foregroundFogAssetKey: 'sceneVariantForeground_afternoon_summer',
    ambientTint: 0xffe4b5,
    ambientAlpha: 0.08,
    worldZoom: 1.24,
    backgroundParallax: 0.032,
    frameParallax: 0.065,
    foregroundParallax: 0.11,
    boardTileSizeMin: 60,
    playableBounds: DEFAULT_PLAYABLE_BOUNDS,
    boardGeneration: {
      optionalBuildings: [null, null, 'market', 'well'],
      laneHalfWidth: 1,
      spawnPlazaOffsets: DEFAULT_SPAWN_PLAZA_OFFSETS,
    },
    overlapDecorAnchors: baseOverlapDecorAnchors,
    tilePalette: {
      grass: ['grass_02', 'grass_01'],
      path: ['stone_path_01'],
    },
    propPalette: {
      trees: ['oak_tree_01', 'pine_tree_01'],
      flowers: ['flower_bed_01'],
      rocks: ['rock_cluster_round'],
      lamps: ['lamp_01'],
    },
  },
  night_spring: {
    key: 'night_spring',
    season: 'spring',
    backgroundAssetKey: 'sceneVariantBackground_night_spring',
    exteriorFrameAssetKey: 'sceneVariantFrame_night_spring',
    foregroundFogAssetKey: 'sceneVariantForeground_night_spring',
    ambientTint: 0x8ba7ff,
    ambientAlpha: 0.2,
    worldZoom: 1.21,
    backgroundParallax: 0.025,
    frameParallax: 0.055,
    foregroundParallax: 0.095,
    boardTileSizeMin: 60,
    playableBounds: DEFAULT_PLAYABLE_BOUNDS,
    boardGeneration: {
      optionalBuildings: [null, null, null, 'house-2'],
      laneHalfWidth: 1,
      spawnPlazaOffsets: DEFAULT_SPAWN_PLAZA_OFFSETS,
    },
    overlapDecorAnchors: baseOverlapDecorAnchors,
    tilePalette: {
      grass: ['grass_01', 'grass_02'],
      path: ['stone_path_01'],
    },
    propPalette: {
      trees: ['pine_tree_01', 'oak_tree_01'],
      flowers: ['flower_bed_01'],
      rocks: ['rock_cluster_round'],
      lamps: ['lamp_01'],
    },
  },
  noon_winter: {
    key: 'noon_winter',
    season: 'winter',
    backgroundAssetKey: 'sceneVariantBackground_noon_winter',
    exteriorFrameAssetKey: 'sceneVariantFrame_noon_winter',
    foregroundFogAssetKey: 'sceneVariantForeground_noon_winter',
    ambientTint: 0xe6f3ff,
    ambientAlpha: 0.06,
    worldZoom: 1.22,
    backgroundParallax: 0.03,
    frameParallax: 0.06,
    foregroundParallax: 0.1,
    boardTileSizeMin: 60,
    playableBounds: DEFAULT_PLAYABLE_BOUNDS,
    boardGeneration: {
      optionalBuildings: [null, null, 'well', 'house-2'],
      laneHalfWidth: 1,
      spawnPlazaOffsets: DEFAULT_SPAWN_PLAZA_OFFSETS,
    },
    overlapDecorAnchors: baseOverlapDecorAnchors.map((anchor) => ({ ...anchor, alpha: Math.min(1, (anchor.alpha ?? 1) + 0.04) })),
    tilePalette: {
      grass: ['winter_grass_01'],
      path: ['winter_path_01'],
      snow: ['winter_grass_01'],
    },
    propPalette: {
      trees: ['winter_pine_01'],
      flowers: ['winter_flower_patch_01'],
      rocks: ['rock_cluster_round'],
      lamps: ['lamp_01'],
    },
  },
};

export const resolveSceneVariantFromParams = (params: URLSearchParams) => {
  const requested = params.get('variant')?.trim();
  if (requested && requested in SCENE_VARIANTS) {
    return SCENE_VARIANTS[requested as SeasonPreset];
  }
  return SCENE_VARIANTS.day_spring;
};
