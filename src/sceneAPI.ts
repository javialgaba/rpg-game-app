export interface SceneAPI {
  add: any;
  input: any;
  tweens: any;
  textures: any;
  time: any;
  make: any;
  events: any;
  scale: any;
  game: any;
  sys: any;
  scene: any;
  load: any;
  anims: any;
  renderer: any;

  state: any;
  audio: any;
  player: any;
  enemies: any[];
  buildings: any[];
  projectiles: any[];
  chests: any[];
  pickups: any[];
  effects: any[];
  notes: any[];
  upgrades: any[];
  keys: Record<string, any>;
  parallaxSprites: any[];
  touchControls: any;
  touchControlsEnabled: boolean;
  touchDetection: any;
  touchLayer: any;
  controlsHint: any;
  lastTouchControlsVisibility: boolean | null;
  generatedLevel: any;
  generatedLevelActive: boolean;
  generatedTerrainMask: any;
  generatedTerrainMaskGraphics: any;
  levelDebugLayer: any;
  levelDebugGraphics: any;
  levelDebugVisible: boolean;
  levelDebugLastRenderAt: number;
  tileGraphics: any;
  lightingLayer: any;
  backgroundLayer: any;
  edgeLayer: any;
  shadowLayer: any;
  waterLayer: any;
  decorLayer: any;
  buildingLayer: any;
  characterLayer: any;
  effectsLayer: any;
  hudLayer: any;
  uiLayer: any;
  fxLayer: any;
  entityLayer: any;
  worldLayer: any;
  terrainBaseLayer: any;
  sceneVariant: any;

  ensureAudio(): void;
  uiTextStyle(size: number, color: string): any;
  addGuildNote(message: string): void;
  playTone(type?: string): void;
  isoToScreen(x: number, y: number, z?: number): { x: number; y: number };
  scaleGeneratedSize(size: [number, number]): [number, number];
  getIsoMetrics(): { tileW: number; tileH: number };
  clampIso(point: { x: number; y: number }, padding?: number): { x: number; y: number };
  screenToIso(x: number, y: number): { x: number; y: number };
  isGeneratedIsoWalkable(iso: { x: number; y: number }): boolean;
  getFootprintScreenBounds(cells: Array<{ x: number; y: number }>): any;
  getGeneratedFootprintSpriteLayout(placement: any, render: any, fallbackFrameSize: [number, number]): any;
  getFootprintCells(x: number, y: number, footprint?: { w: number; h: number }): Array<{ x: number; y: number }>;
  createBuildingHealthBar(x: number, y: number, width: number, height: number, depth: number): any;
  updateBuildingHealthBar(building: any): void;
  getSceneVariantBuildingTexture(placement: any): any;
  getSceneVariantPropTexture(placement: any): any;
  getSceneVariantDecorationTexture(placement: any): any;
  isGeneratedBoardEdgeCell(grid: { x: number; y: number }): boolean;
  addEnvironmentUniformSprite(layer: any, frame: string, x: number, y: number, uniformScale: number, depth: number, options?: any): any;
  getActiveSceneVariant(): any;
  getGeneratedWorldBounds(tileW: number, tileH: number): any;

  damageEnemy(target: any, power: number, type: string): void;

  // Combat / repair methods called from touch controls
  swingSword(time: number): void;
  fireBow(time: number, targetIso: { x: number; y: number }): void;
  castSpell(time: number, targetIso: { x: number; y: number }): void;
  tryRepairBuilding(): void;
  toggleRepairMode(): void;
  setRepairMode(enabled: boolean, announce: boolean): void;
  getAutoTargetIso(maxRange: number): { x: number; y: number };
  gainXp(amount: number): void;
  showLevelUpScreen(context: string): void;
  checkLevelClear(): void;
  spawnSparkleBurst(x: number, y: number, color: number, count: number, scale: number): void;
  getEnemyFrameKey(enemy: any, frame: number): string;
  getCurrentWorldTheme(): any;

  // Scene properties referenced by chests
  playerStats: any;
  upgradePauseContext: string;
  inventoryPanel: any;
  levelTimers: any[];
  levelUpOverlay: any;

  // Combat state
  levelDefeatsThisRound: number;
  levelEnemiesRemaining: number;
  levelRequiredDefeats: number;

  [key: string]: any;
}
