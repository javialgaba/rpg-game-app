import type { PLAYER_BASE, EnemyArchetypeConfig, EnemyVariantConfig, HeroClass, PersistentCardKey } from './gameConfig';

export type TouchActionKey = 'mainAttack' | 'classSkill' | 'repair';
export type TouchButtonSlot = 'left' | 'top' | 'right' | 'bottom';
export type TouchActionIcon = { texture: string; frame?: string } | null;
export type GeneratedSurroundAnchor =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'leftUpper'
  | 'leftLower'
  | 'rightUpper'
  | 'rightLower'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';
export type GeneratedSurroundLayer = 'background' | 'shadow' | 'edge' | 'water' | 'decor';

export type GeneratedSurroundDepth = number | { edge: 'top' | 'bottom'; tileOffset: number };

export interface ScreenFootprintBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  bottomCenterX: number;
  bottomCenterY: number;
}

export interface GeneratedSurroundPiece {
  frame: string;
  anchor: GeneratedSurroundAnchor;
  offsetXUnits: number;
  offsetYUnits: number;
  uniformScale: number;
  layer: GeneratedSurroundLayer;
  depth: GeneratedSurroundDepth;
  alpha?: number;
  originX?: number;
  originY?: number;
}

export type GeneratedSurroundTransform = Readonly<Pick<GeneratedSurroundPiece, 'offsetXUnits' | 'offsetYUnits' | 'uniformScale'>>;

export interface TouchControlsState {
  container: Phaser.GameObjects.Container;
  joystickBase: Phaser.GameObjects.Arc;
  joystickThumb: Phaser.GameObjects.Arc;
  joystickVector: { x: number; y: number };
  joystickPointerId: number | null;
  joystickCenter: { x: number; y: number };
  buttons: Partial<Record<TouchActionKey, Phaser.GameObjects.Container>>;
  repairButtons: Phaser.GameObjects.Container[];
  portraitOverlay: Phaser.GameObjects.Container;
}

export interface RunResumeBuildingSnapshot {
  id?: string;
  name: string;
  hp: number;
  max: number;
}

export interface RunResumeStateSnapshot {
  playerStats?: Partial<typeof PLAYER_BASE>;
  state?: Partial<Record<string, any>>;
  buildings?: RunResumeBuildingSnapshot[];
  heroClass?: HeroClass;
  cardTiers?: Record<PersistentCardKey, number>;
  lastSelectedCard?: string | null;
  lastOfferedCards?: string[];
  runStats?: { enemiesDefeated: number };
  authoredMapId?: string;
  note?: string;
}

// === 1. Core grid types ===

export interface GridPoint {
  x: number;
  y: number;
}

// === 2. Config-derived types ===

export type PlayerStats = typeof PLAYER_BASE;

export type GamePhase = 'splash' | 'countdown' | 'playing' | 'levelUp' | 'gameOver';

export interface GameState {
  health: number;
  gold: number;
  level: number;
  worldIndex: number;
  worldKey: string;
  worldRound: number;
  bossRound: boolean;
  worldCycle: number;
  phase: GamePhase;
  villageSafety: number;
  equipped: string;
  gameOverReason: string;
}

// === 3. Player entity ===

export interface PlayerEntity {
  iso: GridPoint;
  facing: GridPoint;
  lastAttack: number;
  lastSkill: number;
  invulnerableUntil: number;
  actionLockUntil: number;
  sheetKey: string;
  framePrefix: string;
  animPrefix: string;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Sprite;
}

// === 4. Enemy entity ===

export interface EnemyEntity {
  type: number;
  isBoss?: boolean;
  archetype: EnemyArchetypeConfig;
  variant: EnemyVariantConfig;
  variantTint: number | null;
  frameSheetKey: string;
  framePrefix: string;
  frameRow: number;
  iso: GridPoint;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  target: BuildingEntity;
  hp: number;
  maxHp: number;
  speed: number;
  buildingDamage: number;
  contactDamage: number;
  rewardGold: [number, number];
  touchCooldown: number;
  heroTouchCooldown: number;
  defeatFrame: number;
  dazedUntil: number;
  wobble: number;
  path: GridPoint[] | null;
  pathIndex: number;
  routeScore: number | null;
  routeCost: number | null;
  routeHealthFactor: number | null;
  retreating: boolean;
  defeated: boolean;
  countedDefeat: boolean;
  slowedUntil?: number;
  ward?: number;
  specialCooldown?: number;
}

// === 5. Building entity ===

export interface BuildingHealthBar {
  container: Phaser.GameObjects.Container;
  fill: Phaser.GameObjects.Rectangle;
  shine: Phaser.GameObjects.Rectangle;
  width: number;
  shineWidth: number;
}

export interface BuildingEntity {
  name: string;
  iso: GridPoint;
  footprint?: { w: number; h: number };
  footprintCells?: GridPoint[];
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  base?: Phaser.GameObjects.Image;
  hp: number;
  max: number;
  baseMax?: number;
  importance?: number;
  levelPlacementId?: string;
  healthBar?: BuildingHealthBar;
  underAttackUntil?: number;
  spriteAlpha?: number;
  baseAlpha?: number;
  shield?: { hp: number; expiresAt: number; sprite: Phaser.GameObjects.Arc };
}

export interface PlayerOccluder {
  label: string;
  category: string;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  baseAlpha: number;
  footprintCells?: GridPoint[];
  occluding: boolean;
}

// === 6. Route / spawn helpers ===

export interface RouteScore {
  building: BuildingEntity;
  path: GridPoint[];
  score: number;
  cost: number;
  healthFactor: number;
  distanceWeight: number;
}

export interface RouteResult {
  target: BuildingEntity;
  pathIso: GridPoint[];
  score: number;
  cost: number;
  healthFactor: number;
}

// === 7. Visual lookup results ===

export interface EnemyVisualResult {
  frameSheetKey: string;
  framePrefix: string;
  frameRow: number | null;
  tint: number | null;
}
