export type LevelToken =
  | 'G'
  | 'P'
  | 'C'
  | 'H1'
  | 'H2'
  | 'M'
  | 'W'
  | 'T'
  | 'D'
  | 'CH'
  | 'SP'
  | 'V'
  | 'L'
  | 'F'
  | 'S'
  | 'B'
  | 'PS';

export type TimeOfDay = 'morning' | 'noon' | 'afternoon' | 'night';

export interface GridPoint {
  x: number;
  y: number;
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
}

export interface AssetRenderMetadata {
  textureKey?: string;
  frameKey?: string;
  displaySize?: [number, number];
  origin?: [number, number];
  alpha?: number;
  z?: number;
  terrainFill?: number;
  terrainStroke?: number;
}

export interface AssetRegistryEntry {
  token: LevelToken;
  type: 'terrain' | 'path' | 'building' | 'prop' | 'interactable' | 'spawn' | 'marker' | 'blocker';
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
  decorationKind?: 'flowers' | 'mushrooms' | 'magicPlant' | 'sparkles';
  grid: GridPoint;
  iso: GridPoint;
  footprint: Footprint;
  cells: GridPoint[];
  render?: AssetRenderMetadata;
  blocksMovement: boolean;
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
  walkableGrid: boolean[][];
  blockedGrid: boolean[][];
  buildingGrid: (ProtectedTargetPlacement | null)[][];
  decorationGrid: (LevelPlacement | null)[][];
  spawnGrid: boolean[][];
  targetGrid: boolean[][];
  terrain: LevelPlacement[];
  objects: LevelPlacement[];
  decorations: LevelPlacement[];
  chests: LevelPlacement[];
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
