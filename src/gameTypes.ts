import type { REPAIR_OUTLINE_COLORS, PLAYER_BASE } from './gameConfig';

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
