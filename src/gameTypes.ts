import type { REPAIR_OUTLINE_COLORS, PLAYER_BASE, EnemyArchetypeConfig, EnemyVariantConfig } from './gameConfig';

export type HeroChoice = 'male' | 'princess';
export type TouchActionKey = 'melee' | 'bow' | 'spell' | 'repair' | 'repairConfirm' | 'repairCancel';
export type TouchButtonSlot = 'left' | 'top' | 'right' | 'bottom';
export type UpgradePauseContext = 'roundClear' | 'chestBonus';
export type TouchActionIcon = { texture: string; frame?: string } | null;
export type RepairModeTargetState = keyof typeof REPAIR_OUTLINE_COLORS;
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
  heroChoice?: HeroChoice;
  upgradeLevels?: number[];
  note?: string;
}

export interface DroppedChest {
  iso: { x: number; y: number };
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Arc;
  reward: string;
  opened: boolean;
  bob: number;
  source: 'enemyDrop';
  spawnedAt: number;
  despawnAt: number;
  blinkAt: number;
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
  mana: number;
  gold: number;
  xp: number;
  level: number;
  worldIndex: number;
  worldKey: string;
  worldRound: number;
  bossRound: boolean;
  worldCycle: number;
  phase: GamePhase;
  villageSafety: number;
  equipped: string;
  repairMode: boolean;
  spell: string;
  inventoryOpen: boolean;
  gameOverReason: string;
}

// === 3. Player entity ===

export interface PlayerEntity {
  iso: GridPoint;
  facing: GridPoint;
  lastAttack: number;
  lastBow: number;
  lastSpell: number;
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
  rewardXp: number;
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
  importance?: number;
  levelPlacementId?: string;
  healthBar?: BuildingHealthBar;
  underAttackUntil?: number;
  spriteAlpha?: number;
  baseAlpha?: number;
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

// === 8. Repair system types ===

export interface RepairModeTargetInfo {
  building: BuildingEntity;
  distance: number;
}
