import type { LevelToken, PlayableBounds } from './levels/levelTypes';

export type SeasonPreset =
  | 'day_spring'
  | 'afternoon_summer'
  | 'night_spring'
  | 'noon_winter';

export type VisualTheme = 'spring' | 'summer' | 'twilight_autumn' | 'winter';
export type OptionalBoardBuilding = 'market' | 'well' | 'house-2';
export type SeasonalBuildingRole = Extract<LevelToken, 'castle' | 'house-1' | 'house-2' | 'market' | 'well'>;
export type SeasonalPropGroup =
  | 'trees'
  | 'saplings'
  | 'treeClusters'
  | 'flowers'
  | 'rocks'
  | 'ponds'
  | 'bushes'
  | 'grassPatches'
  | 'magicPatches'
  | 'lamps'
  | 'fences'
  | 'signs';

export interface SeasonalBuildingPresentation {
  frame: string;
  label: string;
}

export interface SceneVariantOverlapAnchor {
  group: Extract<SeasonalPropGroup, 'bushes' | 'rocks' | 'treeClusters' | 'flowers'>;
  x: number;
  y: number;
  scale: number;
  depthBias: number;
  alpha?: number;
  occludesPlayer?: boolean;
}

export interface SceneVariantConfig {
  key: SeasonPreset;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  visualTheme: VisualTheme;
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
    plaza: string[];
  };
  propPalette: Record<SeasonalPropGroup, string[]>;
  buildingPalette: Record<SeasonalBuildingRole, SeasonalBuildingPresentation[]>;
}

export const DEFAULT_PLAYABLE_BOUNDS: PlayableBounds = {
  minX: 2,
  minY: 2,
  maxX: 16,
  maxY: 16,
};

const BASE_OVERLAP_DECOR_ANCHORS: SceneVariantOverlapAnchor[] = [
  { group: 'bushes', x: -5.1, y: -4.2, scale: 1.02, depthBias: -26, alpha: 0.96, occludesPlayer: true },
  { group: 'rocks', x: -3.4, y: -4.65, scale: 0.88, depthBias: -24, alpha: 0.98, occludesPlayer: true },
  { group: 'treeClusters', x: 4.8, y: -4.15, scale: 0.92, depthBias: -25, alpha: 0.96, occludesPlayer: true },
  { group: 'flowers', x: -5.8, y: 3.5, scale: 0.92, depthBias: 12, alpha: 0.94 },
  { group: 'bushes', x: 5.6, y: 3.65, scale: 1, depthBias: 14, alpha: 0.94, occludesPlayer: true },
  { group: 'treeClusters', x: -4.45, y: 4.55, scale: 0.96, depthBias: 16, alpha: 0.92, occludesPlayer: true },
  { group: 'flowers', x: 4.25, y: 4.4, scale: 0.9, depthBias: 14, alpha: 0.9 },
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

const frames = (theme: VisualTheme, ...names: string[]) => names.map((name) => `${theme}_${name}`);

const createTilePalette = (theme: VisualTheme) => ({
  grass: frames(theme, 'grass_01', 'grass_02', 'grass_03'),
  path: frames(theme, 'path_01', 'path_02'),
  plaza: frames(theme, 'plaza_01'),
});

const createPropPalette = (theme: VisualTheme): Record<SeasonalPropGroup, string[]> => ({
  trees: frames(theme, 'conifer_01', 'broadleaf_01', 'signature_tree_01'),
  saplings: frames(theme, 'sapling_01'),
  treeClusters: frames(theme, 'tree_cluster_01'),
  flowers: frames(theme, 'flowers_01'),
  rocks: frames(theme, 'rocks_small_01', 'rocks_medium_01', 'rocks_large_01'),
  ponds: frames(theme, 'pond_01', 'pond_02'),
  bushes: frames(theme, 'bush_01'),
  grassPatches: frames(theme, 'grass_tuft_01'),
  magicPatches: frames(theme, 'magic_patch_01'),
  lamps: frames(theme, 'lamp_01'),
  fences: frames(theme, 'fence_01'),
  signs: frames(theme, 'sign_01'),
});

const BUILDING_LABELS: Record<VisualTheme, Record<SeasonalBuildingRole, string[]>> = {
  spring: {
    castle: ['Castle'],
    'house-1': ['Floral Cottage', 'Tea Inn'],
    'house-2': ['Blossom Bakery', 'Artisan Forge'],
    market: ['Flower Market', 'Herbal Shop'],
    well: ['Vine Well', 'Petal Shrine'],
  },
  summer: {
    castle: ['Castle'],
    'house-1': ['Summer Cottage', 'Veranda Inn'],
    'house-2': ['Market Bakery', 'Sun Forge'],
    market: ['Fruit Bazaar', 'Potion Stall'],
    well: ['Stone Well', 'Sun Fountain'],
  },
  twilight_autumn: {
    castle: ['Castle'],
    'house-1': ['Moonlit Cottage', 'Harvest Inn'],
    'house-2': ['Lantern Bakery', 'Moon Smithy'],
    market: ['Harvest Market', 'Night Apothecary'],
    well: ['Moon Well', 'Lantern Shrine'],
  },
  winter: {
    castle: ['Castle'],
    'house-1': ['Snow Cottage', 'Hearth Inn'],
    'house-2': ['Winter Bakery', 'Frost Forge'],
    market: ['Winter Market', 'Frost Herbalist'],
    well: ['Frozen Well', 'Ice Fountain'],
  },
};

const BUILDING_FRAME_NAMES: Record<SeasonalBuildingRole, string[]> = {
  castle: ['castle_01'],
  'house-1': ['cottage_01', 'inn_01'],
  'house-2': ['bakery_01', 'smithy_01'],
  market: ['market_01', 'apothecary_01'],
  well: ['well_01', 'shrine_01'],
};

const createBuildingPalette = (theme: VisualTheme): Record<SeasonalBuildingRole, SeasonalBuildingPresentation[]> => (
  Object.fromEntries(
    (Object.keys(BUILDING_FRAME_NAMES) as SeasonalBuildingRole[]).map((role) => [
      role,
      BUILDING_FRAME_NAMES[role].map((name, index) => ({
        frame: `${theme}_${name}`,
        label: BUILDING_LABELS[theme][role][index],
      })),
    ]),
  ) as Record<SeasonalBuildingRole, SeasonalBuildingPresentation[]>
);

const adjustOverlapAlpha = (addition: number) => BASE_OVERLAP_DECOR_ANCHORS.map((anchor) => ({
  ...anchor,
  alpha: Math.min(1, (anchor.alpha ?? 1) + addition),
}));

export const selectSeasonalIndex = (key: string, length: number) => {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return length > 0 ? (hash >>> 0) % length : 0;
};

export const selectSeasonalFrame = (available: string[], key: string) => (
  available[selectSeasonalIndex(key, available.length)]
);

export const resolveSeasonalBuildingPresentation = (
  variant: SceneVariantConfig,
  role: SeasonalBuildingRole,
  key: string,
) => {
  const available = variant.buildingPalette[role];
  return available[selectSeasonalIndex(key, available.length)];
};

export const SCENE_VARIANTS: Record<SeasonPreset, SceneVariantConfig> = {
  day_spring: {
    key: 'day_spring',
    season: 'spring',
    visualTheme: 'spring',
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
    overlapDecorAnchors: BASE_OVERLAP_DECOR_ANCHORS,
    tilePalette: createTilePalette('spring'),
    propPalette: createPropPalette('spring'),
    buildingPalette: createBuildingPalette('spring'),
  },
  afternoon_summer: {
    key: 'afternoon_summer',
    season: 'summer',
    visualTheme: 'summer',
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
    overlapDecorAnchors: BASE_OVERLAP_DECOR_ANCHORS,
    tilePalette: createTilePalette('summer'),
    propPalette: createPropPalette('summer'),
    buildingPalette: createBuildingPalette('summer'),
  },
  night_spring: {
    key: 'night_spring',
    season: 'autumn',
    visualTheme: 'twilight_autumn',
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
    overlapDecorAnchors: BASE_OVERLAP_DECOR_ANCHORS,
    tilePalette: createTilePalette('twilight_autumn'),
    propPalette: createPropPalette('twilight_autumn'),
    buildingPalette: createBuildingPalette('twilight_autumn'),
  },
  noon_winter: {
    key: 'noon_winter',
    season: 'winter',
    visualTheme: 'winter',
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
    overlapDecorAnchors: adjustOverlapAlpha(0.04),
    tilePalette: createTilePalette('winter'),
    propPalette: createPropPalette('winter'),
    buildingPalette: createBuildingPalette('winter'),
  },
};

export const resolveSceneVariantFromParams = (params: URLSearchParams) => {
  const requested = params.get('variant')?.trim();
  if (requested && requested in SCENE_VARIANTS) {
    return SCENE_VARIANTS[requested as SeasonPreset];
  }
  return SCENE_VARIANTS.day_spring;
};
