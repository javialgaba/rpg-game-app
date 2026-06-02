export type LevelToken =
  | 'grass'
  | 'path'
  | 'castle'
  | 'house-1'
  | 'house-2'
  | 'market'
  | 'well'
  | 'tree'
  | 'decoration'
  | 'monster-spawn'
  | 'village-center'
  | 'lamp'
  | 'fence'
  | 'sign'
  | 'blocker'
  | 'player-spawn';

export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'night';

export interface GridPoint {
  x: number;
  y: number;
}

export interface PlayableBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type GateDirection = 'north' | 'east' | 'south' | 'west';

export type AuthoredTerrainRole =
  | 'grass'
  | 'flower_grass'
  | 'stone_road'
  | 'plaza'
  | 'forest_floor'
  | 'gate_road';

export type AuthoredObjectRole =
  | 'tree_broadleaf'
  | 'tree_conifer'
  | 'rock_large'
  | 'pond'
  | 'bush'
  | 'flowers'
  | 'grass_tuft'
  | 'magic_patch'
  | 'lamp'
  | 'fence'
  | 'sign'
  | 'castle'
  | 'cottage'
  | 'bakery'
  | 'market'
  | 'well'
  | 'gate_n'
  | 'gate_e'
  | 'gate_s'
  | 'gate_w';

export type AuthoredMarkerRole =
  | 'player_spawn'
  | 'enemy_threshold_n'
  | 'enemy_threshold_e'
  | 'enemy_threshold_s'
  | 'enemy_threshold_w';

export interface AuthoredMapCell {
  terrain: AuthoredTerrainRole;
  object?: AuthoredObjectRole;
  marker?: AuthoredMarkerRole;
}

export interface AuthoredMapData {
  id: string;
  cells: AuthoredMapCell[][];
  errors: string[];
}

export interface GeneratedGate {
  id: string;
  direction: GateDirection;
  threshold: GridPoint;
  visualEntry: GridPoint;
  approachCells: GridPoint[];
  clearCells: GridPoint[];
  roadCells: GridPoint[];
  sightlineCells: GridPoint[];
}

export interface Footprint {
  w: number;
  h: number;
}

export interface LevelConfig {
  seed: string;
  timeOfDay: TimeOfDay;
  tileSize: number;
  decorationDensity: number;
  difficulty: number;
  matrix: LevelToken[][];
  playableBounds?: PlayableBounds;
  gates?: GeneratedGate[];
  authoredMap?: AuthoredMapData;
}

export interface AssetRenderMetadata {
  textureKey?: string;
  frameKey?: string;
  displaySize?: [number, number];
  origin?: [number, number];
  floorFrameWidth?: number;
  floorFrameBottomPadding?: number;
  alpha?: number;
  z?: number;
  terrainFill?: number;
  terrainStroke?: number;
  occludesPlayer?: boolean;
}

export interface AssetRegistryEntry {
  token: LevelToken;
  type: 'terrain' | 'path' | 'building' | 'prop' | 'spawn' | 'marker' | 'blocker';
  label: string;
  walkable: boolean;
  blocksMovement: boolean;
  footprint?: Footprint;
  protected?: boolean;
  importance?: number;
  maxHealth?: number;
  render?: AssetRenderMetadata;
  needsSlicing?: boolean;
}

export type AssetRegistry = Record<LevelToken, AssetRegistryEntry>;

export interface LevelPlacement {
  id: string;
  token: LevelToken;
  label: string;
  type: AssetRegistryEntry['type'];
  decorationKind?: 'flowers' | 'mushrooms' | 'magicPlant' | 'sparkles' | 'sapling' | 'fullTree' | 'lamp' | 'fence' | 'sign' | 'bush' | 'rocks' | 'grassPatch' | 'treeCluster' | 'puddle';
  grid: GridPoint;
  iso: GridPoint;
  footprint: Footprint;
  cells: GridPoint[];
  render?: AssetRenderMetadata;
  blocksMovement: boolean;
  scenicOnly?: boolean;
  authoredTerrainRole?: AuthoredTerrainRole;
  authoredObjectRole?: AuthoredObjectRole;
}

export interface ProtectedTargetPlacement extends LevelPlacement {
  maxHealth: number;
  currentHealth: number;
  importance: number;
  attackCells: GridPoint[];
}

export interface GeneratedLevel {
  config: LevelConfig;
  width: number;
  height: number;
  playableBounds: PlayableBounds;
  walkableGrid: boolean[][];
  playerWalkableGrid: boolean[][];
  playerReachableGrid: boolean[][];
  playerPocketCells: GridPoint[];
  blockedGrid: boolean[][];
  buildingGrid: (ProtectedTargetPlacement | null)[][];
  decorationGrid: (LevelPlacement | null)[][];
  spawnGrid: boolean[][];
  targetGrid: boolean[][];
  roadGrid: boolean[][];
  terrain: LevelPlacement[];
  scenicTerrain: LevelPlacement[];
  objects: LevelPlacement[];
  scenicObjects: LevelPlacement[];
  gates: GeneratedGate[];
  decorations: LevelPlacement[];
  spawnPoints: GridPoint[];
  playerSpawn: GridPoint | null;
  protectedTargets: ProtectedTargetPlacement[];
  warnings: string[];
  errors: string[];
}

export interface LevelValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}
