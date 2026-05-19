import Phaser from 'phaser';
import './style.css';
import { ASSET_REGISTRY } from './levels/assetRegistry';
import { generateLevel, validateGeneratedLevel } from './levels/generateLevel';
import { resolveLevelConfigFromParams, shouldRenderGeneratedLevelFromParams } from './levels/levelCatalog';
import { findGridPath, pathCost } from './levels/pathfinding';
import { isTimeOfDay, TIME_OF_DAY_PROFILES } from './levels/timeOfDay';
import { DEFAULT_PLAYABLE_BOUNDS, resolveSceneVariantFromParams, SCENE_VARIANTS, type SceneVariantConfig, type SeasonPreset } from './sceneVariants';
import {
  BOSS_CONFIGS,
  BOSS_ROUND_INDEX,
  COLORS,
  COMPACT_NOTE_MAX_CHARS,
  COMPACT_NOTES_MAX_VISIBLE,
  DESKTOP_NOTES_MAX_VISIBLE,
  ENEMY_ARCHETYPES,
  ENEMY_VARIANTS,
  HEIGHT,
  LEVEL_FIRST_SPAWN_DELAY,
  LEVEL_SPAWN_BASE,
  LEVEL_SPAWN_INTERVAL_BASE,
  LEVEL_SPAWN_INTERVAL_MIN,
  LEVEL_SPAWN_INTERVAL_STEP,
  LEVEL_SPAWN_MAX,
  LEVEL_SPAWN_PER_LEVEL,
  LEVEL_UP_CARD_XS,
  LEVEL_UP_MAX_PIPS,
  MAP_H,
  MAP_W,
  ORIGIN,
  PLAYER_BASE,
  REPAIR_AMOUNT,
  REPAIR_COOLDOWN,
  REPAIR_COST,
  REPAIR_RANGE,
  ROUNDS_PER_WORLD,
  TILE_H,
  TILE_W,
  WIDTH,
  WORLD_ENEMY_THEMES,
  WORLD_SEQUENCE,
} from './gameConfig';

type TouchActionKey = 'melee' | 'bow' | 'spell' | 'repair' | 'use' | 'inventory';
type TouchActionIcon = { texture: string; frame?: string } | null;
type GeneratedSurroundAnchor =
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
type GeneratedSurroundLayer = 'background' | 'shadow' | 'edge' | 'water' | 'decor';

interface GeneratedSurroundPiece {
  frame: string;
  anchor: GeneratedSurroundAnchor;
  offsetX: number;
  offsetY: number;
  uniformScale: number;
  layer: GeneratedSurroundLayer;
  depth: number;
  alpha?: number;
  originX?: number;
  originY?: number;
}

interface TouchControlsState {
  container: Phaser.GameObjects.Container;
  joystickBase: Phaser.GameObjects.Arc;
  joystickThumb: Phaser.GameObjects.Arc;
  joystickVector: { x: number; y: number };
  joystickPointerId: number | null;
  joystickCenter: { x: number; y: number };
  buttons: Record<TouchActionKey, Phaser.GameObjects.Container>;
  portraitOverlay: Phaser.GameObjects.Container;
}

interface RunResumeBuildingSnapshot {
  id?: string;
  name: string;
  hp: number;
  max: number;
}

interface RunResumeStateSnapshot {
  playerStats?: Partial<typeof PLAYER_BASE>;
  state?: Partial<FairyGuildScene['state']>;
  buildings?: RunResumeBuildingSnapshot[];
  note?: string;
}

class FairyGuildScene extends Phaser.Scene {
  [key: string]: any;

  constructor() {
    super('fairy-guild');
    this.player = null;
    this.playerStats = { ...PLAYER_BASE };
    this.state = {
      health: PLAYER_BASE.maxHealth,
      mana: PLAYER_BASE.maxMana,
      gold: 0,
      xp: 0,
      level: 1,
      worldIndex: 0,
      worldKey: WORLD_SEQUENCE[0],
      worldRound: 1,
      bossRound: false,
      worldCycle: 0,
      phase: 'splash',
      villageSafety: 100,
      equipped: 'Wooden Sword',
      repairMode: false,
      spell: 'Sparkle Burst',
      inventoryOpen: false,
      gameOverReason: '',
    };
    this.keys = {};
    this.enemies = [];
    this.projectiles = [];
    this.chests = [];
    this.pickups = [];
    this.buildings = [];
    this.effects = [];
    this.notes = [];
    this.upgrades = [];
    this.levelUpProgressBars = [];
    this.lastPointerIso = { x: 7, y: 7 };
    this.levelSpawnsPending = 0;
    this.levelEnemiesRemaining = 0;
    this.levelRequiredDefeats = 0;
    this.levelDefeatsThisRound = 0;
    this.levelSpawnFailures = 0;
    this.levelClearQueued = false;
    this.levelSpawnedCount = 0;
    this.levelTimers = [];
    this.generatedValidSpawnPoints = [];
    this.lastRepairAt = 0;
    this.repairModeIndicator = null;
    this.touchControls = null;
    this.touchControlsEnabled = false;
    this.touchDetection = null;
    this.lastTouchControlsVisibility = null;
    this.controlsHint = null;
    this.debugOverlay = null;
    this.debugOverlayVisible = false;
    this.generatedLevel = null;
    this.generatedLevelValidation = null;
    this.generatedLevelActive = false;
    this.generatedLevelConfigId = '';
    this.generatedLevelConfigLabel = '';
    this.generatedLevelSelectionWarnings = [];
    this.levelDebugGraphics = null;
    this.levelDebugVisible = false;
    this.levelDebugLastRenderAt = 0;
    this.generatedTerrainMask = null;
    this.generatedTerrainMaskGraphics = null;
    this.lightingLayer = null;
    this.timeOfDayOverlay = null;
    this.timeOfDayMist = null;
    this.lampGlowGraphics = null;
    this.timeOfDayOverride = null;
    this.sceneVariant = null;
    this.sceneVariantOverrideKey = null;
    this.resumeRunState = null as RunResumeStateSnapshot | null;
    this.resumeSkipSplash = false;
  }

  init(data) {
    this.sceneVariantOverrideKey = data?.sceneVariantKey ?? null;
    this.resumeRunState = data?.resumeRunState ?? null;
    this.resumeSkipSplash = Boolean(data?.resumeSkipSplash);
  }

  preload() {
    this.load.image('villageBoard', '/assets/village-board.png');
    this.load.image('levelUpUI', '/assets/level-up-ui.png');
    this.load.image('gameOverUI', '/assets/game-over-ui.png');
    this.load.image('statusPanelUI', '/assets/status-panel-ui.png');
    this.load.image('guildNotesUI', '/assets/guild-notes-ui-transparent.png');
    this.load.image('repairTool', '/assets/repair-tool.png');
    this.load.image('heroSheet', '/assets/hero-sheet.png');
    this.load.image('monsterSheet', '/assets/monster-pickup-sheet.png');
    this.load.atlas('worldTilesAtlas', '/assets/world_tiles_atlas.png', '/assets/world_tiles_atlas.json');
    this.load.atlas('buildingsAtlas', '/assets/buildings_atlas.png', '/assets/buildings_atlas.json');
    this.load.atlas('uiAtlas', '/assets/ui_atlas.png', '/assets/ui_atlas.json');
    this.load.atlas('touchControlsAtlas', '/assets/touch_controls_atlas.png', '/assets/touch_controls_atlas.json');
    this.load.atlas('hudUiAtlas', '/assets/hud_ui_atlas.png', '/assets/hud_ui_atlas.json');
    this.load.atlas('hudBarsAtlas', '/assets/hud_bars_atlas.png', '/assets/hud_bars_atlas.json');
    this.load.atlas('worldEdgesAtlas', '/assets/world_edges_atlas.png', '/assets/world_edges_atlas.json');
    this.load.atlas('environmentFrameAtlas', '/assets/environment_frame_atlas.png', '/assets/environment_frame_atlas.json');
    this.load.atlas('effectsAtlas', '/assets/effects_atlas.png', '/assets/effects_atlas.json');
    this.preloadSceneVariantAssets();
    this.preloadWorldEnemyAssets();
  }

  preloadSceneVariantAssets() {
    const variantKeys = ['day_spring', 'afternoon_summer', 'night_spring', 'noon_winter'];
    variantKeys.forEach((variantKey) => {
      this.load.image(`sceneVariantBackground_${variantKey}`, `/assets/scene-variants/${variantKey}-bg.png`);
      this.load.image(`sceneVariantFrame_${variantKey}`, `/assets/scene-variants/${variantKey}-frame.png`);
      this.load.image(`sceneVariantForeground_${variantKey}`, `/assets/scene-variants/${variantKey}-fg.png`);
    });
    this.load.image('winter_grass_01', '/assets/scene-variants/winter-grass-01.png');
    this.load.image('winter_path_01', '/assets/scene-variants/winter-path-01.png');
    this.load.image('winter_pine_01', '/assets/scene-variants/winter-pine-01.png');
    this.load.image('winter_oak_01', '/assets/scene-variants/winter-oak-01.png');
    this.load.image('winter_flower_patch_01', '/assets/scene-variants/winter-flower-patch-01.png');
  }

  preloadWorldEnemyAssets() {
    const assetVersion = import.meta.env.DEV ? `${Date.now()}` : '20260519-world-enemies';
    WORLD_SEQUENCE.forEach((worldKey) => {
      const theme = WORLD_ENEMY_THEMES[worldKey];
      this.load.image(
        theme.eliteAssetKey,
        `/assets/world-monsters/${worldKey}-elite.png?v=${assetVersion}`,
      );
      this.load.image(
        theme.bossAssetKey,
        `/assets/world-bosses/${worldKey}-boss.png?v=${assetVersion}`,
      );
    });
  }

  create() {
    this.resetRuntimeState();
    if (import.meta.env.DEV) {
      (window as typeof window & { __fairyGuildScene?: FairyGuildScene }).__fairyGuildScene = this;
    }
    this.createAudio();
    this.registerSheetFrames('heroSheet', 8, 4, 'hero');
    this.registerSheetFrames('monsterSheet', 8, 5, 'monster');
    this.registerWorldEnemySheets();
    this.registerUiArtFrames();
    this.createGeneratedTextures();

    this.backgroundLayer = this.add.layer().setDepth(0);
    this.shadowLayer = this.add.layer().setDepth(40);
    this.terrainBaseLayer = this.add.layer().setDepth(100);
    this.edgeLayer = this.add.layer().setDepth(150);
    this.waterLayer = this.add.layer().setDepth(190);
    this.decorLayer = this.add.layer().setDepth(240);
    this.buildingLayer = this.add.layer().setDepth(300);
    this.characterLayer = this.add.layer().setDepth(360);
    this.effectsLayer = this.add.layer().setDepth(440);
    this.lightingLayer = this.add.layer().setDepth(4700);
    this.hudLayer = this.add.layer().setDepth(5000);
    this.touchLayer = this.add.layer().setDepth(7700);
    this.worldLayer = this.terrainBaseLayer;
    this.entityLayer = this.characterLayer;
    this.fxLayer = this.effectsLayer;
    this.uiLayer = this.hudLayer;

    this.createBackground();
    this.createVillage();
    this.createTimeOfDayLayer();
    this.createPlayer();
    this.createControls();
    this.createHud();
    this.createTouchControls();
    this.setupMobileViewportHandlers();
    this.createUpgrades();
    this.createPhaseOverlays();
    this.spawnInitialChests();
    if (this.resumeRunState && this.resumeSkipSplash) {
      this.restoreRunStateFromResume();
      this.startLevelCountdown();
      this.resumeRunState = null;
      this.resumeSkipSplash = false;
      this.sceneVariantOverrideKey = null;
    } else {
      this.showSplashScreen();
    }

    this.time.addEvent({
      delay: 1250,
      loop: true,
      callback: () => {
        if (this.state.phase === 'playing') {
          this.regenMana(2 + Math.floor(this.state.level / 2));
          this.updateVillageSafety();
          this.checkFailureState();
        }
      },
    });

    this.addGuildNote('The village is safe for now!');
    this.addGuildNote('Press E near a chest for a cheerful surprise.');
  }

  registerWorldEnemySheets() {
    WORLD_SEQUENCE.forEach((worldKey) => {
      const theme = WORLD_ENEMY_THEMES[worldKey];
      if (this.textures.exists(theme.eliteAssetKey)) {
        this.registerSheetFrames(theme.eliteAssetKey, 8, 1, theme.eliteFramePrefix);
      }
      if (this.textures.exists(theme.bossAssetKey)) {
        this.registerSheetFrames(theme.bossAssetKey, 8, 1, theme.bossFramePrefix);
      }
    });
  }

  resetRuntimeState() {
    this.player = null;
    this.playerStats = { ...PLAYER_BASE };
    this.state = {
      health: PLAYER_BASE.maxHealth,
      mana: PLAYER_BASE.maxMana,
      gold: 0,
      xp: 0,
      level: 1,
      worldIndex: 0,
      worldKey: WORLD_SEQUENCE[0],
      worldRound: 1,
      bossRound: false,
      worldCycle: 0,
      phase: 'splash',
      villageSafety: 100,
      equipped: 'Wooden Sword',
      repairMode: false,
      spell: 'Sparkle Burst',
      inventoryOpen: false,
      gameOverReason: '',
    };
    this.enemies = [];
    this.projectiles = [];
    this.chests = [];
    this.pickups = [];
    this.buildings = [];
    this.effects = [];
    this.notes = [];
    this.upgrades = [];
    this.levelUpProgressBars = [];
    this.lastPointerIso = { x: 7, y: 7 };
    this.levelSpawnsPending = 0;
    this.levelEnemiesRemaining = 0;
    this.levelRequiredDefeats = 0;
    this.levelDefeatsThisRound = 0;
    this.levelSpawnFailures = 0;
    this.levelClearQueued = false;
    this.levelSpawnedCount = 0;
    this.levelTimers = [];
    this.generatedValidSpawnPoints = [];
    this.lastRepairAt = 0;
    this.repairModeIndicator = null;
    this.touchControls = null;
    this.touchControlsEnabled = false;
    this.touchDetection = null;
    this.lastTouchControlsVisibility = null;
    this.controlsHint = null;
    this.debugOverlay = null;
    this.debugOverlayVisible = false;
    this.generatedLevel = null;
    this.generatedLevelValidation = null;
    this.generatedLevelActive = false;
    this.generatedLevelConfigId = '';
    this.generatedLevelConfigLabel = '';
    this.generatedLevelSelectionWarnings = [];
    this.levelDebugGraphics = null;
    this.levelDebugVisible = false;
    this.levelDebugLastRenderAt = 0;
    this.generatedTerrainMask = null;
    this.generatedTerrainMaskGraphics = null;
    this.lightingLayer = null;
    this.timeOfDayOverlay = null;
    this.timeOfDayMist = null;
    this.lampGlowGraphics = null;
    this.timeOfDayOverride = null;
    this.sceneVariant = null;
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.updatePointerIso();
    if (this.state.phase === 'playing') {
      this.updatePlayer(dt, time);
      this.updateEnemies(dt, time);
      this.updateProjectiles(dt);
      this.updatePickups(dt);
      this.updateChests(time);
      this.checkLevelClear();
      this.checkFailureState();
    }
    this.updateEffects(dt);
    this.updateDepths();
    this.updateRepairModeIndicator(time);
    this.updateTouchControls();
    this.updateHud();
    this.updateDebugOverlay();
    this.updateGeneratedLevelDebug(time);
    this.syncDevDiagnostics();
    this.consumeDevCommand();
  }

  registerSheetFrames(key, cols, rows, prefix) {
    const texture = this.textures.get(key);
    const image = texture.getSourceImage();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const frameName = `${prefix}-${row}-${col}`;
        if (texture.has(frameName)) {continue;}
        const x = Math.round((image.width / cols) * col);
        const y = Math.round((image.height / rows) * row);
        const nextX = Math.round((image.width / cols) * (col + 1));
        const nextY = Math.round((image.height / rows) * (row + 1));
        texture.add(frameName, 0, x, y, nextX - x, nextY - y);
      }
    }
  }

  registerUiArtFrames() {
    const addFrame = (texture, name, x, y, width, height) => {
      if (!texture.has(name)) {
        texture.add(name, 0, x, y, width, height);
      }
    };
    const status = this.textures.get('statusPanelUI');
    addFrame(status, 'panel', 34, 310, 1764, 250);
    const notes = this.textures.get('guildNotesUI');
    addFrame(notes, 'panel', 94, 126, 1352, 770);
  }

  createGeneratedTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false } as any);
    const make = (key, width, height, draw) => {
      g.clear();
      if (this.textures.exists(key)) {this.textures.remove(key);}
      draw(g, width, height);
      g.generateTexture(key, width, height);
    };

    make('castleTexture', 180, 156, (gfx) => {
      gfx.fillStyle(0x4f8bd6, 0.22);
      gfx.fillEllipse(90, 132, 128, 26);
      gfx.fillStyle(0xf6e7c6, 1);
      gfx.fillRoundedRect(50, 58, 80, 64, 8);
      gfx.fillStyle(0xffd37a, 1);
      gfx.fillTriangle(42, 62, 90, 20, 138, 62);
      gfx.fillStyle(0xffa75e, 1);
      gfx.fillRect(58, 66, 64, 10);
      gfx.fillStyle(0xd9f6ff, 1);
      gfx.fillRoundedRect(80, 85, 20, 30, 8);
      gfx.fillStyle(0x8d70d6, 1);
      gfx.fillRoundedRect(24, 70, 30, 48, 6);
      gfx.fillRoundedRect(126, 70, 30, 48, 6);
      gfx.fillStyle(0xffd37a, 1);
      gfx.fillTriangle(18, 72, 39, 42, 60, 72);
      gfx.fillTriangle(120, 72, 141, 42, 162, 72);
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(90, 48, 6);
      gfx.lineStyle(4, 0x7d5a35, 0.65);
      gfx.strokeRoundedRect(50, 58, 80, 64, 8);
      gfx.strokeRoundedRect(24, 70, 30, 48, 6);
      gfx.strokeRoundedRect(126, 70, 30, 48, 6);
    });

    make('cottageTexture', 142, 120, (gfx) => {
      gfx.fillStyle(0x7f5b38, 0.22);
      gfx.fillEllipse(71, 100, 96, 20);
      gfx.fillStyle(0xfff0c9, 1);
      gfx.fillRoundedRect(34, 48, 74, 48, 8);
      gfx.fillStyle(0xf4a13f, 1);
      gfx.fillTriangle(24, 52, 72, 18, 118, 52);
      gfx.fillStyle(0xffc35c, 1);
      gfx.fillRoundedRect(36, 50, 72, 10, 4);
      gfx.fillStyle(0x6ac5ff, 1);
      gfx.fillRoundedRect(48, 64, 16, 16, 5);
      gfx.fillRoundedRect(78, 64, 16, 16, 5);
      gfx.fillStyle(0xa87343, 1);
      gfx.fillRoundedRect(63, 74, 16, 24, 8);
      gfx.lineStyle(4, 0x74523a, 0.6);
      gfx.strokeRoundedRect(34, 48, 74, 48, 8);
    });

    make('bakeryTexture', 142, 120, (gfx) => {
      gfx.fillStyle(0x7f5b38, 0.22);
      gfx.fillEllipse(71, 100, 96, 20);
      gfx.fillStyle(0xffe4b8, 1);
      gfx.fillRoundedRect(30, 50, 82, 46, 8);
      gfx.fillStyle(0x8bd3ff, 1);
      gfx.fillTriangle(22, 52, 72, 16, 122, 52);
      gfx.fillStyle(0xffffff, 1);
      for (let i = 0; i < 5; i += 1) {
        gfx.fillRect(31 + i * 16, 52, 8, 22);
      }
      gfx.fillStyle(0xed7a62, 1);
      for (let i = 0; i < 5; i += 1) {
        gfx.fillRect(39 + i * 16, 52, 8, 22);
      }
      gfx.fillStyle(0xc68647, 1);
      gfx.fillRoundedRect(60, 74, 22, 22, 6);
      gfx.fillStyle(0x8b5a30, 1);
      gfx.fillEllipse(72, 66, 36, 12);
      gfx.lineStyle(4, 0x73553f, 0.58);
      gfx.strokeRoundedRect(30, 50, 82, 46, 8);
    });

    make('marketTexture', 150, 110, (gfx) => {
      gfx.fillStyle(0x7f5b38, 0.2);
      gfx.fillEllipse(75, 92, 110, 18);
      gfx.fillStyle(0x875b3e, 1);
      gfx.fillRoundedRect(40, 62, 70, 24, 6);
      gfx.fillStyle(0xf8f2d0, 1);
      gfx.fillRoundedRect(32, 38, 86, 26, 5);
      gfx.fillStyle(0xed6b68, 1);
      for (let i = 0; i < 5; i += 1) {
        gfx.fillRect(34 + i * 17, 38, 9, 27);
      }
      gfx.fillStyle(0x7fd56a, 1);
      gfx.fillCircle(54, 72, 7);
      gfx.fillStyle(0xffd15a, 1);
      gfx.fillCircle(75, 73, 7);
      gfx.fillStyle(0xff8f6f, 1);
      gfx.fillCircle(96, 72, 7);
      gfx.lineStyle(4, 0x765239, 0.55);
      gfx.strokeRoundedRect(32, 38, 86, 26, 5);
    });

    make('treeTexture', 104, 132, (gfx) => {
      gfx.fillStyle(0x7a5330, 1);
      gfx.fillRoundedRect(45, 72, 16, 40, 7);
      gfx.fillStyle(0x399b5d, 1);
      gfx.fillCircle(52, 46, 30);
      gfx.fillStyle(0x55ba67, 1);
      gfx.fillCircle(34, 58, 26);
      gfx.fillStyle(0x70cf76, 1);
      gfx.fillCircle(70, 60, 28);
      gfx.fillStyle(0xefffa4, 0.75);
      gfx.fillCircle(67, 37, 4);
      gfx.fillCircle(31, 51, 3);
      gfx.lineStyle(4, 0x276f45, 0.35);
      gfx.strokeCircle(52, 46, 30);
    });

    make('wellTexture', 78, 84, (gfx) => {
      gfx.fillStyle(0x6d95bd, 1);
      gfx.fillEllipse(39, 58, 48, 20);
      gfx.fillStyle(0xd7edf8, 1);
      gfx.fillEllipse(39, 50, 46, 18);
      gfx.fillStyle(0x9a7145, 1);
      gfx.fillRect(21, 28, 6, 34);
      gfx.fillRect(51, 28, 6, 34);
      gfx.fillStyle(0xf3b85e, 1);
      gfx.fillTriangle(16, 30, 39, 8, 62, 30);
      gfx.lineStyle(3, 0x735239, 0.6);
      gfx.strokeEllipse(39, 50, 46, 18);
    });

    make('lampTexture', 46, 94, (gfx) => {
      gfx.fillStyle(0x664735, 1);
      gfx.fillRoundedRect(20, 34, 6, 46, 3);
      gfx.fillStyle(0xffef9b, 1);
      gfx.fillCircle(23, 26, 12);
      gfx.fillStyle(0xffffff, 0.6);
      gfx.fillCircle(19, 22, 4);
      gfx.lineStyle(3, 0x74533a, 0.7);
      gfx.strokeCircle(23, 26, 12);
      gfx.strokeRoundedRect(14, 80, 18, 7, 3);
    });

    make('signTexture', 70, 80, (gfx) => {
      gfx.fillStyle(0x7b5232, 1);
      gfx.fillRoundedRect(32, 26, 6, 48, 3);
      gfx.fillStyle(0xb9783d, 1);
      gfx.fillRoundedRect(12, 22, 46, 22, 5);
      gfx.fillStyle(0xffe6a3, 1);
      gfx.fillCircle(48, 33, 3);
      gfx.lineStyle(3, 0x704b32, 0.7);
      gfx.strokeRoundedRect(12, 22, 46, 22, 5);
    });

    make('chestTexture', 72, 58, (gfx) => {
      gfx.fillStyle(0xffdf7a, 0.35);
      gfx.fillEllipse(36, 44, 54, 12);
      gfx.fillStyle(0x9a6033, 1);
      gfx.fillRoundedRect(14, 24, 44, 22, 5);
      gfx.fillStyle(0xd5893e, 1);
      gfx.fillRoundedRect(14, 17, 44, 18, 8);
      gfx.fillStyle(0xffd45b, 1);
      gfx.fillRoundedRect(32, 27, 8, 12, 3);
      gfx.lineStyle(3, 0x66442a, 0.7);
      gfx.strokeRoundedRect(14, 24, 44, 22, 5);
      gfx.strokeRoundedRect(14, 17, 44, 18, 8);
    });

    make('coinTexture', 36, 36, (gfx) => {
      gfx.fillStyle(0xffcf4d, 1);
      gfx.fillCircle(18, 18, 13);
      gfx.fillStyle(0xfff3a6, 0.9);
      gfx.fillCircle(14, 13, 4);
      gfx.lineStyle(3, 0xbc842d, 0.9);
      gfx.strokeCircle(18, 18, 13);
    });

    make('heartTexture', 38, 36, (gfx) => {
      gfx.fillStyle(0xf05c78, 1);
      gfx.fillCircle(14, 14, 8);
      gfx.fillCircle(24, 14, 8);
      gfx.fillTriangle(7, 17, 31, 17, 19, 32);
      gfx.fillStyle(0xffb5c4, 0.75);
      gfx.fillCircle(13, 12, 3);
    });

    make('manaTexture', 38, 38, (gfx) => {
      gfx.fillStyle(0x76d9ff, 1);
      gfx.fillCircle(19, 19, 13);
      gfx.fillStyle(0xffffff, 0.7);
      gfx.fillCircle(15, 14, 4);
      gfx.lineStyle(3, 0x348fce, 0.8);
      gfx.strokeCircle(19, 19, 13);
    });

    make('xpTexture', 42, 42, (gfx) => {
      gfx.fillStyle(0xffec73, 1);
      const points = [];
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0 ? 17 : 7;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push(new Phaser.Geom.Point(21 + Math.cos(a) * r, 21 + Math.sin(a) * r));
      }
      gfx.fillPoints(points, true);
      gfx.lineStyle(3, 0xd49a28, 0.7);
      gfx.strokePoints(points, true);
    });

    make('swordIconTexture', 48, 48, (gfx) => {
      gfx.fillStyle(0x8fd5ff, 1);
      gfx.fillTriangle(26, 6, 34, 27, 19, 27);
      gfx.fillStyle(0x9b6a39, 1);
      gfx.fillRoundedRect(20, 27, 8, 13, 3);
      gfx.fillStyle(0xffd86b, 1);
      gfx.fillRoundedRect(12, 26, 24, 6, 3);
      gfx.lineStyle(2, 0x5f4a36, 0.8);
      gfx.strokeTriangle(26, 6, 34, 27, 19, 27);
    });

    make('bowIconTexture', 48, 48, (gfx) => {
      gfx.lineStyle(5, 0x9a6238, 1);
      gfx.beginPath();
      gfx.arc(24, 24, 16, -1.2, 1.2, false);
      gfx.strokePath();
      gfx.lineStyle(2, 0xf7efd2, 1);
      gfx.lineBetween(31, 9, 31, 39);
      gfx.fillStyle(0x7fd6ff, 1);
      gfx.fillTriangle(9, 24, 23, 18, 23, 30);
    });

    make('spellIconTexture', 48, 48, (gfx) => {
      gfx.fillStyle(0x8ae7ff, 1);
      gfx.fillCircle(24, 24, 13);
      gfx.fillStyle(0xfff49a, 1);
      gfx.fillCircle(24, 8, 4);
      gfx.fillCircle(40, 24, 4);
      gfx.fillCircle(24, 40, 4);
      gfx.fillCircle(8, 24, 4);
      gfx.lineStyle(3, 0x4b9ed1, 0.8);
      gfx.strokeCircle(24, 24, 13);
    });

    make('bootIconTexture', 48, 48, (gfx) => {
      gfx.fillStyle(0xcf7b45, 1);
      gfx.fillRoundedRect(15, 13, 15, 24, 5);
      gfx.fillRoundedRect(23, 28, 17, 9, 4);
      gfx.fillStyle(0xffd86b, 1);
      gfx.fillRect(16, 20, 14, 4);
      gfx.lineStyle(3, 0x6f4a31, 0.75);
      gfx.strokeRoundedRect(15, 13, 15, 24, 5);
    });

    make('shieldIconTexture', 48, 48, (gfx) => {
      gfx.fillStyle(0x7ee0aa, 1);
      gfx.fillTriangle(24, 7, 39, 15, 34, 34);
      gfx.fillTriangle(24, 7, 9, 15, 14, 34);
      gfx.fillTriangle(14, 34, 34, 34, 24, 43);
      gfx.fillStyle(0xffffff, 0.45);
      gfx.fillTriangle(24, 11, 31, 17, 24, 35);
      gfx.lineStyle(3, 0x378c63, 0.8);
      gfx.strokeTriangle(24, 7, 39, 15, 34, 34);
      gfx.strokeTriangle(24, 7, 9, 15, 14, 34);
    });
  }

  getIsoMetrics() {
    const generated = this.generatedLevelActive && this.generatedLevel;
    const scale = generated ? this.generatedLevel.config.tileSize / 64 : 1;
    const tileW = TILE_W * scale;
    const tileH = TILE_H * scale;
    const mapW = generated ? this.generatedLevel.width : MAP_W;
    const mapH = generated ? this.generatedLevel.height : MAP_H;
    const defaultCenterY = ORIGIN.y + ((MAP_W - 1 + MAP_H - 1) * TILE_H) / 4;
    const origin = generated
      ? {
        x: ORIGIN.x,
        y: defaultCenterY - ((mapW - 1 + mapH - 1) * tileH) / 4,
      }
      : ORIGIN;
    return { origin, tileW, tileH, scale, mapW, mapH };
  }

  scaleGeneratedSize(size) {
    const scale = this.generatedLevelActive && this.generatedLevel ? this.generatedLevel.config.tileSize / 64 : 1;
    return [size[0] * scale, size[1] * scale];
  }

  isoToScreen(x, y, z = 0) {
    const { origin, tileW, tileH, scale } = this.getIsoMetrics();
    return {
      x: origin.x + (x - y) * (tileW / 2),
      y: origin.y + (x + y) * (tileH / 2) - z * scale,
    };
  }

  screenToIso(x, y) {
    const { origin, tileW, tileH } = this.getIsoMetrics();
    const sx = x - origin.x;
    const sy = y - origin.y;
    return {
      x: sy / tileH + sx / tileW,
      y: sy / tileH - sx / tileW,
    };
  }

  clampIso(point, padding = 0.5) {
    const maxX = (this.generatedLevelActive && this.generatedLevel ? this.generatedLevel.width : MAP_W) - 1 - padding;
    const maxY = (this.generatedLevelActive && this.generatedLevel ? this.generatedLevel.height : MAP_H) - 1 - padding;
    point.x = Phaser.Math.Clamp(point.x, padding, maxX);
    point.y = Phaser.Math.Clamp(point.y, padding, maxY);
    return point;
  }

  isGeneratedIsoWalkable(iso) {
    if (!this.generatedLevelActive || !this.generatedLevel) {
      return true;
    }
    const cell = this.isoToGridCell(iso);
    return Boolean(this.generatedLevel.walkableGrid[cell.y]?.[cell.x]);
  }

  createBackground() {
    const useGeneratedMap = this.shouldRenderGeneratedLevel();
    const sceneVariant = this.sceneVariant ?? resolveSceneVariantFromParams(new URLSearchParams(window.location.search));
    this.sceneVariant = sceneVariant;
    const bg = this.add.graphics();
    const topColor = useGeneratedMap ? 0xb2d9ec : 0x7fc8f4;
    const bottomColor = useGeneratedMap ? 0xe7f1ef : 0xd6f3ff;
    bg.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
    bg.fillRect(0, 0, WIDTH, HEIGHT);
    bg.fillStyle(sceneVariant.key === 'night_spring' ? 0x29345a : 0x67c176, useGeneratedMap ? 0.48 : 1);
    bg.fillEllipse(WIDTH / 2, 700, 1320, 316);
    this.backgroundLayer.add(bg);
    if (useGeneratedMap) {
      this.renderGeneratedScreenBackdropFill();
      return;
    }
    const board = this.add.image(WIDTH / 2, HEIGHT / 2, 'villageBoard')
      .setDisplaySize(WIDTH, HEIGHT)
      .setAlpha(0.88);
    this.backgroundLayer.add(board);
  }

  renderGeneratedScreenBackdropFill() {
    // Scenic surround is now composed in world space around the generated board.
  }

  getActiveSceneVariant() {
    if (this.sceneVariant) {
      return this.sceneVariant as SceneVariantConfig;
    }
    if (this.sceneVariantOverrideKey && SCENE_VARIANTS[this.sceneVariantOverrideKey as SeasonPreset]) {
      this.sceneVariant = SCENE_VARIANTS[this.sceneVariantOverrideKey as SeasonPreset];
      return this.sceneVariant as SceneVariantConfig;
    }
    const resolved = resolveSceneVariantFromParams(new URLSearchParams(window.location.search));
    this.sceneVariant = resolved;
    return resolved;
  }

  syncWorldStateWithSceneVariant() {
    const variant = this.getActiveSceneVariant();
    const worldIndex = Math.max(0, WORLD_SEQUENCE.indexOf(variant.key));
    this.state.worldIndex = worldIndex;
    this.state.worldKey = variant.key;
    this.state.worldRound = this.state.worldRound || 1;
    this.state.bossRound = this.state.worldRound === BOSS_ROUND_INDEX;
    this.state.worldCycle = this.state.worldCycle || 0;
  }

  getCurrentWorldTheme() {
    return WORLD_ENEMY_THEMES[this.state.worldKey as SeasonPreset] ?? WORLD_ENEMY_THEMES.day_spring;
  }

  getCurrentRoundTitle() {
    if (this.state.bossRound) {
      return this.getCurrentWorldTheme().bossLabel;
    }
    return `Level ${this.state.level}`;
  }

  getNextWorldProgressionState() {
    if (!this.state.bossRound) {
      const nextWorldRound = Math.min(ROUNDS_PER_WORLD, this.state.worldRound + 1);
      return {
        worldIndex: this.state.worldIndex,
        worldKey: this.state.worldKey,
        worldRound: nextWorldRound,
        bossRound: nextWorldRound === BOSS_ROUND_INDEX,
        worldCycle: this.state.worldCycle,
      };
    }
    const nextIndex = (this.state.worldIndex + 1) % WORLD_SEQUENCE.length;
    const looped = nextIndex === 0;
    return {
      worldIndex: nextIndex,
      worldKey: WORLD_SEQUENCE[nextIndex],
      worldRound: 1,
      bossRound: false,
      worldCycle: this.state.worldCycle + (looped ? 1 : 0),
    };
  }

  createRunResumeSnapshot(nextProgression, note) {
    return {
      playerStats: { ...this.playerStats },
      state: {
        health: this.state.health,
        mana: this.state.mana,
        gold: this.state.gold,
        xp: this.state.xp,
        level: this.state.level,
        villageSafety: this.state.villageSafety,
        equipped: this.state.equipped,
        repairMode: false,
        spell: this.state.spell,
        inventoryOpen: false,
        gameOverReason: '',
        ...nextProgression,
      },
      buildings: this.buildings.map((building) => ({
        id: building.levelPlacementId ?? building.name,
        name: building.name,
        hp: building.hp,
        max: building.max,
      })),
      note,
    };
  }

  restoreRunStateFromResume() {
    if (!this.resumeRunState) {
      return;
    }
    if (this.resumeRunState.playerStats) {
      this.playerStats = { ...this.playerStats, ...this.resumeRunState.playerStats };
    }
    if (this.resumeRunState.state) {
      this.state = { ...this.state, ...this.resumeRunState.state, phase: 'countdown', inventoryOpen: false, repairMode: false };
    }
    const buildingMap = new Map<string, RunResumeBuildingSnapshot>(
      (this.resumeRunState.buildings ?? []).map((building) => [building.id ?? building.name, building] as const),
    );
    this.buildings.forEach((building) => {
      const snapshot = buildingMap.get(building.levelPlacementId ?? building.name) ?? buildingMap.get(building.name);
      if (!snapshot) {
        return;
      }
      building.hp = Math.max(0, Math.min(snapshot.hp, building.max));
      building.max = snapshot.max ?? building.max;
      this.updateBuildingRepairState(building);
    });
    if (this.resumeRunState.note) {
      this.addGuildNote(this.resumeRunState.note);
    }
    this.updateVillageSafety();
  }

  getSceneVariantTerrainTexture(token) {
    const variant = this.getActiveSceneVariant();
    if (variant.key === 'noon_winter') {
      if (token === 'path' || token === 'village-center' || token === 'player-spawn') {
        return { textureKey: 'winter_path_01', frameKey: undefined };
      }
      return { textureKey: 'winter_grass_01', frameKey: undefined };
    }
    if (token === 'path' || token === 'village-center' || token === 'player-spawn') {
      return { textureKey: 'worldTilesAtlas', frameKey: variant.tilePalette.path[0] };
    }
    return { textureKey: 'worldTilesAtlas', frameKey: variant.tilePalette.grass[0] };
  }

  getSceneVariantPropTexture(placement) {
    const variant = this.getActiveSceneVariant();
    if (variant.key !== 'noon_winter') {
      return null;
    }
    if (placement.token === 'tree') {
      return { textureKey: 'winter_pine_01', frameKey: undefined };
    }
    if (placement.type === 'terrain' && placement.token === 'decoration') {
      return { textureKey: 'winter_flower_patch_01', frameKey: undefined };
    }
    return null;
  }

  getSceneVariantDecorationTexture(placement) {
    const variant = this.getActiveSceneVariant();
    if (variant.key !== 'noon_winter') {
      return null;
    }
    if (placement.decorationKind === 'flowers' || placement.decorationKind === 'grassPatch') {
      return { textureKey: 'winter_flower_patch_01', frameKey: undefined };
    }
    if (placement.decorationKind === 'sapling' || placement.decorationKind === 'fullTree' || placement.decorationKind === 'treeCluster') {
      return { textureKey: 'winter_pine_01', frameKey: undefined };
    }
    return null;
  }

  addSceneVariantImage(
    layer,
    textureKey,
    x,
    y,
    uniformScale,
    depth,
    options: { alpha?: number; originX?: number; originY?: number; tint?: number } = {},
  ) {
    if (!this.textures.exists(textureKey)) {
      return null;
    }
    const sprite = this.add.image(x, y, textureKey)
      .setOrigin(options.originX ?? 0.5, options.originY ?? 0.5)
      .setScale(uniformScale)
      .setDepth(depth)
      .setAlpha(options.alpha ?? 1);
    if (options.tint) {
      sprite.setTint(options.tint);
    }
    layer.add(sprite);
    return sprite;
  }

  hasStaticSceneVariantFrame(config) {
    return Boolean(config)
      && this.textures.exists(config.backgroundAssetKey)
      && this.textures.exists(config.exteriorFrameAssetKey);
  }

  renderSceneVariantBackground(config, bounds) {
    const baseScale = Math.max(WIDTH / 2048, HEIGHT / 1152);
    this.addSceneVariantImage(
      this.backgroundLayer,
      config.backgroundAssetKey,
      bounds.centerX,
      bounds.centerY - 24,
      baseScale * 1.04,
      2,
      { alpha: 1 },
    );
  }

  renderSceneVariantFrame(config, bounds) {
    const baseScale = Math.max(WIDTH / 2048, HEIGHT / 1152);
    this.addSceneVariantImage(
      this.edgeLayer,
      config.exteriorFrameAssetKey,
      bounds.centerX,
      bounds.centerY - 20,
      baseScale * 1.04,
      70,
      { alpha: 1 },
    );
  }

  renderSceneVariantForeground(config, bounds) {
    if (!config.foregroundFogAssetKey) {
      return;
    }
    const baseScale = Math.max(WIDTH / 2048, HEIGHT / 1152);
    this.addSceneVariantImage(
      this.lightingLayer,
      config.foregroundFogAssetKey,
      bounds.centerX,
      bounds.centerY - 20,
      baseScale * 1.04,
      4705,
      { alpha: config.key === 'night_spring' ? 0.9 : 0.72 },
    );
  }

  renderSceneVariantOverlapDecor(config, bounds, tileW, tileH) {
    config.overlapDecorAnchors.forEach((anchor) => {
      const x = bounds.centerX + anchor.x * tileW;
      const y = bounds.centerY + anchor.y * tileH;
      this.addEnvironmentUniformSprite(
        this.edgeLayer,
        anchor.frame,
        x,
        y,
        anchor.scale,
        bounds.centerY + anchor.depthBias,
        { alpha: anchor.alpha, originY: 0.82 },
      );
    });
  }

  applySceneVariantAmbient(config) {
    if (config.ambientAlpha <= 0) {
      return;
    }
    const ambient = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, config.ambientTint, config.ambientAlpha)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(4701);
    this.lightingLayer.add(ambient);
  }

  createVillage() {
    this.prepareGeneratedLevel();
    this.generatedLevelActive = this.shouldRenderGeneratedLevel();
    this.tileGraphics = this.add.graphics();
    this.tileGraphics.setAlpha(this.generatedLevelActive ? 1 : 0.15);
    this.terrainBaseLayer.add(this.tileGraphics);
    if (this.generatedLevelActive) {
      this.createGeneratedTerrainMask();
      if (this.generatedTerrainMask) {
        this.tileGraphics.setMask(this.generatedTerrainMask);
      }
      this.renderGeneratedLevel();
    } else {
      this.drawMapTiles();
      this.createPathStones();
      this.createForestBorder();
      this.createBuildings();
      this.createProps();
    }
    this.levelDebugVisible = this.isLevelDebugRequested();
    if (this.levelDebugVisible) {
      this.drawGeneratedLevelDebug();
    }
  }

  prepareGeneratedLevel() {
    const params = new URLSearchParams(window.location.search);
    const selection = resolveLevelConfigFromParams(params);
    this.generatedLevelConfigId = selection.id;
    this.generatedLevelConfigLabel = selection.label;
    this.generatedLevelSelectionWarnings = selection.warnings;
    this.sceneVariant = this.sceneVariantOverrideKey && SCENE_VARIANTS[this.sceneVariantOverrideKey as SeasonPreset]
      ? SCENE_VARIANTS[this.sceneVariantOverrideKey as SeasonPreset]
      : resolveSceneVariantFromParams(params);
    selection.config.playableBounds = this.sceneVariant.playableBounds;
    this.generatedLevel = generateLevel(selection.config, ASSET_REGISTRY);
    this.generatedLevelValidation = validateGeneratedLevel(this.generatedLevel);
    if (!this.resumeRunState) {
      this.syncWorldStateWithSceneVariant();
    }
    if (!this.generatedLevelValidation.valid) {
      console.warn('[generated-level] validation failed', this.generatedLevelValidation);
    } else if (this.generatedLevelValidation.warnings.length > 0 || selection.warnings.length > 0) {
      console.info('[generated-level] validation warnings', {
        selectionWarnings: selection.warnings,
        validationWarnings: this.generatedLevelValidation.warnings,
      });
    }
  }

  shouldRenderGeneratedLevel() {
    return shouldRenderGeneratedLevelFromParams(new URLSearchParams(window.location.search));
  }

  isLevelDebugRequested() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('debugLevel') ?? params.get('debugGrid');
    return (params.has('debugLevel') || params.has('debugGrid'))
      && raw !== '0'
      && raw !== 'false'
      && raw !== 'off';
  }

  shouldAutoStartFromParams() {
    const raw = new URLSearchParams(window.location.search).get('autostart');
    return raw === '1' || raw === 'true' || raw === 'on';
  }

  shouldSkipCountdownFromParams() {
    const raw = new URLSearchParams(window.location.search).get('skipCountdown');
    return raw === '1' || raw === 'true' || raw === 'on';
  }

  renderGeneratedLevel() {
    if (!this.generatedLevel) {
      return;
    }
    const variant = this.getActiveSceneVariant();
    const { tileW, tileH } = this.getIsoMetrics();
    const bounds = this.getGeneratedWorldBounds(tileW, tileH);
    const usesStaticSceneFrame = this.hasStaticSceneVariantFrame(variant);
    if (bounds) {
      this.renderSceneVariantBackground(variant, bounds);
      if (!usesStaticSceneFrame) {
        this.renderGeneratedWorldEdges();
      }
      this.renderSceneVariantFrame(variant, bounds);
    }
    this.generatedLevel.terrain.forEach((placement) => {
      const center = this.isoToScreen(placement.iso.x, placement.iso.y);
      const render = placement.render ?? {};
      const terrainTexture = this.getSceneVariantTerrainTexture(placement.token);
      const textureKey = terrainTexture?.textureKey ?? render.textureKey;
      const frameKey = terrainTexture?.frameKey ?? render.frameKey;
      const texture = textureKey ? this.textures.get(textureKey) : null;
      if (textureKey && texture && (!frameKey || texture.has(frameKey))) {
        const size = this.scaleGeneratedSize(render.displaySize ?? [160, 160]);
        const sprite = this.add.image(center.x, center.y, textureKey, frameKey)
          .setOrigin(render.origin?.[0] ?? 0.5, render.origin?.[1] ?? 0.62)
          .setDisplaySize(size[0], size[1])
          .setDepth(center.y - tileH)
          .setAlpha(1);
        this.terrainBaseLayer.add(sprite);
        return;
      }
      const fill = render.terrainFill ?? COLORS.grassA;
      const stroke = render.terrainStroke ?? 0x5dbb65;
      this.drawDiamond(center.x, center.y, tileW, tileH, fill, stroke, 1, 0);
    });
    if (bounds) {
      this.renderSceneVariantOverlapDecor(variant, bounds, tileW, tileH);
    }
    this.createPathStones();
    this.generatedLevel.objects.forEach((placement) => {
      if (placement.type === 'building') {
        this.renderGeneratedBuilding(placement);
      } else if (placement.type === 'interactable') {
        this.spawnChest(placement.iso.x, placement.iso.y, 'gold');
      } else {
        this.renderGeneratedProp(placement);
      }
    });
    this.generatedLevel.decorations.forEach((placement) => this.renderGeneratedDecoration(placement));
    if (bounds) {
      this.renderSceneVariantForeground(variant, bounds);
      this.applySceneVariantAmbient(variant);
    }
  }

  renderGeneratedWorldEdges() {
    if (!this.generatedLevel || !this.textures.exists('worldEdgesAtlas')) {
      return;
    }
    const texture = this.textures.get('worldEdgesAtlas');
    const { tileW, tileH } = this.getIsoMetrics();
    const bounds = this.getGeneratedWorldBounds(tileW, tileH);
    if (!bounds) {
      return;
    }
    this.renderGeneratedWorldShadow(bounds, tileW, tileH, texture);
    this.generatedLevel.terrain.forEach((placement) => {
      if (!this.isGeneratedBoardEdgeCell(placement.grid)) {
        return;
      }
      if (!this.shouldRenderGeneratedCellCliff(placement.grid)) {
        return;
      }
      const frame = this.getGeneratedWorldCliffFrame(placement.grid);
      if (!frame || !texture.has(frame)) {
        return;
      }
      const center = this.isoToScreen(placement.iso.x, placement.iso.y);
      const offset = this.getGeneratedWorldCliffOffset(placement.grid, tileW, tileH);
      const isCorner = frame.includes('corner');
      const size = this.scaleGeneratedSize(isCorner ? [246, 238] : [320, 244]);
      const border = this.add.image(
        center.x + offset.x,
        center.y + offset.y,
        'worldEdgesAtlas',
        frame,
      )
        .setOrigin(0.5, 0.46)
        .setDisplaySize(size[0], size[1])
        .setDepth(center.y - tileH - 46)
        .setAlpha(1);
      this.edgeLayer.add(border);
    });
  }

  shouldRenderGeneratedCellCliff(grid) {
    if (!this.generatedLevel) {
      return false;
    }
    const { minX, minY, maxX, maxY } = this.generatedLevel.playableBounds;
    const isCorner = (
      (grid.x === minX && grid.y === minY)
      || (grid.x === maxX && grid.y === minY)
      || (grid.x === maxX && grid.y === maxY)
      || (grid.x === minX && grid.y === maxY)
    );
    if (isCorner) {
      return true;
    }
    if (grid.y === maxY) {
      return true;
    }
    if (grid.y === minY) {
      return false;
    }
    if (grid.x === minX || grid.x === maxX) {
      return grid.y >= Math.max(minY + 4, minY + Math.floor((maxY - minY) * 0.28));
    }
    return false;
  }

  addEnvironmentFrameSprite(
    layer,
    frame,
    x,
    y,
    width,
    height,
    depth,
    options: { originX?: number; originY?: number; alpha?: number } = {},
  ) {
    if (!this.textures.exists('environmentFrameAtlas')) {
      return null;
    }
    const texture = this.textures.get('environmentFrameAtlas');
    if (!texture.has(frame)) {
      return null;
    }
    const sprite = this.add.image(x, y, 'environmentFrameAtlas', frame)
      .setOrigin(options.originX ?? 0.5, options.originY ?? 0.82)
      .setDisplaySize(width, height)
      .setDepth(depth)
      .setAlpha(options.alpha ?? 1);
    layer.add(sprite);
    return sprite;
  }

  addEnvironmentUniformSprite(
    layer,
    frame,
    x,
    y,
    uniformScale,
    depth,
    options: { originX?: number; originY?: number; alpha?: number } = {},
  ) {
    if (!this.textures.exists('environmentFrameAtlas')) {
      return null;
    }
    const texture = this.textures.get('environmentFrameAtlas');
    if (!texture.has(frame)) {
      return null;
    }
    const atlasScale = this.generatedLevelActive && this.generatedLevel ? this.generatedLevel.config.tileSize / 64 : 1;
    const sprite = this.add.image(x, y, 'environmentFrameAtlas', frame)
      .setOrigin(options.originX ?? 0.5, options.originY ?? 0.78)
      .setScale(uniformScale * atlasScale)
      .setDepth(depth)
      .setAlpha(options.alpha ?? 1);
    layer.add(sprite);
    return sprite;
  }

  getGeneratedSurroundLayer(layer: GeneratedSurroundLayer) {
    switch (layer) {
      case 'shadow':
        return this.shadowLayer;
      case 'edge':
        return this.edgeLayer;
      case 'water':
        return this.waterLayer;
      case 'decor':
        return this.decorLayer;
      case 'background':
      default:
        return this.backgroundLayer;
    }
  }

  getGeneratedSurroundAnchorPoint(bounds, tileW, tileH, anchor: GeneratedSurroundAnchor) {
    switch (anchor) {
      case 'topLeft':
        return { x: bounds.centerX - bounds.boardWidth * 0.3, y: bounds.top.y - tileH * 2.46 };
      case 'topCenter':
        return { x: bounds.centerX, y: bounds.top.y - tileH * 2.62 };
      case 'topRight':
        return { x: bounds.centerX + bounds.boardWidth * 0.3, y: bounds.top.y - tileH * 2.46 };
      case 'leftUpper':
        return { x: bounds.left.x - tileW * 3.55, y: bounds.centerY - tileH * 1.78 };
      case 'leftLower':
        return { x: bounds.left.x - tileW * 3.9, y: bounds.bottom.y + tileH * 1.88 };
      case 'rightUpper':
        return { x: bounds.right.x + tileW * 3.55, y: bounds.centerY - tileH * 1.78 };
      case 'rightLower':
        return { x: bounds.right.x + tileW * 3.9, y: bounds.bottom.y + tileH * 1.88 };
      case 'bottomLeft':
        return { x: bounds.centerX - bounds.boardWidth * 0.28, y: bounds.bottom.y + tileH * 4.26 };
      case 'bottomCenter':
        return { x: bounds.centerX, y: bounds.bottom.y + tileH * 4.5 };
      case 'bottomRight':
      default:
        return { x: bounds.centerX + bounds.boardWidth * 0.28, y: bounds.bottom.y + tileH * 4.26 };
    }
  }

  renderGeneratedSceneSurround(bounds, tileW, tileH) {
    const pieces: GeneratedSurroundPiece[] = [
      { frame: 'large_shadow', anchor: 'bottomCenter', offsetX: 0, offsetY: tileH * 0.82, uniformScale: 2.72, layer: 'shadow', depth: 3, alpha: 0.32, originY: 0.5 },
      { frame: 'surround_water_fill_01', anchor: 'topLeft', offsetX: -tileW * 1.86, offsetY: tileH * 2.04, uniformScale: 2.04, layer: 'background', depth: 2, alpha: 1, originY: 0.58 },
      { frame: 'surround_water_fill_01', anchor: 'topLeft', offsetX: tileW * 1.36, offsetY: tileH * 1.42, uniformScale: 1.36, layer: 'background', depth: 2, alpha: 0.92, originY: 0.58 },
      { frame: 'surround_water_fill_01', anchor: 'topRight', offsetX: tileW * 1.86, offsetY: tileH * 1.98, uniformScale: 1.8, layer: 'background', depth: 2, alpha: 0.98, originY: 0.58 },
      { frame: 'surround_water_fill_01', anchor: 'topRight', offsetX: -tileW * 1.28, offsetY: tileH * 1.26, uniformScale: 1.28, layer: 'background', depth: 2, alpha: 0.88, originY: 0.58 },
      { frame: 'surround_forest_mass_01', anchor: 'topLeft', offsetX: -tileW * 3.3, offsetY: tileH * 0.96, uniformScale: 1.28, layer: 'background', depth: 4, alpha: 0.98, originY: 0.64 },
      { frame: 'surround_forest_mass_01', anchor: 'topRight', offsetX: tileW * 3.4, offsetY: tileH * 0.18, uniformScale: 1.08, layer: 'background', depth: 4, alpha: 0.96, originY: 0.64 },
      { frame: 'surround_forest_mass_01', anchor: 'topLeft', offsetX: tileW * 2.28, offsetY: tileH * 1.78, uniformScale: 0.9, layer: 'background', depth: 4, alpha: 0.94, originY: 0.64 },
      { frame: 'surround_cliff_filler_01', anchor: 'topLeft', offsetX: -tileW * 3.6, offsetY: tileH * 2.44, uniformScale: 0.92, layer: 'background', depth: 4, alpha: 0.98, originY: 0.66 },
      { frame: 'surround_forest_mass_01', anchor: 'topRight', offsetX: -tileW * 1.92, offsetY: tileH * 1.84, uniformScale: 0.84, layer: 'background', depth: 4, alpha: 0.92, originY: 0.64 },
      { frame: 'surround_cliff_filler_01', anchor: 'topRight', offsetX: tileW * 3.32, offsetY: tileH * 2.38, uniformScale: 0.9, layer: 'background', depth: 4, alpha: 0.98, originY: 0.66 },
      { frame: 'forest_cluster_back', anchor: 'topLeft', offsetX: -tileW * 0.38, offsetY: tileH * 2.76, uniformScale: 1.36, layer: 'background', depth: 4, alpha: 0.94, originY: 0.74 },
      { frame: 'forest_cluster_back', anchor: 'topLeft', offsetX: tileW * 1.54, offsetY: tileH * 3.08, uniformScale: 1.22, layer: 'background', depth: 4, alpha: 0.92, originY: 0.74 },
      { frame: 'forest_cluster_back', anchor: 'topLeft', offsetX: -tileW * 2.28, offsetY: tileH * 3.12, uniformScale: 1.46, layer: 'background', depth: 4, alpha: 0.9, originY: 0.74 },
      { frame: 'surround_cliff_filler_01', anchor: 'topLeft', offsetX: tileW * 2.84, offsetY: tileH * 2.84, uniformScale: 0.88, layer: 'background', depth: 4, alpha: 0.98, originY: 0.66 },
      { frame: 'surround_forest_mass_01', anchor: 'topLeft', offsetX: tileW * 3.24, offsetY: tileH * 2.46, uniformScale: 0.78, layer: 'background', depth: 4, alpha: 0.94, originY: 0.64 },
      { frame: 'surround_forest_mass_01', anchor: 'topLeft', offsetX: tileW * 0.82, offsetY: tileH * 3.22, uniformScale: 0.74, layer: 'background', depth: 4, alpha: 0.9, originY: 0.64 },
      { frame: 'surround_forest_mass_01', anchor: 'topLeft', offsetX: tileW * 1.9, offsetY: tileH * 3.56, uniformScale: 0.84, layer: 'background', depth: 4, alpha: 0.88, originY: 0.64 },
      { frame: 'forest_cluster_back', anchor: 'topRight', offsetX: tileW * 0.42, offsetY: tileH * 2.92, uniformScale: 1.3, layer: 'background', depth: 4, alpha: 0.94, originY: 0.74 },
      { frame: 'forest_cluster_back', anchor: 'topRight', offsetX: -tileW * 1.44, offsetY: tileH * 3.04, uniformScale: 1.18, layer: 'background', depth: 4, alpha: 0.92, originY: 0.74 },
      { frame: 'forest_cluster_back', anchor: 'topRight', offsetX: tileW * 2.22, offsetY: tileH * 3.14, uniformScale: 1.38, layer: 'background', depth: 4, alpha: 0.9, originY: 0.74 },
      { frame: 'surround_cliff_filler_01', anchor: 'topRight', offsetX: -tileW * 2.74, offsetY: tileH * 2.88, uniformScale: 0.86, layer: 'background', depth: 4, alpha: 0.98, originY: 0.66 },
      { frame: 'surround_forest_mass_01', anchor: 'topRight', offsetX: -tileW * 3.16, offsetY: tileH * 2.44, uniformScale: 0.76, layer: 'background', depth: 4, alpha: 0.94, originY: 0.64 },
      { frame: 'surround_forest_mass_01', anchor: 'topRight', offsetX: -tileW * 0.92, offsetY: tileH * 3.18, uniformScale: 0.74, layer: 'background', depth: 4, alpha: 0.9, originY: 0.64 },
      { frame: 'surround_forest_mass_01', anchor: 'topRight', offsetX: -tileW * 1.98, offsetY: tileH * 3.52, uniformScale: 0.82, layer: 'background', depth: 4, alpha: 0.88, originY: 0.64 },
      { frame: 'surround_top_left_01', anchor: 'topLeft', offsetX: -tileW * 0.82, offsetY: tileH * 1.12, uniformScale: 1.24, layer: 'background', depth: 5, alpha: 1, originY: 0.62 },
      { frame: 'surround_top_center_01', anchor: 'topCenter', offsetX: -tileW * 1.6, offsetY: tileH * 0.74, uniformScale: 1.2, layer: 'background', depth: 5, alpha: 0.98, originY: 0.62 },
      { frame: 'surround_top_center_01', anchor: 'topCenter', offsetX: tileW * 1.6, offsetY: tileH * 0.74, uniformScale: 1.2, layer: 'background', depth: 5, alpha: 0.98, originY: 0.62 },
      { frame: 'surround_top_center_01', anchor: 'topCenter', offsetX: 0, offsetY: tileH * 0.94, uniformScale: 1.3, layer: 'background', depth: 5, alpha: 1, originY: 0.62 },
      { frame: 'surround_top_right_01', anchor: 'topRight', offsetX: tileW * 0.92, offsetY: tileH * 1.06, uniformScale: 1.24, layer: 'background', depth: 5, alpha: 1, originY: 0.62 },
      { frame: 'surround_left_upper_01', anchor: 'leftUpper', offsetX: -tileW * 0.26, offsetY: tileH * 1.52, uniformScale: 1.26, layer: 'background', depth: 5, alpha: 1, originY: 0.62 },
      { frame: 'surround_right_upper_01', anchor: 'rightUpper', offsetX: tileW * 0.3, offsetY: tileH * 1.66, uniformScale: 1.28, layer: 'background', depth: 5, alpha: 1, originY: 0.62 },
      { frame: 'surround_cliff_filler_01', anchor: 'topLeft', offsetX: tileW * 4.6, offsetY: tileH * 0.38, uniformScale: 0.9, layer: 'edge', depth: bounds.top.y + tileH * 0.18, alpha: 1 },
      { frame: 'surround_cliff_filler_01', anchor: 'topRight', offsetX: -tileW * 4.6, offsetY: tileH * 0.52, uniformScale: 0.96, layer: 'edge', depth: bounds.top.y + tileH * 0.18, alpha: 1 },
      { frame: 'surround_mist_fill_01', anchor: 'topLeft', offsetX: tileW * 0.72, offsetY: tileH * 1.18, uniformScale: 1.02, layer: 'shadow', depth: 16, alpha: 0.62, originY: 0.6 },
      { frame: 'surround_mist_fill_01', anchor: 'topLeft', offsetX: -tileW * 1.42, offsetY: tileH * 2.72, uniformScale: 1.2, layer: 'shadow', depth: 17, alpha: 0.38, originY: 0.58 },
      { frame: 'fog_patch', anchor: 'topLeft', offsetX: tileW * 1.46, offsetY: tileH * 2.92, uniformScale: 1.54, layer: 'shadow', depth: 17, alpha: 0.44, originY: 0.56 },
      { frame: 'fog_patch', anchor: 'topLeft', offsetX: tileW * 3.16, offsetY: tileH * 2.66, uniformScale: 1.06, layer: 'shadow', depth: 17, alpha: 0.32, originY: 0.56 },
      { frame: 'purple_mist_patch', anchor: 'topLeft', offsetX: -tileW * 0.12, offsetY: tileH * 3.26, uniformScale: 1.18, layer: 'shadow', depth: 17, alpha: 0.18, originY: 0.56 },
      { frame: 'surround_mist_fill_01', anchor: 'topRight', offsetX: -tileW * 0.52, offsetY: tileH * 1.16, uniformScale: 1, layer: 'shadow', depth: 16, alpha: 0.58, originY: 0.6 },
      { frame: 'surround_mist_fill_01', anchor: 'topRight', offsetX: tileW * 1.38, offsetY: tileH * 2.78, uniformScale: 1.14, layer: 'shadow', depth: 17, alpha: 0.36, originY: 0.58 },
      { frame: 'fog_patch', anchor: 'topRight', offsetX: -tileW * 1.54, offsetY: tileH * 2.88, uniformScale: 1.42, layer: 'shadow', depth: 17, alpha: 0.42, originY: 0.56 },
      { frame: 'fog_patch', anchor: 'topRight', offsetX: -tileW * 3.06, offsetY: tileH * 2.6, uniformScale: 1.02, layer: 'shadow', depth: 17, alpha: 0.3, originY: 0.56 },
      { frame: 'purple_mist_patch', anchor: 'topRight', offsetX: tileW * 0.12, offsetY: tileH * 3.22, uniformScale: 1.14, layer: 'shadow', depth: 17, alpha: 0.18, originY: 0.56 },
      { frame: 'surround_left_lower_01', anchor: 'leftLower', offsetX: -tileW * 0.22, offsetY: tileH * 0.1, uniformScale: 1.1, layer: 'decor', depth: bounds.bottom.y + tileH * 0.62, alpha: 1 },
      { frame: 'surround_right_lower_01', anchor: 'rightLower', offsetX: tileW * 0.22, offsetY: tileH * 0.1, uniformScale: 1.1, layer: 'decor', depth: bounds.bottom.y + tileH * 0.62, alpha: 1 },
      { frame: 'surround_bottom_left_01', anchor: 'bottomLeft', offsetX: -tileW * 0.46, offsetY: tileH * 0.54, uniformScale: 0.84, layer: 'decor', depth: bounds.bottom.y + tileH * 0.98, alpha: 1 },
      { frame: 'surround_cliff_filler_01', anchor: 'bottomCenter', offsetX: -tileW * 2.18, offsetY: tileH * 0.76, uniformScale: 0.76, layer: 'decor', depth: bounds.bottom.y + tileH * 1.02, alpha: 1 },
      { frame: 'surround_forest_mass_01', anchor: 'bottomCenter', offsetX: 0, offsetY: tileH * 0.86, uniformScale: 0.9, layer: 'decor', depth: bounds.bottom.y + tileH * 1.02, alpha: 0.98, originY: 0.64 },
      { frame: 'forest_cluster_back', anchor: 'bottomCenter', offsetX: tileW * 2.08, offsetY: tileH * 0.78, uniformScale: 1.08, layer: 'decor', depth: bounds.bottom.y + tileH * 1.04, alpha: 0.96, originY: 0.72 },
      { frame: 'surround_bottom_right_01', anchor: 'bottomRight', offsetX: tileW * 0.46, offsetY: tileH * 0.54, uniformScale: 0.84, layer: 'decor', depth: bounds.bottom.y + tileH * 0.98, alpha: 1 },
      { frame: 'surround_mist_fill_01', anchor: 'bottomLeft', offsetX: tileW * 0.44, offsetY: tileH * 0.82, uniformScale: 1.02, layer: 'shadow', depth: 21, alpha: 0.32, originY: 0.56 },
      { frame: 'surround_mist_fill_01', anchor: 'bottomCenter', offsetX: 0, offsetY: tileH * 0.9, uniformScale: 1.16, layer: 'shadow', depth: 22, alpha: 0.36, originY: 0.56 },
      { frame: 'surround_mist_fill_01', anchor: 'bottomRight', offsetX: -tileW * 0.44, offsetY: tileH * 0.82, uniformScale: 1.02, layer: 'shadow', depth: 21, alpha: 0.32, originY: 0.56 },
      { frame: 'fog_patch', anchor: 'bottomLeft', offsetX: tileW * 1.72, offsetY: tileH * 1.02, uniformScale: 1.26, layer: 'shadow', depth: 22, alpha: 0.28, originY: 0.52 },
      { frame: 'fog_patch', anchor: 'bottomRight', offsetX: -tileW * 1.72, offsetY: tileH * 1.02, uniformScale: 1.26, layer: 'shadow', depth: 22, alpha: 0.28, originY: 0.52 },
      { frame: 'surround_forest_mass_01', anchor: 'rightUpper', offsetX: tileW * 1.66, offsetY: -tileH * 1.16, uniformScale: 0.92, layer: 'background', depth: 4, alpha: 0.94 },
      { frame: 'surround_forest_mass_01', anchor: 'leftLower', offsetX: -tileW * 1.28, offsetY: tileH * 1.46, uniformScale: 0.88, layer: 'background', depth: 4, alpha: 0.94 },
      { frame: 'forest_cluster_back', anchor: 'bottomLeft', offsetX: -tileW * 2.12, offsetY: tileH * 0.96, uniformScale: 1.02, layer: 'background', depth: 4, alpha: 0.92, originY: 0.72 },
      { frame: 'forest_cluster_back', anchor: 'bottomRight', offsetX: tileW * 2.12, offsetY: tileH * 0.96, uniformScale: 1.02, layer: 'background', depth: 4, alpha: 0.92, originY: 0.72 },
      { frame: 'pine_silhouette_tall', anchor: 'topLeft', offsetX: -tileW * 2.42, offsetY: tileH * 3.7, uniformScale: 1.24, layer: 'background', depth: 3, alpha: 0.22, originY: 0.84 },
      { frame: 'pine_silhouette_tall', anchor: 'topRight', offsetX: tileW * 2.46, offsetY: tileH * 3.62, uniformScale: 1.2, layer: 'background', depth: 3, alpha: 0.2, originY: 0.84 },
    ];

    pieces.forEach((piece) => {
      const anchor = this.getGeneratedSurroundAnchorPoint(bounds, tileW, tileH, piece.anchor);
      this.addEnvironmentUniformSprite(
        this.getGeneratedSurroundLayer(piece.layer),
        piece.frame,
        anchor.x + piece.offsetX,
        anchor.y + piece.offsetY,
        piece.uniformScale,
        piece.depth,
        { alpha: piece.alpha, originX: piece.originX, originY: piece.originY },
      );
    });
  }

  renderGeneratedEnvironmentFrame() {
    // Retained for compatibility while the hybrid scene variant frame owns the perimeter.
  }

  getGeneratedWorldBounds(tileW, tileH) {
    if (!this.generatedLevel) {
      return null;
    }
    const { minX, minY, maxX, maxY } = this.generatedLevel.playableBounds;
    const top = this.isoToScreen(minX, minY);
    const right = this.isoToScreen(maxX, minY);
    const bottom = this.isoToScreen(maxX, maxY);
    const left = this.isoToScreen(minX, maxY);
    return {
      top,
      right,
      bottom,
      left,
      centerX: (left.x + right.x) / 2,
      centerY: (top.y + bottom.y) / 2,
      boardWidth: Math.abs(right.x - left.x) + tileW * 2.55,
      boardHeight: Math.abs(bottom.y - top.y) + tileH * 2.55,
    };
  }

  renderGeneratedWorldFog(bounds, tileW, tileH, texture) {
    const fogDepth = 8;
    const fogPieces = [
      {
        frame: 'edge_fog_n_01',
        x: bounds.centerX,
        y: bounds.top.y - tileH * 3.3,
        width: bounds.boardWidth * 2.42,
        height: tileH * 22.4,
        alpha: 0.42,
      },
      {
        frame: 'edge_fog_n_01',
        x: bounds.centerX - bounds.boardWidth * 0.38,
        y: bounds.top.y - tileH * 1.3,
        width: bounds.boardWidth * 1.24,
        height: tileH * 16.6,
        alpha: 0.32,
      },
      {
        frame: 'edge_fog_n_01',
        x: bounds.centerX + bounds.boardWidth * 0.38,
        y: bounds.top.y - tileH * 1.3,
        width: bounds.boardWidth * 1.24,
        height: tileH * 16.6,
        alpha: 0.32,
      },
      {
        frame: 'edge_fog_e_01',
        x: bounds.right.x + tileW * 4.9,
        y: bounds.centerY + tileH * 0.12,
        width: tileW * 18.4,
        height: bounds.boardHeight * 1.62,
        alpha: 0.28,
      },
      {
        frame: 'edge_fog_s_01',
        x: bounds.centerX,
        y: bounds.bottom.y + tileH * 3.85,
        width: bounds.boardWidth * 1.88,
        height: tileH * 15.6,
        alpha: 0.3,
      },
      {
        frame: 'edge_fog_w_01',
        x: bounds.left.x - tileW * 4.9,
        y: bounds.centerY + tileH * 0.12,
        width: tileW * 18.4,
        height: bounds.boardHeight * 1.62,
        alpha: 0.28,
      },
    ];
    fogPieces.forEach((piece) => {
      if (!texture.has(piece.frame)) {
        return;
      }
      const fog = this.add.image(piece.x, piece.y, 'worldEdgesAtlas', piece.frame)
        .setOrigin(0.5)
        .setDisplaySize(piece.width, piece.height)
        .setDepth(fogDepth)
        .setAlpha(piece.alpha);
      this.backgroundLayer.add(fog);
    });
  }

  renderGeneratedWorldBackdrop(bounds, tileW, tileH, texture) {
    const backdropDepth = 6;
    const backdrops = [
      {
        frame: 'edge_backdrop_n_01',
        x: bounds.centerX,
        y: bounds.top.y - tileH * 1.62,
        width: bounds.boardWidth * 2.38,
        height: tileH * 29.4,
      },
      {
        frame: 'edge_backdrop_n_01',
        x: bounds.centerX - bounds.boardWidth * 0.44,
        y: bounds.top.y - tileH * 0.58,
        width: bounds.boardWidth * 1.28,
        height: tileH * 20.8,
      },
      {
        frame: 'edge_backdrop_n_01',
        x: bounds.centerX + bounds.boardWidth * 0.44,
        y: bounds.top.y - tileH * 0.58,
        width: bounds.boardWidth * 1.28,
        height: tileH * 20.8,
      },
      {
        frame: 'edge_backdrop_n_01',
        x: bounds.centerX - bounds.boardWidth * 0.16,
        y: bounds.top.y - tileH * 0.02,
        width: bounds.boardWidth * 0.96,
        height: tileH * 15.8,
      },
      {
        frame: 'edge_backdrop_n_01',
        x: bounds.centerX + bounds.boardWidth * 0.16,
        y: bounds.top.y - tileH * 0.02,
        width: bounds.boardWidth * 0.96,
        height: tileH * 15.8,
      },
      {
        frame: 'edge_backdrop_n_01',
        x: bounds.centerX,
        y: bounds.top.y + tileH * 0.58,
        width: bounds.boardWidth * 1.14,
        height: tileH * 13.2,
      },
      {
        frame: 'edge_backdrop_w_01',
        x: bounds.left.x - tileW * 6.4,
        y: bounds.centerY - tileH * 1.45,
        width: tileW * 17.2,
        height: bounds.boardHeight * 1.26,
      },
      {
        frame: 'edge_backdrop_w_01',
        x: bounds.left.x - tileW * 6.3,
        y: bounds.centerY + tileH * 2.35,
        width: tileW * 17.4,
        height: bounds.boardHeight * 1.18,
      },
      {
        frame: 'edge_backdrop_e_01',
        x: bounds.right.x + tileW * 6.4,
        y: bounds.centerY - tileH * 1.45,
        width: tileW * 17.2,
        height: bounds.boardHeight * 1.26,
      },
      {
        frame: 'edge_backdrop_e_01',
        x: bounds.right.x + tileW * 6.3,
        y: bounds.centerY + tileH * 2.35,
        width: tileW * 17.4,
        height: bounds.boardHeight * 1.18,
      },
      {
        frame: 'edge_backdrop_s_01',
        x: bounds.centerX,
        y: bounds.bottom.y + tileH * 5.1,
        width: bounds.boardWidth * 1.96,
        height: tileH * 18.4,
      },
      {
        frame: 'edge_backdrop_nw_01',
        x: bounds.left.x - tileW * 4.7,
        y: bounds.top.y - tileH * 0.66,
        width: tileW * 21.4,
        height: tileH * 25.2,
      },
      {
        frame: 'edge_backdrop_ne_01',
        x: bounds.right.x + tileW * 4.7,
        y: bounds.top.y - tileH * 0.66,
        width: tileW * 21.4,
        height: tileH * 25.2,
      },
      {
        frame: 'edge_backdrop_sw_01',
        x: bounds.left.x - tileW * 5.8,
        y: bounds.bottom.y + tileH * 4.35,
        width: tileW * 15.8,
        height: tileH * 18.4,
      },
      {
        frame: 'edge_backdrop_se_01',
        x: bounds.right.x + tileW * 5.8,
        y: bounds.bottom.y + tileH * 4.35,
        width: tileW * 15.8,
        height: tileH * 18.4,
      },
    ];
    backdrops.forEach((piece) => {
      if (!texture.has(piece.frame)) {
        return;
      }
      const backdrop = this.add.image(piece.x, piece.y, 'worldEdgesAtlas', piece.frame)
        .setOrigin(0.5, 0.72)
        .setDisplaySize(piece.width, piece.height)
        .setDepth(backdropDepth)
        .setAlpha(1);
      this.backgroundLayer.add(backdrop);
    });
  }

  renderGeneratedWorldShadow(bounds, tileW, tileH, texture) {
    if (!texture.has('edge_shadow_01')) {
      return;
    }
    const shadow = this.add.image(
      bounds.centerX,
      bounds.bottom.y + tileH * 1.58,
      'worldEdgesAtlas',
      'edge_shadow_01',
    )
      .setOrigin(0.5)
      .setDisplaySize(bounds.boardWidth * 1.18, Math.max(tileH * 9, bounds.boardHeight * 0.42))
      .setDepth(10)
      .setAlpha(0.44);
    this.shadowLayer.add(shadow);
  }

  renderGeneratedWorldEdgeClusters() {
    if (!this.generatedLevel || !this.textures.exists('worldEdgesAtlas')) {
      return;
    }
    const texture = this.textures.get('worldEdgesAtlas');
    const { tileW, tileH } = this.getIsoMetrics();
    const bounds = this.getGeneratedWorldBounds(tileW, tileH);
    if (!bounds) {
      return;
    }
    const size = this.scaleGeneratedSize([524, 454]);
    const clusters = [
      {
        frame: 'edge_cluster_nw_01',
        x: bounds.left.x - tileW * 2.9,
        y: bounds.top.y + tileH * 1.15,
        depth: bounds.top.y + tileH * 0.34,
      },
      {
        frame: 'edge_cluster_ne_01',
        x: bounds.right.x + tileW * 2.9,
        y: bounds.top.y + tileH * 1.15,
        depth: bounds.top.y + tileH * 0.34,
      },
      {
        frame: 'edge_cluster_nw_01',
        x: bounds.centerX - bounds.boardWidth * 0.3,
        y: bounds.top.y - tileH * 0.08,
        depth: bounds.top.y + tileH * 0.18,
      },
      {
        frame: 'edge_cluster_ne_01',
        x: bounds.centerX + bounds.boardWidth * 0.3,
        y: bounds.top.y - tileH * 0.08,
        depth: bounds.top.y + tileH * 0.18,
      },
      {
        frame: 'edge_cluster_nw_01',
        x: bounds.centerX - tileW * 1.9,
        y: bounds.top.y - tileH * 0.42,
        depth: bounds.top.y + tileH * 0.08,
      },
      {
        frame: 'edge_cluster_ne_01',
        x: bounds.centerX + tileW * 1.9,
        y: bounds.top.y - tileH * 0.42,
        depth: bounds.top.y + tileH * 0.08,
      },
      {
        frame: 'edge_cluster_nw_01',
        x: bounds.left.x - tileW * 4.25,
        y: bounds.centerY - tileH * 2.75,
        depth: bounds.centerY - tileH * 2.15,
      },
      {
        frame: 'edge_cluster_ne_01',
        x: bounds.right.x + tileW * 4.25,
        y: bounds.centerY - tileH * 2.75,
        depth: bounds.centerY - tileH * 2.15,
      },
      {
        frame: 'edge_cluster_sw_01',
        x: bounds.left.x - tileW * 4.25,
        y: bounds.centerY + tileH * 3.05,
        depth: bounds.centerY + tileH * 2.2,
      },
      {
        frame: 'edge_cluster_se_01',
        x: bounds.right.x + tileW * 4.25,
        y: bounds.centerY + tileH * 3.05,
        depth: bounds.centerY + tileH * 2.2,
      },
      {
        frame: 'edge_cluster_sw_01',
        x: bounds.left.x - tileW * 2.9,
        y: bounds.bottom.y + tileH * 3.15,
        depth: bounds.bottom.y + tileH * 1.72,
      },
      {
        frame: 'edge_cluster_se_01',
        x: bounds.right.x + tileW * 2.9,
        y: bounds.bottom.y + tileH * 3.15,
        depth: bounds.bottom.y + tileH * 1.72,
      },
      {
        frame: 'edge_cluster_sw_01',
        x: bounds.centerX - bounds.boardWidth * 0.2,
        y: bounds.bottom.y + tileH * 3.55,
        depth: bounds.bottom.y + tileH * 1.84,
      },
      {
        frame: 'edge_cluster_se_01',
        x: bounds.centerX + bounds.boardWidth * 0.2,
        y: bounds.bottom.y + tileH * 3.55,
        depth: bounds.bottom.y + tileH * 1.84,
      },
    ];
    clusters.forEach((cluster) => {
      if (!texture.has(cluster.frame)) {
        return;
      }
      const decoration = this.add.image(cluster.x, cluster.y, 'worldEdgesAtlas', cluster.frame)
        .setOrigin(0.5, 0.72)
        .setDisplaySize(size[0], size[1])
        .setDepth(cluster.depth)
        .setAlpha(0.98);
      this.decorLayer.add(decoration);
    });
  }

  getGeneratedWorldCliffFrame(grid) {
    if (!this.generatedLevel) {
      return null;
    }
    const { minX, minY, maxX, maxY } = this.generatedLevel.playableBounds;
    if (grid.x === minX && grid.y === minY) {return 'edge_corner_n_01';}
    if (grid.x === maxX && grid.y === minY) {return 'edge_corner_e_01';}
    if (grid.x === maxX && grid.y === maxY) {return 'edge_corner_s_01';}
    if (grid.x === minX && grid.y === maxY) {return 'edge_corner_w_01';}
    if (grid.y === minY) {return 'edge_cliff_nw_01';}
    if (grid.x === maxX) {return 'edge_cliff_ne_01';}
    if (grid.y === maxY) {return 'edge_cliff_se_01';}
    if (grid.x === minX) {return 'edge_cliff_sw_01';}
    return null;
  }

  getGeneratedWorldCliffOffset(grid, tileW, tileH) {
    if (!this.generatedLevel) {
      return { x: 0, y: 0 };
    }
    const { minX, minY, maxX, maxY } = this.generatedLevel.playableBounds;
    if (grid.x === minX && grid.y === minY) {return { x: 0, y: tileH * 0.72 };}
    if (grid.x === maxX && grid.y === minY) {return { x: tileW * 0.54, y: tileH * 0.92 };}
    if (grid.x === maxX && grid.y === maxY) {return { x: 0, y: tileH * 1.46 };}
    if (grid.x === minX && grid.y === maxY) {return { x: -tileW * 0.54, y: tileH * 0.92 };}
    if (grid.y === minY) {return { x: tileW * 0.16, y: tileH * 0.52 };}
    if (grid.x === maxX) {return { x: tileW * 0.48, y: tileH * 0.92 };}
    if (grid.y === maxY) {return { x: -tileW * 0.16, y: tileH * 1.3 };}
    if (grid.x === minX) {return { x: -tileW * 0.48, y: tileH * 0.92 };}
    return { x: 0, y: 0 };
  }

  isGeneratedBoardEdgeCell(grid) {
    if (!this.generatedLevel) {
      return false;
    }
    const { minX, minY, maxX, maxY } = this.generatedLevel.playableBounds;
    return grid.x === minX
      || grid.y === minY
      || grid.x === maxX
      || grid.y === maxY;
  }

  createGeneratedTerrainMask() {
    if (!this.generatedLevel) {
      return;
    }
    this.generatedTerrainMaskGraphics?.destroy();
    const { tileW, tileH } = this.getIsoMetrics();
    const { minX, minY, maxX, maxY } = this.generatedLevel.playableBounds;
    const topCenter = this.isoToScreen(minX, minY);
    const rightCenter = this.isoToScreen(maxX, minY);
    const bottomCenter = this.isoToScreen(maxX, maxY);
    const leftCenter = this.isoToScreen(minX, maxY);
    const top = new Phaser.Geom.Point(topCenter.x, topCenter.y - tileH / 2);
    const right = new Phaser.Geom.Point(rightCenter.x + tileW / 2, rightCenter.y);
    const bottom = new Phaser.Geom.Point(bottomCenter.x, bottomCenter.y + tileH / 2);
    const left = new Phaser.Geom.Point(leftCenter.x - tileW / 2, leftCenter.y);
    const maskGraphics = this.make.graphics({ x: 0, y: 0, add: false } as any);
    maskGraphics.fillStyle(0xffffff, 1);
    maskGraphics.beginPath();
    maskGraphics.moveTo(top.x, top.y);
    maskGraphics.lineTo(right.x, right.y);
    maskGraphics.lineTo(bottom.x, bottom.y);
    maskGraphics.lineTo(left.x, left.y);
    maskGraphics.closePath();
    maskGraphics.fillPath();
    this.generatedTerrainMaskGraphics = maskGraphics;
    this.generatedTerrainMask = maskGraphics.createGeometryMask();
  }

  renderGeneratedBuilding(placement) {
    const render = placement.render ?? {};
    const p = this.isoToScreen(placement.iso.x, placement.iso.y, render.z ?? 18);
    const size = this.scaleGeneratedSize(render.displaySize ?? [80, 70]);
    const base = this.add.graphics();
    base.fillStyle(0x8f7346, 0.14);
    base.fillEllipse(p.x, p.y + 22, size[0] * 0.62, 28);
    const sprite = this.add.image(p.x, p.y, render.textureKey ?? 'cottageTexture', render.frameKey)
      .setOrigin(render.origin?.[0] ?? 0.5, render.origin?.[1] ?? 0.84)
      .setDisplaySize(size[0], size[1])
      .setDepth(p.y)
      .setAlpha(1);
    const repairIcon = this.add.container(p.x + size[0] * 0.34, p.y - size[1] * 0.58)
      .setVisible(false)
      .setDepth(p.y + 140);
    const badge = this.add.circle(0, 0, 15, 0xfff0a3, 1).setStrokeStyle(3, 0xf3a44d, 1);
    const mark = this.add.text(0, -1, '!', {
      fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
      fontSize: '21px',
      color: '#7f521e',
    }).setOrigin(0.5);
    repairIcon.add([badge, mark]);
    this.entityLayer.add([base, sprite, repairIcon]);
    this.buildings.push({
      name: placement.label,
      x: placement.iso.x,
      y: placement.iso.y,
      hp: placement.maxHealth,
      max: placement.maxHealth,
      importance: placement.importance,
      levelPlacementId: placement.id,
      texture: render.textureKey,
      size,
      reward: Math.round(placement.importance / 4),
      iso: { x: placement.iso.x, y: placement.iso.y },
      sprite,
      base,
      repairIcon,
      underAttackUntil: 0,
    });
  }

  renderGeneratedProp(placement) {
    if (this.generatedLevelActive && this.generatedLevel && placement.token === 'tree' && this.isGeneratedBoardEdgeCell(placement.grid)) {
      return;
    }
    const render = placement.render;
    const override = this.getSceneVariantPropTexture(placement);
    const textureKey = override?.textureKey ?? render?.textureKey;
    const frameKey = override?.frameKey ?? render?.frameKey;
    if (!textureKey) {
      return;
    }
    const p = this.isoToScreen(placement.iso.x, placement.iso.y, render.z ?? 7);
    const size = this.scaleGeneratedSize(render.displaySize ?? [42, 42]);
    const sprite = this.add.image(p.x, p.y, textureKey, frameKey)
      .setOrigin(render.origin?.[0] ?? 0.5, render.origin?.[1] ?? 0.82)
      .setDisplaySize(size[0], size[1])
      .setDepth(p.y + 8)
      .setAlpha(render.alpha ?? 0.72);
    this.entityLayer.add(sprite);
  }

  renderGeneratedDecoration(placement) {
    const override = this.getSceneVariantDecorationTexture(placement);
    if (placement.render?.textureKey || override?.textureKey) {
      const render = placement.render;
      const p = this.isoToScreen(placement.iso.x, placement.iso.y, render.z ?? 8);
      const size = this.scaleGeneratedSize(render.displaySize ?? [36, 36]);
      const sprite = this.add.image(
        p.x,
        p.y,
        override?.textureKey ?? render.textureKey,
        override?.frameKey ?? render.frameKey,
      )
        .setOrigin(render.origin?.[0] ?? 0.5, render.origin?.[1] ?? 0.82)
        .setDisplaySize(size[0], size[1])
        .setDepth(p.y + 6)
        .setAlpha(render.alpha ?? 0.76);
      this.entityLayer.add(sprite);
      return;
    }
    const p = this.isoToScreen(placement.iso.x + 0.16, placement.iso.y - 0.12, 8);
    const flowers = this.add.graphics();
    if (placement.decorationKind === 'sparkles') {
      flowers.fillStyle(0xfff3a6, 0.72);
      flowers.fillCircle(p.x - 4, p.y, 2.2);
      flowers.fillStyle(0x91e8ff, 0.62);
      flowers.fillCircle(p.x + 5, p.y - 5, 2.4);
      flowers.lineStyle(1, 0xffffff, 0.45);
      flowers.lineBetween(p.x - 8, p.y - 2, p.x + 7, p.y + 3);
    } else {
      flowers.fillStyle(0xffa8d6, 0.72);
      flowers.fillCircle(p.x - 6, p.y, 3);
      flowers.fillStyle(0xfff49a, 0.75);
      flowers.fillCircle(p.x, p.y - 3, 3);
      flowers.fillStyle(0x8fe287, 0.68);
      flowers.fillCircle(p.x + 6, p.y + 2, 3);
    }
    flowers.setDepth(p.y + 5);
    this.entityLayer.add(flowers);
  }

  getActiveTimeOfDay() {
    if (this.timeOfDayOverride) {
      return this.timeOfDayOverride;
    }
    const paramValue = new URLSearchParams(window.location.search).get('timeOfDay');
    if (isTimeOfDay(paramValue)) {
      return paramValue;
    }
    return this.generatedLevel?.config.timeOfDay ?? 'morning';
  }

  cycleTimeOfDay() {
    const order = ['morning', 'noon', 'afternoon', 'night'];
    const current = this.getActiveTimeOfDay();
    const next = order[(order.indexOf(current) + 1) % order.length];
    this.timeOfDayOverride = next;
    this.createTimeOfDayLayer();
    this.addGuildNote(`Time preview: ${next}.`);
    this.updateDebugOverlay();
  }

  getLampGlowIsoPoints() {
    if (this.generatedLevelActive && this.generatedLevel) {
      return [
        ...this.generatedLevel.objects
          .filter((placement) => placement.token === 'lamp')
          .map((placement) => placement.iso),
        ...this.generatedLevel.decorations
          .filter((placement) => placement.decorationKind === 'magicPlant')
          .map((placement) => placement.iso),
      ];
    }
    return [
      { x: 8.8, y: 5.8 },
      { x: 10.8, y: 4.8 },
      { x: 3.7, y: 9.7 },
    ];
  }

  createTimeOfDayLayer() {
    this.timeOfDayOverlay?.destroy();
    this.timeOfDayMist?.destroy();
    this.lampGlowGraphics?.destroy();
    this.timeOfDayOverlay = null;
    this.timeOfDayMist = null;
    this.lampGlowGraphics = null;
    if (this.generatedLevelActive && this.sceneVariant) {
      return;
    }
    const profile = TIME_OF_DAY_PROFILES[this.getActiveTimeOfDay()];
    const layerItems = [];

    if (profile.overlayAlpha > 0) {
      this.timeOfDayOverlay = this.add.rectangle(
        WIDTH / 2,
        HEIGHT / 2,
        WIDTH,
        HEIGHT,
        profile.overlayColor,
        profile.overlayAlpha,
      ).setScrollFactor(0);
      layerItems.push(this.timeOfDayOverlay);
    }

    if (profile.mistAlpha > 0) {
      const mist = this.add.graphics();
      mist.fillStyle(0xffffff, profile.mistAlpha);
      [
        [190, 184, 210, 34],
        [612, 156, 260, 42],
        [1050, 196, 220, 36],
      ].forEach(([x, y, w, h]) => mist.fillEllipse(x, y, w, h));
      this.timeOfDayMist = mist;
      layerItems.push(mist);
    }

    if (profile.glowAlpha > 0) {
      const glow = this.add.graphics();
      glow.setBlendMode(Phaser.BlendModes.ADD);
      this.getLampGlowIsoPoints().forEach((iso) => {
        const p = this.isoToScreen(iso.x, iso.y, 20);
        glow.fillStyle(profile.glowColor, profile.glowAlpha);
        glow.fillCircle(p.x, p.y, 34);
        glow.fillStyle(profile.glowColor, profile.glowAlpha * 0.42);
        glow.fillCircle(p.x, p.y, 58);
      });
      this.lampGlowGraphics = glow;
      layerItems.push(glow);
    }

    if (layerItems.length > 0) {
      this.lightingLayer.add(layerItems);
    }
  }

  drawDebugDiamond(gfx, grid, color, alpha = 0.18) {
    const { tileW, tileH } = this.getIsoMetrics();
    const center = this.isoToScreen(grid.x, grid.y);
    gfx.fillStyle(color, alpha);
    gfx.lineStyle(1, color, Math.min(1, alpha + 0.22));
    gfx.beginPath();
    gfx.moveTo(center.x, center.y - tileH / 2);
    gfx.lineTo(center.x + tileW / 2, center.y);
    gfx.lineTo(center.x, center.y + tileH / 2);
    gfx.lineTo(center.x - tileW / 2, center.y);
    gfx.closePath();
    gfx.fillPath();
    gfx.strokePath();
  }

  getDecorationDebugColor(kind) {
    if (kind === 'fullTree' || kind === 'sapling') {
      return 0x2ed573;
    }
    if (kind === 'treeCluster') {
      return 0x1fa85f;
    }
    if (kind === 'bush') {
      return 0x78d66a;
    }
    if (kind === 'rocks') {
      return 0xd0d5dd;
    }
    if (kind === 'grassPatch') {
      return 0x9be86b;
    }
    if (kind === 'mushrooms') {
      return 0xffaa55;
    }
    if (kind === 'magicPlant') {
      return 0x6af7ff;
    }
    if (kind === 'sparkles') {
      return 0xffffff;
    }
    if (kind === 'lamp') {
      return 0xffe36a;
    }
    if (kind === 'fence' || kind === 'sign') {
      return 0xc7924e;
    }
    return 0xff93d8;
  }

  drawDebugPath(gfx, path, color, alpha = 0.56) {
    if (!path?.length) {
      return;
    }
    gfx.lineStyle(2, color, alpha);
    const first = this.isoToScreen(path[0].x, path[0].y, -5);
    gfx.beginPath();
    gfx.moveTo(first.x, first.y);
    path.slice(1).forEach((cell) => {
      const p = this.isoToScreen(cell.x, cell.y, -5);
      gfx.lineTo(p.x, p.y);
    });
    gfx.strokePath();
  }

  drawGeneratedLevelDebug() {
    if (!this.generatedLevel) {
      return;
    }
    this.levelDebugGraphics?.destroy();
    const gfx = this.add.graphics().setDepth(4600);
    this.levelDebugGraphics = gfx;
    for (let y = 0; y < this.generatedLevel.height; y += 1) {
      for (let x = 0; x < this.generatedLevel.width; x += 1) {
        this.drawDebugDiamond(gfx, { x, y }, 0xffffff, 0.035);
        if (this.generatedLevel.roadGrid[y]?.[x]) {
          this.drawDebugDiamond(gfx, { x, y }, 0xe8d39c, 0.18);
        }
        if (this.generatedLevel.blockedGrid[y][x]) {
          this.drawDebugDiamond(gfx, { x, y }, 0xff6b6b, 0.22);
        }
      }
    }
    const top = this.isoToScreen((this.generatedLevel.width - 1) / 2, 0, -8);
    const right = this.isoToScreen(this.generatedLevel.width - 1, (this.generatedLevel.height - 1) / 2, -8);
    const bottom = this.isoToScreen((this.generatedLevel.width - 1) / 2, this.generatedLevel.height - 1, -8);
    const left = this.isoToScreen(0, (this.generatedLevel.height - 1) / 2, -8);
    gfx.lineStyle(3, 0xffffff, 0.38);
    gfx.strokePoints([top, right, bottom, left, top], false, true);
    this.generatedLevel.spawnPoints.forEach((spawn) => this.drawDebugDiamond(gfx, spawn, 0xc678ff, 0.38));
    if (this.generatedLevel.playerSpawn) {
      this.drawDebugDiamond(gfx, this.generatedLevel.playerSpawn, 0x68d8ff, 0.42);
    }
    this.generatedLevel.protectedTargets.forEach((target) => {
      target.cells.forEach((cell) => this.drawDebugDiamond(gfx, cell, 0xffdf6a, 0.34));
      target.attackCells.forEach((cell) => this.drawDebugDiamond(gfx, cell, 0x7dff9a, 0.18));
    });
    this.generatedLevel.chests.forEach((chest) => this.drawDebugDiamond(gfx, chest.grid, 0xffb84f, 0.42));
    this.generatedLevel.decorations.forEach((decoration) => (
      this.drawDebugDiamond(gfx, decoration.grid, this.getDecorationDebugColor(decoration.decorationKind), 0.20)
    ));
    const goals = this.generatedLevel.protectedTargets.flatMap((target) => target.attackCells);
    this.generatedLevel.spawnPoints.forEach((spawn) => {
      const path = findGridPath(this.generatedLevel.walkableGrid, spawn, goals);
      path?.forEach((cell) => this.drawDebugDiamond(gfx, cell, 0x60ffb2, 0.16));
      this.drawDebugPath(gfx, path, 0x60ffb2, 0.35);
    });
    this.enemies
      .filter((enemy) => !enemy.defeated && !enemy.retreating)
      .forEach((enemy) => {
        this.drawDebugPath(gfx, enemy.path, 0xff5cc6, 0.82);
        this.drawDebugDiamond(gfx, this.isoToGridCell(enemy.iso), 0xff5cc6, 0.42);
        if (enemy.target?.iso) {
          this.drawDebugDiamond(gfx, this.isoToGridCell(enemy.target.iso), 0xfff15c, 0.42);
        }
      });
    this.worldLayer.add(gfx);
  }

  toggleGeneratedLevelDebug() {
    if (!this.generatedLevel) {
      return;
    }
    this.levelDebugVisible = !this.levelDebugVisible;
    try {
      localStorage.setItem('debugLevelOverlay', this.levelDebugVisible ? '1' : '0');
    } catch {
      // Debug persistence is optional.
    }
    if (this.levelDebugVisible) {
      this.drawGeneratedLevelDebug();
      this.addGuildNote('Level grid debug shown.');
    } else {
      this.levelDebugGraphics?.destroy();
      this.levelDebugGraphics = null;
      this.addGuildNote('Level grid debug hidden.');
    }
    this.updateDebugOverlay();
  }

  updateGeneratedLevelDebug(time) {
    if (!this.levelDebugVisible || !this.generatedLevel) {
      return;
    }
    if (time - this.levelDebugLastRenderAt < 260) {
      return;
    }
    this.levelDebugLastRenderAt = time;
    this.drawGeneratedLevelDebug();
  }

  drawMapTiles() {
    for (let y = 0; y < MAP_H; y += 1) {
      for (let x = 0; x < MAP_W; x += 1) {
        const center = this.isoToScreen(x, y);
        const isEdge = x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3;
        const isPath = Math.abs(x - 7) <= 1 || Math.abs(y - 7) <= 1 || (x > 4 && x < 11 && y > 4 && y < 11);
        const isGarden = (x === 4 && y === 10) || (x === 10 && y === 4) || (x === 3 && y === 6);
        let fill = (x + y) % 2 === 0 ? COLORS.grassA : COLORS.grassB;
        let stroke = 0x5dbb65;
        if (isEdge) {
          fill = COLORS.forest;
          stroke = 0x3e965e;
        } else if (isPath) {
          fill = COLORS.path;
          stroke = COLORS.pathEdge;
        } else if (isGarden) {
          fill = COLORS.garden;
          stroke = 0xdf729f;
        }
        this.drawDiamond(center.x, center.y, TILE_W, TILE_H, fill, stroke, 0.96);
      }
    }
  }

  drawDiamond(x, y, w, h, fill, stroke, alpha = 1, strokeAlpha = 0.45) {
    this.tileGraphics.fillStyle(fill, alpha);
    this.tileGraphics.lineStyle(1, stroke, strokeAlpha);
    this.tileGraphics.beginPath();
    this.tileGraphics.moveTo(x, y - h / 2);
    this.tileGraphics.lineTo(x + w / 2, y);
    this.tileGraphics.lineTo(x, y + h / 2);
    this.tileGraphics.lineTo(x - w / 2, y);
    this.tileGraphics.closePath();
    this.tileGraphics.fillPath();
    this.tileGraphics.strokePath();
  }

  createPathStones() {
    const stones = this.add.graphics();
    stones.fillStyle(0xe6d3a6, 0.55);
    if (this.generatedLevelActive && this.generatedLevel) {
      this.generatedLevel.roadGrid.forEach((row, y) => {
        row.forEach((isRoad, x) => {
          if (!isRoad || (x + y) % 2 !== 0) {
            return;
          }
          const p = this.isoToScreen(x + 0.12 * Math.sin(y * 1.7), y + 0.14 * Math.cos(x * 1.3));
          stones.fillEllipse(p.x, p.y, 8 + ((x + y) % 3) * 2, 4.5, 1);
        });
      });
      stones.setAlpha(0.38);
      if (this.generatedTerrainMask) {
        stones.setMask(this.generatedTerrainMask);
      }
      this.worldLayer.add(stones);
      return;
    }
    for (let y = 3; y < 12; y += 1) {
      for (let x = 6; x <= 8; x += 1) {
        const p = this.isoToScreen(x + 0.12 * Math.sin(y), y + 0.18 * Math.cos(x));
        stones.fillEllipse(p.x, p.y, 10 + ((x + y) % 3) * 3, 5, 1);
      }
    }
    for (let x = 3; x < 12; x += 1) {
      for (let y = 6; y <= 8; y += 1) {
        const p = this.isoToScreen(x + 0.15 * Math.cos(y), y + 0.1 * Math.sin(x));
        stones.fillEllipse(p.x, p.y, 9 + ((x * y) % 3) * 2, 5, 1);
      }
    }
    stones.setAlpha(0.42);
    this.worldLayer.add(stones);
  }

  createForestBorder() {
    const treeSpots = [
      [0.5, 1.2, 1.0], [2.2, 0.6, 0.8], [4.5, 0.7, 0.95], [7.3, 0.4, 1.1], [10.2, 0.7, 0.9], [13.4, 1.0, 1.0],
      [0.4, 4.4, 0.8], [0.8, 9.7, 0.95], [2.0, 13.4, 1.0], [5.4, 14.0, 0.85], [9.2, 13.5, 1.08], [13.0, 12.3, 0.9],
      [14.1, 4.0, 1.0], [13.7, 7.4, 0.85], [14.2, 10.5, 0.95],
    ];
    treeSpots.forEach(([x, y, scale], index) => {
      const p = this.isoToScreen(x, y, 16);
      this.addFireflyCluster(p.x, p.y - 34 * scale, index);
    });
  }

  createBuildings() {
    const buildingData = [
      { name: 'Castle', x: 7, y: 4, hp: 110, max: 110, importance: 100, texture: 'castleTexture', size: [112, 96], reward: 24 },
      { name: 'Bakery', x: 4, y: 7, hp: 76, max: 76, importance: 50, texture: 'bakeryTexture', size: [80, 70], reward: 16 },
      { name: 'Cottage', x: 10, y: 7, hp: 74, max: 74, importance: 50, texture: 'cottageTexture', size: [78, 68], reward: 15 },
      { name: 'Market', x: 7, y: 10, hp: 68, max: 68, importance: 70, texture: 'marketTexture', size: [90, 66], reward: 18 },
    ];
    this.buildings = buildingData.map((data) => {
      const p = this.isoToScreen(data.x, data.y, 18);
      const base = this.add.graphics();
      base.fillStyle(0x8f7346, 0.14);
      base.fillEllipse(p.x, p.y + 22, data.size[0] * 0.62, 28);
      const sprite = this.add.image(p.x, p.y, data.texture)
        .setOrigin(0.5, 0.84)
        .setDisplaySize(data.size[0], data.size[1])
        .setDepth(p.y)
        .setAlpha(0.74);
      const repairIcon = this.add.container(p.x + data.size[0] * 0.34, p.y - data.size[1] * 0.58).setVisible(false).setDepth(p.y + 140);
      const badge = this.add.circle(0, 0, 15, 0xfff0a3, 1).setStrokeStyle(3, 0xf3a44d, 1);
      const mark = this.add.text(0, -1, '!', {
        fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
        fontSize: '21px',
        color: '#7f521e',
      }).setOrigin(0.5);
      repairIcon.add([badge, mark]);
      this.entityLayer.add([base, sprite, repairIcon]);
      return { ...data, iso: { x: data.x, y: data.y }, sprite, base, repairIcon, underAttackUntil: 0 };
    });
  }

  createProps() {
    const props: Array<[string, number, number, number, number]> = [
      ['wellTexture', 6.1, 8.8, 44, 52], ['lampTexture', 8.8, 5.8, 26, 54], ['signTexture', 3.7, 9.7, 38, 46],
      ['lampTexture', 10.8, 4.8, 26, 54], ['wellTexture', 12.1, 9.3, 42, 46], ['signTexture', 2.9, 3.2, 38, 46],
    ];
    props.forEach(([texture, x, y, w, h]) => {
      const p = this.isoToScreen(x, y, 7);
      const sprite = this.add.image(p.x, p.y, texture)
        .setOrigin(0.5, 0.82)
        .setDisplaySize(w, h)
        .setDepth(p.y + 8)
        .setAlpha(0.7);
      this.entityLayer.add(sprite);
    });
  }

  addFireflyCluster(x, y, seed) {
    for (let i = 0; i < 3; i += 1) {
      const dot = this.add.circle(x + Math.cos(seed + i) * 18, y + Math.sin(seed * 2 + i) * 12, 2.8, 0xfff7a6, 0.85);
      dot.setDepth(y + 30 + i);
      this.tweens.add({
        targets: dot,
        x: dot.x + Math.sin(seed + i) * 12,
        y: dot.y - 8 - i * 3,
        alpha: 0.35,
        yoyo: true,
        repeat: -1,
        duration: 1500 + i * 230,
        ease: 'Sine.inOut',
      });
      this.entityLayer.add(dot);
    }
  }

  createPlayer() {
    const playerSpawn = this.generatedLevelActive && this.generatedLevel?.playerSpawn
      ? this.generatedLevel.playerSpawn
      : { x: 7, y: 7 };
    const start = this.isoToScreen(playerSpawn.x, playerSpawn.y, 18);
    this.player = {
      iso: { x: playerSpawn.x, y: playerSpawn.y },
      facing: { x: 0, y: 1 },
      lastAttack: 0,
      lastBow: 0,
      lastSpell: 0,
      invulnerableUntil: 0,
      actionLockUntil: 0,
      shadow: this.add.ellipse(start.x, start.y + 13, 44, 18, 0x325631, 0.24),
      sprite: this.add.sprite(start.x, start.y, 'heroSheet', 'hero-0-0')
        .setOrigin(0.5, 0.76)
        .setDisplaySize(76, 76)
        .setDepth(start.y + 40),
    };
    if (!this.anims.exists('hero-idle')) {
      this.anims.create({
        key: 'hero-idle',
        frames: [0, 1, 2, 3].map((col) => ({ key: 'heroSheet', frame: `hero-0-${col}` })),
        frameRate: 3,
        repeat: -1,
      });
    }
    if (!this.anims.exists('hero-walk')) {
      this.anims.create({
        key: 'hero-walk',
        frames: Array.from({ length: 8 }, (_, col) => ({ key: 'heroSheet', frame: `hero-1-${col}` })),
        frameRate: 9,
        repeat: -1,
      });
    }
    if (!this.anims.exists('hero-melee')) {
      this.anims.create({
        key: 'hero-melee',
        frames: Array.from({ length: 8 }, (_, col) => ({ key: 'heroSheet', frame: `hero-2-${col}` })),
        frameRate: 16,
        repeat: 0,
      });
    }
    if (!this.anims.exists('hero-special')) {
      this.anims.create({
        key: 'hero-special',
        frames: Array.from({ length: 8 }, (_, col) => ({ key: 'heroSheet', frame: `hero-3-${col}` })),
        frameRate: 12,
        repeat: 0,
      });
    }
    this.player.sprite.play('hero-idle');
    this.entityLayer.add([this.player.shadow, this.player.sprite]);
  }

  createControls() {
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      melee: Phaser.Input.Keyboard.KeyCodes.SPACE,
      bow: Phaser.Input.Keyboard.KeyCodes.F,
      spell: Phaser.Input.Keyboard.KeyCodes.Q,
      spellAlt: Phaser.Input.Keyboard.KeyCodes.R,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      repair: Phaser.Input.Keyboard.KeyCodes.T,
      inventory: Phaser.Input.Keyboard.KeyCodes.I,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      five: Phaser.Input.Keyboard.KeyCodes.FIVE,
      six: Phaser.Input.Keyboard.KeyCodes.SIX,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
      start: Phaser.Input.Keyboard.KeyCodes.ENTER,
      debug: Phaser.Input.Keyboard.KeyCodes.B,
      levelDebug: Phaser.Input.Keyboard.KeyCodes.G,
      timeOfDay: Phaser.Input.Keyboard.KeyCodes.N,
    });
    this.input.addPointer(5);
    this.input.on('pointerdown', (pointer) => {
      this.ensureAudio();
      if (this.touchControlsEnabled) {
        return;
      }
      if (this.state.phase === 'playing' && pointer.leftButtonDown()) {
        if (this.state.repairMode) {this.tryRepairBuilding();}
        else {this.fireBow(this.time.now);}
      }
    });
    this.input.keyboard.on('keydown', () => this.ensureAudio());
    this.keys.melee.on('down', () => {
      if (this.state.phase === 'splash') {this.startGameFromSplash();}
    });
    this.keys.start.on('down', () => {
      if (this.state.phase === 'splash') {this.startGameFromSplash();}
    });
    this.keys.inventory.on('down', () => this.toggleInventory());
    this.keys.repair.on('down', () => this.toggleRepairMode());
    this.keys.interact.on('down', () => {
      if (this.state.repairMode) {this.tryRepairBuilding();}
      else {this.tryOpenChest();}
    });
    [this.keys.one, this.keys.two, this.keys.three, this.keys.four, this.keys.five, this.keys.six].forEach((key, index) => {
      key.on('down', () => {
        if (this.state.phase === 'levelUp' && index < 3) {
          this.chooseLevelUpgrade(index);
        } else {
          this.buyUpgrade(index);
        }
      });
    });
    this.keys.restart.on('down', () => {
      if (this.state.phase === 'gameOver') {this.scene.restart();}
    });
    this.keys.debug.on('down', () => this.toggleDebugOverlay());
    this.keys.levelDebug.on('down', () => this.toggleGeneratedLevelDebug());
    this.keys.timeOfDay.on('down', () => this.cycleTimeOfDay());
  }

  getTouchCapabilityInfo() {
    const params = new URLSearchParams(window.location.search);
    const forceTouchControls = params.has('touchControls') || params.has('forceTouch');
    const maxTouchPoints = navigator.maxTouchPoints ?? 0;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const anyCoarsePointer = window.matchMedia?.('(any-pointer: coarse)').matches ?? false;
    const hoverNone = window.matchMedia?.('(hover: none)').matches ?? false;
    const hasTouchStart = 'ontouchstart' in window || 'TouchEvent' in window;
    const phaserTouch = Boolean(this.sys.game.device.input.touch);

    return {
      enabled: forceTouchControls || phaserTouch || maxTouchPoints > 0 || coarsePointer || anyCoarsePointer || hasTouchStart,
      forceTouchControls,
      phaserTouch,
      maxTouchPoints,
      coarsePointer,
      anyCoarsePointer,
      hoverNone,
      hasTouchStart,
      userAgent: navigator.userAgent,
    };
  }

  isTouchDevice() {
    this.touchDetection = this.getTouchCapabilityInfo();
    this.debugTouchControls('touch detection', this.touchDetection);
    const params = new URLSearchParams(window.location.search);
    if (params.has('forceDesktop')) {
      return false;
    }
    return this.touchDetection.enabled;
  }

  isDebugAutomationEnabled() {
    return new URLSearchParams(window.location.search).has('debugAutomation');
  }

  syncDevDiagnostics() {
    if (!(import.meta.env.DEV || this.isDebugAutomationEnabled())) {
      return;
    }
    const host = document.querySelector('#game');
    if (!host) {
      return;
    }
    host.setAttribute('data-phase', String(this.state.phase ?? ''));
    host.setAttribute('data-level', String(this.state.level ?? 0));
    host.setAttribute('data-world-key', String(this.state.worldKey ?? ''));
    host.setAttribute('data-world-round', String(this.state.worldRound ?? 0));
    host.setAttribute('data-boss-round', this.state.bossRound ? '1' : '0');
    host.setAttribute('data-enemies', String(this.enemies.length));
    host.setAttribute('data-level-spawns-pending', String(this.levelSpawnsPending));
    host.setAttribute('data-level-required-defeats', String(this.levelRequiredDefeats));
    host.setAttribute('data-level-defeats', String(this.levelDefeatsThisRound));
    host.setAttribute('data-level-spawned-count', String(this.levelSpawnedCount));
    host.setAttribute('data-valid-spawn-points', String(this.generatedValidSpawnPoints?.length ?? 0));
  }

  consumeDevCommand() {
    if (!(import.meta.env.DEV || this.isDebugAutomationEnabled())) {
      return;
    }
    const host = document.querySelector('#game');
    const command = host?.getAttribute('data-debug-command');
    if (!host || !command) {
      return;
    }
    host.removeAttribute('data-debug-command');
    if (command === 'clearRound') {
      this.enemies.slice().forEach((enemy) => this.damageEnemy(enemy, enemy.hp + 999, 'debug'));
      return;
    }
    if (command.startsWith('chooseUpgrade:')) {
      const index = Number(command.split(':')[1]);
      if (this.state.phase === 'levelUp' && Number.isInteger(index)) {
        this.chooseLevelUpgrade(Phaser.Math.Clamp(index, 0, 2));
      }
    }
  }

  createTouchControls() {
    this.touchControlsEnabled = this.isTouchDevice();
    if (!this.touchControlsEnabled) {
      this.debugTouchControls('touch controls skipped');
      return;
    }

    this.controlsHint?.setVisible(false);
    const container = this.add.container(0, 0).setDepth(7700).setScrollFactor(0);
    const joystickCenter = { x: 132, y: HEIGHT - 118 };
    const joystickZone = this.add.zone(joystickCenter.x, joystickCenter.y, 190, 190)
      .setOrigin(0.5)
      .setInteractive();
    const joystickBase = this.add.circle(joystickCenter.x, joystickCenter.y, 58, 0x132a3d, 0.34)
      .setStrokeStyle(4, 0xf8ffe3, 0.42);
    const joystickThumb = this.add.circle(joystickCenter.x, joystickCenter.y, 25, 0xfff4c8, 0.74)
      .setStrokeStyle(3, 0x6abbd7, 0.78);
    const buttons = {} as Record<TouchActionKey, Phaser.GameObjects.Container>;

    [
      ['melee', WIDTH - 230, HEIGHT - 124, 'Sword', { texture: 'touchControlsAtlas', frame: 'touch_sword_01' }, 0xf2bf52],
      ['bow', WIDTH - 150, HEIGHT - 170, 'Bow', { texture: 'touchControlsAtlas', frame: 'touch_bow_01' }, 0x8fd56c],
      ['spell', WIDTH - 70, HEIGHT - 124, 'Spell', { texture: 'touchControlsAtlas', frame: 'touch_spell_01' }, 0x75d8ff],
      ['use', WIDTH - 230, HEIGHT - 64, 'Use', { texture: 'touchControlsAtlas', frame: 'touch_use_01' }, 0xffcf75],
      ['repair', WIDTH - 150, HEIGHT - 64, 'Fix', { texture: 'touchControlsAtlas', frame: 'touch_repair_01' }, 0x9fe9bf],
      ['inventory', WIDTH - 70, HEIGHT - 64, 'Bag', { texture: 'touchControlsAtlas', frame: 'touch_inventory_01' }, 0xd7b9ff],
    ].forEach(([action, x, y, label, icon, color]) => {
      buttons[action as TouchActionKey] = this.createTouchActionButton(
        action as TouchActionKey,
        x as number,
        y as number,
        label as string,
        icon as TouchActionIcon,
        color as number,
      );
    });

    const portraitOverlay = this.createPortraitOverlay();
    container.add([joystickZone, joystickBase, joystickThumb, ...Object.values(buttons)]);
    this.touchLayer.add([container, portraitOverlay]);
    this.touchControls = {
      container,
      joystickBase,
      joystickThumb,
      joystickVector: { x: 0, y: 0 },
      joystickPointerId: null,
      joystickCenter,
      buttons,
      portraitOverlay,
    } as TouchControlsState;

    joystickZone.on('pointerdown', (pointer) => {
      if (this.state.phase !== 'playing') {
        return;
      }
      this.ensureAudio();
      this.touchControls.joystickPointerId = pointer.id;
      this.updateJoystickFromPointer(pointer);
    });
    this.input.on('pointermove', (pointer) => this.updateJoystickFromPointer(pointer));
    this.input.on('pointerup', (pointer) => this.releaseJoystick(pointer));
    this.input.on('pointerupoutside', (pointer) => this.releaseJoystick(pointer));
    this.updateTouchControls();
    this.debugTouchControls('touch controls created');
  }

  setupMobileViewportHandlers() {
    const refreshScale = () => {
      this.scale.refresh();
      this.updateTouchControls();
      this.debugTouchControls('viewport refreshed');
    };
    const delayedRefresh = () => {
      refreshScale();
      window.setTimeout(refreshScale, 180);
    };

    window.addEventListener('resize', delayedRefresh, { passive: true });
    window.addEventListener('orientationchange', delayedRefresh, { passive: true });
    window.visualViewport?.addEventListener('resize', delayedRefresh, { passive: true });
    window.visualViewport?.addEventListener('scroll', delayedRefresh, { passive: true });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('resize', delayedRefresh);
      window.removeEventListener('orientationchange', delayedRefresh);
      window.visualViewport?.removeEventListener('resize', delayedRefresh);
      window.visualViewport?.removeEventListener('scroll', delayedRefresh);
    });
  }

  createTouchActionButton(
    action: TouchActionKey,
    x: number,
    y: number,
    label: string,
    icon: TouchActionIcon,
    color: number,
  ) {
    const button = this.add.container(x, y).setScrollFactor(0);
    const hit = this.add.zone(0, 0, 78, 82)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const labelText = this.add.text(0, 34, label, {
      ...this.uiTextStyle(10, '#ffffff'),
      strokeThickness: 3,
    }).setOrigin(0.5);
    const glyph = icon
      ? this.add.image(0, -3, icon.texture, icon.frame).setDisplaySize(70, 70)
      : this.add.text(0, -5, 'I', {
        ...this.uiTextStyle(24, '#fff0b8'),
        strokeThickness: 4,
      }).setOrigin(0.5);
    const focusRing = this.add.circle(0, -3, 34, 0xffffff, 0)
      .setStrokeStyle(2, color, 0.28);
    hit.on('pointerdown', () => {
      this.ensureAudio();
      this.pulseTouchButton(button);
      this.handleTouchAction(action);
    });
    button.add([hit, focusRing, glyph, labelText]);
    return button;
  }

  createPortraitOverlay() {
    const overlay = this.add.container(0, 0).setDepth(7950).setVisible(false).setScrollFactor(0);
    const shade = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x17344f, 0.76);
    const panel = this.add.graphics();
    panel.fillStyle(0xfff7df, 0.96);
    panel.lineStyle(4, 0xffd36d, 0.86);
    panel.fillRoundedRect(WIDTH / 2 - 270, HEIGHT / 2 - 92, 540, 184, 10);
    panel.strokeRoundedRect(WIDTH / 2 - 270, HEIGHT / 2 - 92, 540, 184, 10);
    const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 28, 'Turn your device sideways', {
      ...this.uiTextStyle(30, '#714617'),
      strokeThickness: 4,
    }).setOrigin(0.5);
    const helper = this.add.text(WIDTH / 2, HEIGHT / 2 + 32, 'Fairy Guild Defense plays best in landscape.', this.uiTextStyle(17, '#31503b'))
      .setOrigin(0.5);
    overlay.add([shade, panel, title, helper]);
    return overlay;
  }

  updateJoystickFromPointer(pointer) {
    if (!this.touchControls || pointer.id !== this.touchControls.joystickPointerId) {
      return;
    }
    const radius = 58;
    const center = this.touchControls.joystickCenter;
    const dx = pointer.x - center.x;
    const dy = pointer.y - center.y;
    const distance = Math.min(radius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const thumbX = distance > 0 ? Math.cos(angle) * distance : 0;
    const thumbY = distance > 0 ? Math.sin(angle) * distance : 0;
    this.touchControls.joystickThumb.setPosition(center.x + thumbX, center.y + thumbY);
    this.touchControls.joystickVector = {
      x: thumbX / radius,
      y: thumbY / radius,
    };
  }

  releaseJoystick(pointer) {
    if (!this.touchControls || pointer.id !== this.touchControls.joystickPointerId) {
      return;
    }
    this.touchControls.joystickPointerId = null;
    this.touchControls.joystickVector = { x: 0, y: 0 };
    this.touchControls.joystickThumb.setPosition(
      this.touchControls.joystickCenter.x,
      this.touchControls.joystickCenter.y,
    );
  }

  updateTouchControls() {
    if (!this.touchControls) {
      return;
    }
    this.updatePortraitHint();
    this.touchControls.container.setAlpha(this.state.phase === 'countdown' ? 0.72 : 1);
    this.setTouchControlsVisible(
      (this.state.phase === 'countdown' || this.state.phase === 'playing') && !this.isPortraitLayout(),
    );
  }

  setTouchControlsVisible(visible: boolean) {
    if (!this.touchControls) {
      return;
    }
    const nextVisible = this.touchControlsEnabled && visible;
    this.touchControls.container.setVisible(nextVisible);
    if (!nextVisible) {
      this.touchControls.joystickPointerId = null;
      this.touchControls.joystickVector = { x: 0, y: 0 };
      this.touchControls.joystickThumb.setPosition(
        this.touchControls.joystickCenter.x,
        this.touchControls.joystickCenter.y,
      );
    }
    if (this.lastTouchControlsVisibility !== nextVisible) {
      this.lastTouchControlsVisibility = nextVisible;
      this.debugTouchControls('touch controls visibility changed', { visible: nextVisible });
    }
  }

  updatePortraitHint() {
    if (!this.touchControls) {
      return;
    }
    this.touchControls.portraitOverlay.setVisible(this.touchControlsEnabled && this.isPortraitLayout());
  }

  isPortraitLayout() {
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    return height > width;
  }

  debugTouchControls(message, extra = {}) {
    const params = new URLSearchParams(window.location.search);
    const storageEnabled = (() => {
      try {
        return localStorage.getItem('debugTouchControls') === '1';
      } catch {
        return false;
      }
    })();
    if (!params.has('debugTouch') && !storageEnabled) {
      return;
    }

    const gameEl = document.getElementById('game');
    const canvas = this.game.canvas;
    const gameStyle = gameEl ? getComputedStyle(gameEl) : null;
    const canvasStyle = canvas ? getComputedStyle(canvas) : null;
    console.info('[touch-controls]', message, {
      ...extra,
      detection: this.touchDetection,
      created: Boolean(this.touchControls),
      enabled: this.touchControlsEnabled,
      phase: this.state.phase,
      portrait: this.isPortraitLayout(),
      containerVisible: this.touchControls?.container.visible ?? null,
      containerAlpha: this.touchControls?.container.alpha ?? null,
      containerDepth: this.touchControls?.container.depth ?? null,
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        visualWidth: window.visualViewport?.width ?? null,
        visualHeight: window.visualViewport?.height ?? null,
      },
      gameDom: gameStyle ? {
        exists: true,
        display: gameStyle.display,
        visibility: gameStyle.visibility,
        position: gameStyle.position,
        zIndex: gameStyle.zIndex,
        pointerEvents: gameStyle.pointerEvents,
        width: gameStyle.width,
        height: gameStyle.height,
      } : { exists: false },
      canvasDom: canvasStyle ? {
        exists: true,
        display: canvasStyle.display,
        visibility: canvasStyle.visibility,
        position: canvasStyle.position,
        zIndex: canvasStyle.zIndex,
        pointerEvents: canvasStyle.pointerEvents,
        opacity: canvasStyle.opacity,
        width: canvasStyle.width,
        height: canvasStyle.height,
      } : { exists: false },
    });
  }

  getMovementVector() {
    let dx = 0;
    let dy = 0;
    if (this.keys.left.isDown || this.keys.a.isDown) {
      dx -= 1;
    }
    if (this.keys.right.isDown || this.keys.d.isDown) {
      dx += 1;
    }
    if (this.keys.up.isDown || this.keys.w.isDown) {
      dy -= 1;
    }
    if (this.keys.down.isDown || this.keys.s.isDown) {
      dy += 1;
    }
    if (this.touchControls?.container.visible) {
      dx += this.touchControls.joystickVector.x;
      dy += this.touchControls.joystickVector.y;
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { x: dx, y: dy };
  }

  getAutoTargetIso(maxRange: number) {
    let bestEnemy = null;
    let bestDistance = Infinity;
    this.enemies.forEach((enemy) => {
      if (enemy.retreating || enemy.defeated) {
        return;
      }
      const distance = Phaser.Math.Distance.Between(this.player.iso.x, this.player.iso.y, enemy.iso.x, enemy.iso.y);
      if (distance <= maxRange && distance < bestDistance) {
        bestEnemy = enemy;
        bestDistance = distance;
      }
    });
    if (bestEnemy) {
      return { x: bestEnemy.iso.x, y: bestEnemy.iso.y };
    }
    return this.clampIso({
      x: this.player.iso.x + this.player.facing.x * maxRange,
      y: this.player.iso.y + this.player.facing.y * maxRange,
    }, 0.8);
  }

  handleTouchAction(action: TouchActionKey) {
    if (this.state.phase !== 'playing') {
      return;
    }
    const now = this.time.now;
    if (action === 'melee') {
      if (this.state.repairMode) {
        this.tryRepairBuilding();
      } else {
        this.swingSword(now);
      }
    } else if (action === 'bow') {
      this.setRepairMode(false, false);
      this.fireBow(now, this.getAutoTargetIso(7.2));
    } else if (action === 'spell') {
      this.setRepairMode(false, false);
      this.castSpell(now, this.getAutoTargetIso(4.2));
    } else if (action === 'repair') {
      this.toggleRepairMode();
    } else if (action === 'use') {
      if (this.state.repairMode) {
        this.tryRepairBuilding();
      } else {
        this.tryOpenChest();
      }
    } else if (action === 'inventory') {
      this.toggleInventory();
    }
  }

  pulseTouchButton(button: Phaser.GameObjects.Container) {
    this.tweens.add({
      targets: button,
      scale: 0.9,
      yoyo: true,
      duration: 80,
      ease: 'Sine.easeOut',
      onComplete: () => button.setScale(1),
    });
  }

  createAudio() {
    this.audio = {
      context: null,
      ready: false,
      masterGain: null,
      sfxGain: null,
      musicGain: null,
      musicTimer: null,
      musicStep: 0,
      musicSoftened: false,
    };
  }

  ensureAudio() {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {return;}
    this.audio.context = this.audio.context || new AudioContext();
    const ctx = this.audio.context;
    if (!this.audio.masterGain) {
      this.audio.masterGain = ctx.createGain();
      this.audio.masterGain.gain.value = 0.82;
      this.audio.masterGain.connect(ctx.destination);

      this.audio.sfxGain = ctx.createGain();
      this.audio.sfxGain.gain.value = 0.8;
      this.audio.sfxGain.connect(this.audio.masterGain);

      this.audio.musicGain = ctx.createGain();
      this.audio.musicGain.gain.value = 0.028;
      this.audio.musicGain.connect(this.audio.masterGain);
    }
    if (this.audio.context.state === 'suspended') {
      this.audio.context.resume();
    }
    this.audio.ready = true;
    this.startVillageTheme();
  }

  playTone(type = 'sparkle') {
    if (!this.audio.ready || !this.audio.context) {return;}
    const ctx = this.audio.context;
    const now = ctx.currentTime;
    const motifs = {
      sparkle: [
        { freq: 740, endFreq: 1080, delay: 0, duration: 0.09, wave: 'triangle', gain: 0.038 },
        { freq: 980, endFreq: 1320, delay: 0.045, duration: 0.11, wave: 'sine', gain: 0.026 },
      ],
      chest: [
        { freq: 660, endFreq: 880, delay: 0, duration: 0.12, wave: 'triangle', gain: 0.045 },
        { freq: 880, endFreq: 1175, delay: 0.09, duration: 0.14, wave: 'triangle', gain: 0.052 },
        { freq: 1320, endFreq: 1760, delay: 0.2, duration: 0.18, wave: 'sine', gain: 0.035 },
      ],
      hit: [
        { freq: 330, endFreq: 220, delay: 0, duration: 0.08, wave: 'square', gain: 0.022 },
        { freq: 520, endFreq: 390, delay: 0.025, duration: 0.08, wave: 'triangle', gain: 0.018 },
      ],
      daze: [
        { freq: 520, endFreq: 610, delay: 0, duration: 0.1, wave: 'sine', gain: 0.026 },
        { freq: 430, endFreq: 510, delay: 0.1, duration: 0.12, wave: 'sine', gain: 0.023 },
      ],
      level: [
        { freq: 523, endFreq: 523, delay: 0, duration: 0.1, wave: 'triangle', gain: 0.045 },
        { freq: 659, endFreq: 659, delay: 0.1, duration: 0.12, wave: 'triangle', gain: 0.05 },
        { freq: 784, endFreq: 988, delay: 0.22, duration: 0.22, wave: 'sine', gain: 0.055 },
      ],
      bow: [
        { freq: 540, endFreq: 840, delay: 0, duration: 0.06, wave: 'triangle', gain: 0.03 },
        { freq: 260, endFreq: 180, delay: 0.015, duration: 0.1, wave: 'sine', gain: 0.017 },
      ],
      repair: [
        { freq: 440, endFreq: 587, delay: 0, duration: 0.1, wave: 'triangle', gain: 0.04 },
        { freq: 587, endFreq: 740, delay: 0.1, duration: 0.12, wave: 'triangle', gain: 0.038 },
        { freq: 880, endFreq: 1175, delay: 0.21, duration: 0.16, wave: 'sine', gain: 0.028 },
      ],
      gameOver: [
        { freq: 392, endFreq: 330, delay: 0, duration: 0.2, wave: 'triangle', gain: 0.038 },
        { freq: 330, endFreq: 262, delay: 0.18, duration: 0.28, wave: 'sine', gain: 0.034 },
        { freq: 262, endFreq: 220, delay: 0.43, duration: 0.36, wave: 'sine', gain: 0.026 },
      ],
    };
    (motifs[type] || motifs.sparkle).forEach((note) => this.playAudioNote(note, now, this.audio.sfxGain));
  }

  playAudioNote(note, baseTime, destination) {
    const ctx = this.audio.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = baseTime + (note.delay || 0);
    const duration = note.duration || 0.12;
    osc.type = note.wave || 'sine';
    osc.frequency.setValueAtTime(note.freq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, note.endFreq || note.freq), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.gain || 0.03, start + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.045);
    osc.connect(gain);
    gain.connect(destination || this.audio.sfxGain || ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.07);
  }

  startVillageTheme() {
    if (!this.audio.ready || this.audio.musicTimer) {return;}
    this.scheduleVillageTheme();
    this.audio.musicTimer = this.time.addEvent({
      delay: 3200,
      loop: true,
      callback: () => this.scheduleVillageTheme(),
    });
  }

  scheduleVillageTheme() {
    if (!this.audio.ready || !this.audio.context || !this.audio.musicGain) {return;}
    const ctx = this.audio.context;
    const now = ctx.currentTime;
    const chords = [
      [392, 523, 659],
      [440, 554, 659],
      [349, 523, 698],
      [392, 494, 659],
    ];
    const chord = chords[this.audio.musicStep % chords.length];
    const baseGain = this.audio.musicSoftened ? 0.008 : 0.018;
    chord.forEach((freq, index) => {
      this.playAudioNote({
        freq,
        endFreq: freq * 1.005,
        delay: index * 0.42,
        duration: 1.05,
        wave: index === 0 ? 'sine' : 'triangle',
        gain: baseGain * (index === 0 ? 0.78 : 1),
      }, now, this.audio.musicGain);
    });
    this.audio.musicStep += 1;
  }

  setMusicSoftened(softened) {
    this.audio.musicSoftened = softened;
    if (!this.audio.musicGain || !this.audio.context) {return;}
    const target = softened ? 0.012 : 0.028;
    this.audio.musicGain.gain.setTargetAtTime(target, this.audio.context.currentTime, 0.18);
  }

  updatePointerIso() {
    this.lastPointerIso = this.clampIso(this.screenToIso(this.input.activePointer.x, this.input.activePointer.y), 0.1);
  }

  updatePlayer(dt, time) {
    if (this.state.health <= 0) {return;}
    const movement = this.getMovementVector();
    const dx = movement.x;
    const dy = movement.y;

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      this.player.facing = { x: dx, y: dy };
      const nextX = {
        x: this.player.iso.x + dx * this.playerStats.speed * dt,
        y: this.player.iso.y,
      };
      const nextY = {
        x: this.player.iso.x,
        y: this.player.iso.y + dy * this.playerStats.speed * dt,
      };
      this.clampIso(nextX, 1.2);
      this.clampIso(nextY, 1.2);
      if (this.isGeneratedIsoWalkable(nextX)) {
        this.player.iso.x = nextX.x;
      }
      if (this.isGeneratedIsoWalkable(nextY)) {
        this.player.iso.y = nextY.y;
      }
      this.clampIso(this.player.iso, 1.2);
    }

    const meleePressed = Phaser.Input.Keyboard.JustDown(this.keys.melee);
    if (meleePressed) {
      if (this.state.repairMode) {this.tryRepairBuilding();}
      else {this.swingSword(time);}
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.bow)) {
      this.fireBow(time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.spell) || Phaser.Input.Keyboard.JustDown(this.keys.spellAlt)) {
      this.castSpell(time);
    }

    const p = this.isoToScreen(this.player.iso.x, this.player.iso.y, 18);
    this.player.sprite.setPosition(p.x, p.y);
    this.player.shadow.setPosition(p.x, p.y + 15);
    this.player.sprite.setFlipX(this.player.facing.x < -0.05);

    if (time > this.player.actionLockUntil) {
      const desiredAnim = moving ? 'hero-walk' : 'hero-idle';
      if (this.player.sprite.anims.currentAnim?.key !== desiredAnim) {
        this.player.sprite.play(desiredAnim);
      }
    }
    this.player.sprite.setAlpha(time < this.player.invulnerableUntil ? 0.62 + Math.sin(time / 50) * 0.18 : 1);
  }

  swingSword(time) {
    if (time - this.player.lastAttack < 430) {return;}
    this.ensureAudio();
    this.player.lastAttack = time;
    this.player.actionLockUntil = time + 300;
    this.setRepairMode(false, false);
    this.state.equipped = 'Wooden Sword';
    this.player.sprite.play('hero-melee', true);
    this.playTone('sparkle');
    const reach = 1.48;
    const center = {
      x: this.player.iso.x + this.player.facing.x * 0.85,
      y: this.player.iso.y + this.player.facing.y * 0.85,
    };
    const screen = this.isoToScreen(center.x, center.y, 20);
    this.spawnSparkleBurst(screen.x, screen.y, 0xfff0a2, 9, 0.75);
    this.enemies.forEach((enemy) => {
      const dist = Phaser.Math.Distance.Between(center.x, center.y, enemy.iso.x, enemy.iso.y);
      if (dist <= reach) {
        this.damageEnemy(enemy, this.playerStats.swordPower, 'bonk');
        enemy.iso.x += this.player.facing.x * 0.24;
        enemy.iso.y += this.player.facing.y * 0.24;
      }
    });
  }

  fireBow(time, targetIso = this.lastPointerIso) {
    if (time - this.player.lastBow < this.playerStats.bowCooldown) {return;}
    this.ensureAudio();
    this.player.lastBow = time;
    this.player.actionLockUntil = time + 260;
    this.setRepairMode(false, false);
    this.state.equipped = 'Guild Bow';
    this.player.sprite.play('hero-special', true);
    this.playTone('bow');
    const startIso = { x: this.player.iso.x, y: this.player.iso.y };
    const target = targetIso;
    let vx = target.x - startIso.x;
    let vy = target.y - startIso.y;
    const len = Math.max(0.01, Math.hypot(vx, vy));
    vx /= len;
    vy /= len;
    this.player.facing = { x: vx, y: vy };
    const p = this.isoToScreen(startIso.x, startIso.y, 18);
    const arrow = this.add.container(p.x, p.y - 24).setDepth(p.y + 120);
    const shaft = this.add.rectangle(0, 0, 32, 5, 0xffe6a3, 1).setStrokeStyle(1, 0x9d6d3f, 1);
    const tip = this.add.triangle(18, 0, 0, -6, 0, 6, 10, 0, 0x82d5ff, 1);
    arrow.add([shaft, tip]);
    const screenDir = this.isoToScreen(startIso.x + vx, startIso.y + vy, 18);
    arrow.rotation = Phaser.Math.Angle.Between(p.x, p.y, screenDir.x, screenDir.y);
    this.projectiles.push({
      type: 'arrow',
      iso: { x: startIso.x + vx * 0.45, y: startIso.y + vy * 0.45 },
      velocity: { x: vx * 8.2, y: vy * 8.2 },
      power: this.playerStats.bowPower,
      range: 6.8 + this.state.level * 0.35,
      distance: 0,
      sprite: arrow,
    });
    this.fxLayer.add(arrow);
  }

  castSpell(time, targetIso = this.lastPointerIso) {
    if (time - this.player.lastSpell < 780 || this.state.mana < this.playerStats.spellCost) {
      if (this.state.mana < this.playerStats.spellCost) {
        this.addGuildNote('Mana is refilling with sparkles.');
      }
      return;
    }
    this.ensureAudio();
    this.player.lastSpell = time;
    this.state.mana -= this.playerStats.spellCost;
    this.player.actionLockUntil = time + 430;
    this.setRepairMode(false, false);
    this.state.equipped = 'Sparkle Spell';
    this.player.sprite.play('hero-special', true);
    this.playTone('level');
    const center = {
      x: Phaser.Math.Clamp(targetIso.x, this.player.iso.x - 4.2, this.player.iso.x + 4.2),
      y: Phaser.Math.Clamp(targetIso.y, this.player.iso.y - 4.2, this.player.iso.y + 4.2),
    };
    const p = this.isoToScreen(center.x, center.y, 16);
    this.spawnSpellBloom(p.x, p.y - 8, 1 + this.playerStats.spellPower * 0.08);
    this.enemies.forEach((enemy) => {
      const dist = Phaser.Math.Distance.Between(center.x, center.y, enemy.iso.x, enemy.iso.y);
      if (dist < 2.05) {
        this.damageEnemy(enemy, this.playerStats.spellPower, 'sparkles');
        enemy.dazedUntil = time + 750;
      }
    });
  }

  createUpgrades() {
    this.upgrades = [
      {
        name: 'Sword',
        detail: '+1 soft bonk',
        cost: 55,
        level: 0,
        icon: 'swordIconTexture',
        apply: () => {
          this.playerStats.swordPower += 1;
          this.addGuildNote('Your wooden sword feels braver!');
        },
      },
      {
        name: 'Bow',
        detail: 'faster shots',
        cost: 50,
        level: 0,
        icon: 'bowIconTexture',
        apply: () => {
          this.playerStats.bowCooldown = Math.max(250, this.playerStats.bowCooldown - 80);
          this.playerStats.bowPower += this.upgrades[1].level % 2 === 0 ? 1 : 0;
          this.addGuildNote('Your bow twangs a little quicker.');
        },
      },
      {
        name: 'Mana',
        detail: '+25 pool',
        cost: 45,
        level: 0,
        icon: 'manaTexture',
        apply: () => {
          this.playerStats.maxMana += 25;
          this.state.mana = this.playerStats.maxMana;
          this.addGuildNote('Level up feeling: more mana bubbles!');
        },
      },
      {
        name: 'Spell',
        detail: '+spark area',
        cost: 65,
        level: 0,
        icon: 'spellIconTexture',
        apply: () => {
          this.playerStats.spellPower += 1;
          this.playerStats.spellCost = Math.max(16, this.playerStats.spellCost - 2);
          this.addGuildNote('Sparkle Burst learned a bigger twirl.');
        },
      },
      {
        name: 'Boots',
        detail: '+speed',
        cost: 60,
        level: 0,
        icon: 'bootIconTexture',
        apply: () => {
          this.playerStats.speed += 0.28;
          this.addGuildNote('Swift guild boots make patrols breezy.');
        },
      },
      {
        name: 'Shield',
        detail: '+heart',
        cost: 70,
        level: 0,
        icon: 'shieldIconTexture',
        apply: () => {
          this.playerStats.maxHealth += 1;
          this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + 2);
          this.addGuildNote('A sunny shield charm circles you.');
          this.spawnShieldGlow();
        },
      },
    ];
  }

  buyUpgrade(index) {
    if (this.state.phase !== 'playing') {return;}
    if (!this.state.inventoryOpen) {return;}
    const upgrade = this.upgrades[index];
    if (!upgrade) {return;}
    const price = upgrade.cost + upgrade.level * 25;
    if (this.state.gold < price) {
      this.addGuildNote(`${upgrade.name} needs ${price} gold.`);
      this.playTone('hit');
      return;
    }
    this.state.gold -= price;
    upgrade.level += 1;
    upgrade.apply();
    this.playTone('level');
    this.rebuildInventoryPanel();
  }

  spawnInitialChests() {
    if (this.generatedLevelActive && this.chests.length > 0) {
      return;
    }
    [
      { x: 3.5, y: 3.5, reward: 'gold' },
      { x: 11.4, y: 3.2, reward: 'mana' },
      { x: 3.1, y: 11.1, reward: 'xp' },
      { x: 11.6, y: 11.4, reward: 'heart' },
    ].forEach((data) => this.spawnChest(data.x, data.y, data.reward));
  }

  spawnChest(x, y, reward = 'gold') {
    const p = this.isoToScreen(x, y, 10);
    const chestTexture = this.generatedLevelActive ? 'worldTilesAtlas' : 'chestTexture';
    const chestFrame = this.generatedLevelActive ? 'chest_closed_01' : undefined;
    const chestSize = this.generatedLevelActive ? this.scaleGeneratedSize([101, 103]) : [58, 58];
    const sprite = this.add.image(p.x, p.y, chestTexture, chestFrame)
      .setOrigin(0.5, 0.78)
      .setDisplaySize(chestSize[0], chestSize[1])
      .setDepth(p.y + 60);
    const glow = this.add.circle(p.x, p.y - 22, 19 * (chestSize[0] / 58), 0xfff2a4, 0.14).setDepth(p.y + 50);
    this.tweens.add({
      targets: glow,
      scale: 1.35,
      alpha: 0.34,
      yoyo: true,
      repeat: -1,
      duration: 1050,
      ease: 'Sine.inOut',
    });
    this.entityLayer.add([glow, sprite]);
    this.chests.push({ iso: { x, y }, sprite, glow, reward, opened: false, bob: Math.random() * 1000 });
  }

  updateChests(time) {
    this.chests.forEach((chest) => {
      if (chest.opened) {return;}
      const p = this.isoToScreen(chest.iso.x, chest.iso.y, 10 + Math.sin(time / 450 + chest.bob) * 2.5);
      chest.sprite.setPosition(p.x, p.y);
      chest.glow.setPosition(p.x, p.y - 20);
    });
  }

  tryOpenChest() {
    if (this.state.phase !== 'playing') {return;}
    const chest = this.chests.find((candidate) => !candidate.opened && Phaser.Math.Distance.Between(
      candidate.iso.x,
      candidate.iso.y,
      this.player.iso.x,
      this.player.iso.y,
    ) < 1.35);
    if (!chest) {
      this.addGuildNote('No chest close enough yet.');
      return;
    }
    chest.opened = true;
    this.playTone('chest');
    chest.sprite.setTint(0xfff2a4);
    this.tweens.add({
      targets: [chest.sprite, chest.glow],
      y: '-=22',
      alpha: 0,
      scale: 1.22,
      duration: 760,
      ease: 'Back.easeOut',
      onComplete: () => {
        chest.sprite.destroy();
        chest.glow.destroy();
      },
    });
    const p = this.isoToScreen(chest.iso.x, chest.iso.y, 18);
    this.spawnSparkleBurst(p.x, p.y - 22, 0xfff0a4, 20, 1.1);
    this.grantChestReward(chest.reward);
    if (Phaser.Math.Between(0, 100) < 45) {
      const edge = Phaser.Math.RND.pick([
        { x: Phaser.Math.Between(2, 12), y: 1.8 },
        { x: 1.8, y: Phaser.Math.Between(2, 12) },
        { x: Phaser.Math.Between(2, 12), y: 13.2 },
        { x: 13.2, y: Phaser.Math.Between(2, 12) },
      ]);
      this.time.delayedCall(2200, () => {
        if (this.state.phase !== 'playing') {return;}
        this.spawnChest(edge.x, edge.y, Phaser.Math.RND.pick(['gold', 'gold', 'xp', 'mana', 'heart', 'buff']));
        this.addGuildNote('A chest appeared near the old oak!');
      });
    }
  }

  toggleRepairMode() {
    if (this.state.phase !== 'playing') {return;}
    this.ensureAudio();
    this.setRepairMode(!this.state.repairMode);
  }

  setRepairMode(enabled, announce = true) {
    if (enabled && this.state.phase !== 'playing') {return;}
    if (this.state.repairMode === enabled) {
      if (enabled) {this.state.equipped = 'Repair Kit';}
      if (enabled) {this.showRepairModeIndicator();}
      else {this.hideRepairModeIndicator();}
      return;
    }
    this.state.repairMode = enabled;
    if (enabled) {
      this.state.inventoryOpen = false;
      this.inventoryPanel?.setVisible(false);
      this.state.equipped = 'Repair Kit';
      this.showRepairModeIndicator();
      if (announce) {this.addGuildNote('Repair Kit ready. Space/click/E near a damaged building.');}
      this.playTone('sparkle');
    } else {
      this.hideRepairModeIndicator();
      if (this.state.equipped === 'Repair Kit') {
        this.state.equipped = 'Wooden Sword';
        if (announce) {this.addGuildNote('Repair Kit tucked away.');}
      }
    }
  }

  showRepairModeIndicator() {
    if (!this.player?.sprite) {return;}
    if (this.repairModeIndicator) {
      this.repairModeIndicator.setVisible(true);
      return;
    }
    const indicator = this.add.container(this.player.sprite.x + 34, this.player.sprite.y - 58);
    const glow = this.add.circle(0, 0, 22, 0xb8ffd5, 0.22)
      .setStrokeStyle(2, 0xf8ffd7, 0.6);
    const tool = this.add.image(0, 0, 'repairTool')
      .setOrigin(0.5)
      .setDisplaySize(50, 50)
      .setAngle(-10);
    indicator.add([glow, tool]);
    (indicator as any).glow = glow;
    (indicator as any).tool = tool;
    this.fxLayer.add(indicator);
    this.repairModeIndicator = indicator;
    this.tweens.add({
      targets: tool,
      y: -4,
      angle: 8,
      yoyo: true,
      repeat: -1,
      duration: 820,
      ease: 'Sine.inOut',
    });
    this.tweens.add({
      targets: glow,
      scale: 1.18,
      alpha: 0.34,
      yoyo: true,
      repeat: -1,
      duration: 940,
      ease: 'Sine.inOut',
    });
    this.updateRepairModeIndicator(this.time.now);
  }

  hideRepairModeIndicator() {
    if (!this.repairModeIndicator) {return;}
    this.tweens.killTweensOf([this.repairModeIndicator.tool, this.repairModeIndicator.glow]);
    this.repairModeIndicator.destroy();
    this.repairModeIndicator = null;
  }

  updateRepairModeIndicator(time) {
    if (!this.repairModeIndicator || !this.player?.sprite) {return;}
    if (!this.state.repairMode || this.state.phase !== 'playing') {
      this.hideRepairModeIndicator();
      return;
    }
    const bob = Math.sin(time / 180) * 3;
    this.repairModeIndicator
      .setPosition(this.player.sprite.x + 34, this.player.sprite.y - 58 + bob)
      .setDepth(this.player.sprite.depth + 150);
  }

  pulseRepairModeIndicator() {
    if (!this.repairModeIndicator?.tool) {return;}
    this.tweens.add({
      targets: this.repairModeIndicator.tool,
      displayWidth: 62,
      displayHeight: 62,
      x: 5,
      yoyo: true,
      repeat: 2,
      duration: 70,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.repairModeIndicator?.tool) {
          this.repairModeIndicator.tool.setDisplaySize(50, 50).setX(0);
        }
      },
    });
  }

  getNearestDamagedBuilding(range = REPAIR_RANGE) {
    let nearest = null;
    let nearestDistance = Infinity;
    this.buildings.forEach((building) => {
      if (building.hp >= building.max) {return;}
      if (building.name === 'Castle' && building.hp <= 0) {return;}
      const distance = Phaser.Math.Distance.Between(
        building.iso.x,
        building.iso.y,
        this.player.iso.x,
        this.player.iso.y,
      );
      if (distance <= range && distance < nearestDistance) {
        nearest = building;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  tryRepairBuilding() {
    if (this.state.phase !== 'playing') {return;}
    this.ensureAudio();
    if (this.time.now - this.lastRepairAt < REPAIR_COOLDOWN) {return;}
    const building = this.getNearestDamagedBuilding();
    if (!building) {
      this.addGuildNote('No damaged building close enough yet.');
      this.pulseRepairModeIndicator();
      this.playTone('hit');
      return;
    }
    if (this.state.gold < REPAIR_COST) {
      this.addGuildNote(`Repair supplies need ${REPAIR_COST} gold.`);
      this.pulseRepairModeIndicator();
      this.playTone('hit');
      return;
    }
    this.lastRepairAt = this.time.now;
    this.state.gold -= REPAIR_COST;
    const repaired = Math.min(REPAIR_AMOUNT, building.max - building.hp);
    building.hp = Math.min(building.max, building.hp + REPAIR_AMOUNT);
    this.updateBuildingRepairState(building);
    this.updateVillageSafety();
    this.spawnRepairToolEffect(building, repaired);
    this.spawnSparkleBurst(building.sprite.x, building.sprite.y - 22, 0xb8ffd5, 14, 0.82);
    this.playTone('repair');
    this.addGuildNote(`${building.name} repaired +${repaired} HP!`);
  }

  spawnRepairToolEffect(building, amount) {
    const toolX = (this.player.sprite.x + building.sprite.x) / 2;
    const toolY = (this.player.sprite.y + building.sprite.y) / 2 - 24;
    const tool = this.add.image(toolX, toolY, 'repairTool')
      .setOrigin(0.5)
      .setDisplaySize(56, 56)
      .setDepth(building.sprite.depth + 260)
      .setAngle(-12);
    const plus = this.add.text(toolX + 34, toolY - 26, `+${amount}`, {
      ...this.uiTextStyle(15, '#28784a'),
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.fxLayer.add([tool, plus]);
    this.tweens.add({
      targets: tool,
      y: toolY - 20,
      angle: 18,
      scale: 1.18,
      alpha: 0,
      duration: 620,
      ease: 'Back.easeOut',
      onComplete: () => tool.destroy(),
    });
    this.tweens.add({
      targets: plus,
      y: toolY - 52,
      alpha: 0,
      duration: 680,
      ease: 'Cubic.easeOut',
      onComplete: () => plus.destroy(),
    });
  }

  grantChestReward(reward) {
    if (reward === 'mana') {
      this.state.mana = this.playerStats.maxMana;
      this.addGuildNote('You found a blue mana orb!');
    } else if (reward === 'xp') {
      this.gainXp(38);
      this.addGuildNote('You found a swirl of XP stars!');
    } else if (reward === 'heart') {
      this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + 2);
      this.addGuildNote('A heart charm patched you up.');
    } else if (reward === 'buff') {
      this.playerStats.speed += 0.45;
      this.time.delayedCall(8500, () => {
        this.playerStats.speed -= 0.45;
        this.addGuildNote('The quick-step sparkle faded.');
      });
      this.addGuildNote('Temporary quick-step sparkle!');
    } else {
      const amount = Phaser.Math.Between(22, 42);
      this.state.gold += amount;
      this.addGuildNote(`You found ${amount} gold!`);
    }
  }

  clearLevelTimers() {
    this.levelTimers.forEach((timer) => timer.remove(false));
    this.levelTimers = [];
  }

  addLevelTimer(delay, callback) {
    const timer = this.time.delayedCall(delay, callback);
    this.levelTimers.push(timer);
    return timer;
  }

  startLevelCountdown() {
    this.clearLevelTimers();
    this.state.phase = 'countdown';
    this.state.inventoryOpen = false;
    this.setRepairMode(false, false);
    this.setMusicSoftened(false);
    this.inventoryPanel?.setVisible(false);
    this.levelSpawnsPending = 0;
    this.levelEnemiesRemaining = 0;
    this.levelRequiredDefeats = 0;
    this.levelDefeatsThisRound = 0;
    this.levelSpawnFailures = 0;
    this.levelClearQueued = false;
    this.levelSpawnedCount = 0;
    this.generatedValidSpawnPoints = [];
    this.splashOverlay?.setVisible(false);
    this.levelUpOverlay?.setVisible(false);
    this.gameOverOverlay?.setVisible(false);
    this.countdownOverlay?.setVisible(true);
    this.addGuildNote(`${this.getCurrentRoundTitle()} begins soon!`);

    if (this.shouldSkipCountdownFromParams()) {
      this.countdownOverlay?.setVisible(false);
      this.startLevelRound();
      return;
    }

    const sequence = [this.getCurrentRoundTitle(), '3', '2', '1', 'Go!'];
    sequence.forEach((label, index) => {
      this.addLevelTimer(index * 780, () => {
        this.showCountdownLabel(label);
        if (label === 'Go!') {this.playTone('level');}
      });
    });
    this.addLevelTimer(sequence.length * 780, () => this.startLevelRound());
  }

  showCountdownLabel(label) {
    if (!this.countdownOverlay) {return;}
    const roundTitle = this.getCurrentRoundTitle();
    this.countdownLevelText.setText(label === roundTitle ? roundTitle : roundTitle);
    this.countdownNumberText.setText(label === roundTitle ? '' : label);
    this.countdownNumberText.setScale(label === 'Go!' ? 0.82 : 1);
    this.countdownOverlay.setAlpha(0.98);
    this.tweens.add({
      targets: this.countdownNumberText,
      scale: label === 'Go!' ? 1.05 : 1.18,
      yoyo: true,
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }

  startLevelRound() {
    if (this.state.phase !== 'countdown') {return;}
    this.state.phase = 'playing';
    this.countdownOverlay?.setVisible(false);
    this.levelClearQueued = false;

    const level = this.state.level;
    const isBossRound = this.state.bossRound;
    const count = isBossRound
      ? 1
      : Math.min(LEVEL_SPAWN_BASE + level * LEVEL_SPAWN_PER_LEVEL, LEVEL_SPAWN_MAX);
    this.levelSpawnsPending = count;
    this.levelEnemiesRemaining = count;
    this.levelRequiredDefeats = count;
    this.levelDefeatsThisRound = 0;
    this.levelSpawnFailures = 0;
    this.levelSpawnedCount = 0;
    if (this.generatedLevelActive) {
      this.buildGeneratedSpawnCache();
      if (!this.generatedValidSpawnPoints.length) {
        this.addGuildNote('Scouts could not find a safe forest path yet. Retrying the perimeter...');
        this.buildGeneratedSpawnCache();
      }
    }
    if (isBossRound) {
      this.addGuildNote(this.getCurrentWorldTheme().bossIntro);
    } else {
      this.addGuildNote(`Level ${level}: forest friends are on the move!`);
    }
    if (level === 1 && !isBossRound) {
      this.addGuildNote('Tip: T readies repairs when buildings flash.');
    }

    for (let i = 0; i < count; i += 1) {
      const spawnInterval = Math.max(
        LEVEL_SPAWN_INTERVAL_MIN,
        LEVEL_SPAWN_INTERVAL_BASE - level * LEVEL_SPAWN_INTERVAL_STEP,
      );
      this.addLevelTimer(LEVEL_FIRST_SPAWN_DELAY + i * spawnInterval, () => {
        if (this.state.phase !== 'playing') {return;}
        this.levelSpawnsPending = Math.max(0, this.levelSpawnsPending - 1);
        const spawned = this.spawnRoundEnemy(level);
        if (!spawned) {
          this.levelSpawnFailures += 1;
          if (!isBossRound) {
            this.levelRequiredDefeats = Math.max(0, this.levelRequiredDefeats - 1);
            this.levelEnemiesRemaining = Math.max(0, this.levelRequiredDefeats - this.levelDefeatsThisRound);
          }
          if (this.generatedLevelActive) {
            console.warn('Generated spawn skipped because no protected target route was available.');
            if (this.levelSpawnedCount === 0 && this.levelSpawnsPending === 0) {
              this.addGuildNote('The scouts lost the route. The wave is waiting for a clear path.');
            }
          }
        }
        this.checkLevelClear();
      });
    }
  }

  checkLevelClear() {
    if (this.state.phase !== 'playing' || this.levelClearQueued) {return;}
    const requiredDefeatsMet = this.levelDefeatsThisRound >= this.levelRequiredDefeats;
    const hadRealSpawns = this.levelSpawnedCount > 0 || this.state.bossRound;
    if (this.levelSpawnsPending <= 0 && requiredDefeatsMet && hadRealSpawns) {
      this.levelClearQueued = true;
      this.addLevelTimer(720, () => this.completeLevel());
    }
  }

  completeLevel() {
    if (this.state.phase !== 'playing') {return;}
    this.state.phase = 'levelUp';
    this.state.inventoryOpen = false;
    this.setRepairMode(false, false);
    this.inventoryPanel?.setVisible(false);
    this.clearProjectiles();
    this.clearRetreatingEnemies();
    const bossConfig = BOSS_CONFIGS[this.state.worldKey as SeasonPreset];
    const reward = this.state.bossRound
      ? bossConfig.clearGold + this.state.worldCycle * 10 + this.state.level * 4
      : 20 + this.state.level * 8;
    this.state.gold += reward;
    this.gainXp(this.state.bossRound ? bossConfig.clearXp + this.state.worldCycle * 12 : 28 + this.state.level * 10);
    this.addGuildNote(
      this.state.bossRound
        ? `${bossConfig.name} defeated! +${reward} gold`
        : `Level ${this.state.level} clear! +${reward} gold`,
    );
    this.showLevelUpScreen();
  }

  getEnemyTarget(): any {
    const aliveBuildings = this.buildings.filter((building) => building.hp > 0);
    const castle = this.buildings.find((building) => building.name === 'Castle');
    if (!castle || castle.hp <= 0) {
      this.enterGameOver('The castle needs a rescue rest!');
      return null;
    }
    if (this.generatedLevelActive) {
      return aliveBuildings.reduce((best, building) => (
        (building.importance ?? 1) > (best.importance ?? 1) ? building : best
      ), aliveBuildings[0] ?? castle);
    }
    const villageTargets = aliveBuildings.filter((building) => building.name !== 'Castle');
    return Phaser.Math.RND.pick(villageTargets.length > 0 ? villageTargets : [castle]);
  }

  isoToGridCell(iso) {
    const x = Phaser.Math.Clamp(Math.round(iso.x), 0, (this.generatedLevel?.width ?? MAP_W) - 1);
    const y = Phaser.Math.Clamp(Math.round(iso.y), 0, (this.generatedLevel?.height ?? MAP_H) - 1);
    return { x, y };
  }

  getGeneratedEdgeSpawnPoints() {
    if (!this.generatedLevel?.spawnPoints.length) {
      return [];
    }
    const bounds = this.generatedLevel.playableBounds ?? DEFAULT_PLAYABLE_BOUNDS;
    return this.generatedLevel.spawnPoints.filter((spawn) => (
      spawn.x === bounds.minX
      || spawn.y === bounds.minY
      || spawn.x === bounds.maxX
      || spawn.y === bounds.maxY
    ));
  }

  getGeneratedFallbackSpawnAnchors() {
    if (!this.generatedLevel) {
      return [];
    }
    const { minX, minY, maxX, maxY } = this.generatedLevel.playableBounds;
    const midX = Math.floor((minX + maxX) / 2);
    const midY = Math.floor((minY + maxY) / 2);
    return [
      { x: minX, y: midY },
      { x: midX, y: minY },
      { x: maxX, y: midY },
      { x: midX, y: maxY },
    ];
  }

  getGeneratedPlayableEdgeCells() {
    if (!this.generatedLevel) {
      return [];
    }
    const cells = [];
    const { minX, minY, maxX, maxY } = this.generatedLevel.playableBounds;
    const seen = new Set();
    for (let x = minX; x <= maxX; x += 1) {
      cells.push({ x, y: minY });
      cells.push({ x, y: maxY });
    }
    for (let y = minY + 1; y < maxY; y += 1) {
      cells.push({ x: minX, y });
      cells.push({ x: maxX, y });
    }
    return cells.filter((cell) => {
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return this.generatedLevel?.walkableGrid[cell.y]?.[cell.x];
    });
  }

  buildGeneratedSpawnCache() {
    if (!this.generatedLevel) {
      this.generatedValidSpawnPoints = [];
      return [];
    }
    const candidateGroups = [
      this.getGeneratedEdgeSpawnPoints(),
      this.getGeneratedFallbackSpawnAnchors(),
      this.getGeneratedPlayableEdgeCells(),
    ];
    const valid = [];
    const seen = new Set();
    for (const group of candidateGroups) {
      for (const spawn of group) {
        const key = `${spawn.x},${spawn.y}`;
        if (seen.has(key) || !this.generatedLevel.walkableGrid[spawn.y]?.[spawn.x]) {
          continue;
        }
        seen.add(key);
        const route = this.selectGeneratedEnemyRoute(spawn);
        if (route) {
          valid.push(spawn);
        }
      }
      if (valid.length > 0) {
        break;
      }
    }
    this.generatedValidSpawnPoints = valid;
    return valid;
  }

  getGeneratedSpawnIso() {
    const edgeSpawns = this.generatedValidSpawnPoints?.length
      ? this.generatedValidSpawnPoints
      : this.buildGeneratedSpawnCache();
    if (!edgeSpawns.length) {
      console.warn('Generated level has no valid playable-edge spawn points.');
      return null;
    }
    const spawn = edgeSpawns[Phaser.Math.Between(0, edgeSpawns.length - 1)];
    return this.jitterGeneratedSpawnPoint(spawn);
  }

  jitterGeneratedSpawnPoint(spawn) {
    return {
      x: spawn.x + Phaser.Math.FloatBetween(-0.18, 0.18),
      y: spawn.y + Phaser.Math.FloatBetween(-0.18, 0.18),
    };
  }

  getGeneratedRouteScores(startIso) {
    if (!this.generatedLevel) {
      return [];
    }
    const start = this.isoToGridCell(startIso);
    const levelPressure = Math.max(0, this.state.level - 1);
    const distanceWeight = 2.2 + this.generatedLevel.config.difficulty * 0.16 + levelPressure * 0.04;
    return this.generatedLevel.protectedTargets
      .map((target) => {
        const building = this.buildings.find((candidate) => candidate.levelPlacementId === target.id && candidate.hp > 0);
        if (!building) {
          return null;
        }
        const path = findGridPath(this.generatedLevel.walkableGrid, start, target.attackCells);
        if (!path) {
          return null;
        }
        const healthFactor = Phaser.Math.Clamp(building.hp / building.max, 0.25, 1);
        const cost = pathCost(path);
        const score = (building.importance ?? target.importance) * healthFactor - cost * distanceWeight;
        return { building, path, score, cost, healthFactor, distanceWeight };
      })
      .filter(Boolean);
  }

  selectGeneratedEnemyRoute(startIso) {
    const choices = this.getGeneratedRouteScores(startIso);
    if (!choices.length) {
      return null;
    }
    const best = choices.reduce((winner, choice) => (choice.score > winner.score ? choice : winner), choices[0]);
    return {
      target: best.building,
      pathIso: best.path.map((cell) => ({ x: cell.x, y: cell.y })),
      score: best.score,
      cost: best.cost,
      healthFactor: best.healthFactor,
    };
  }

  pickWeighted(items) {
    if (!items.length) {return null;}
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Phaser.Math.FloatBetween(0, total);
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) {return item;}
    }
    return items[items.length - 1];
  }

  getEnemyArchetype(level) {
    const theme = this.getCurrentWorldTheme();
    const weighted = ENEMY_ARCHETYPES
      .filter((archetype) => archetype.unlockLevel <= level)
      .map((archetype) => ({
        ...archetype,
        weight: archetype.weight + (theme.preferredArchetypes.includes(archetype.key) ? 2.5 : 0),
      }));
    return this.pickWeighted(weighted) || ENEMY_ARCHETYPES[0];
  }

  getEnemyVariant(level) {
    return this.pickWeighted(ENEMY_VARIANTS.filter((variant) => variant.unlockLevel <= level))
      || ENEMY_VARIANTS[0];
  }

  getEnemyDisplayName(enemy) {
    return [enemy.variant.label, enemy.archetype.label].filter(Boolean).join(' ');
  }

  getEnemyFrameKey(enemy, column) {
    const prefix = enemy.framePrefix ?? 'monster';
    const row = enemy.frameRow ?? enemy.archetype?.row ?? 0;
    return `${prefix}-${row}-${column}`;
  }

  getWorldEliteVisual(level, variant) {
    const theme = this.getCurrentWorldTheme();
    const shouldUseElite = level >= 2 && (variant.key !== 'normal' || Phaser.Math.FloatBetween(0, 1) < theme.eliteSpawnChance);
    if (!shouldUseElite || !this.textures.exists(theme.eliteAssetKey)) {
      return { frameSheetKey: 'monsterSheet', framePrefix: 'monster', frameRow: null, tint: variant.tint };
    }
    return {
      frameSheetKey: theme.eliteAssetKey,
      framePrefix: theme.eliteFramePrefix,
      frameRow: 0,
      tint: theme.ambientTint ?? variant.tint,
    };
  }

  getBossVisual() {
    const theme = this.getCurrentWorldTheme();
    if (!this.textures.exists(theme.bossAssetKey)) {
      return { frameSheetKey: 'monsterSheet', framePrefix: 'monster', frameRow: 0, tint: BOSS_CONFIGS[this.state.worldKey as SeasonPreset].tint };
    }
    return {
      frameSheetKey: theme.bossAssetKey,
      framePrefix: theme.bossFramePrefix,
      frameRow: 0,
      tint: BOSS_CONFIGS[this.state.worldKey as SeasonPreset].tint,
    };
  }

  spawnRoundEnemy(level) {
    return this.state.bossRound ? this.spawnBossEnemy(level) : this.spawnEnemy(level);
  }

  spawnEnemy(level) {
    if (this.state.phase !== 'playing') {return false;}
    const theme = this.getCurrentWorldTheme();
    let route = null;
    let target = this.getEnemyTarget();
    if (!target) {return false;}
    let iso;
    if (this.generatedLevelActive) {
      const spawnCandidates = [...(this.generatedValidSpawnPoints?.length ? this.generatedValidSpawnPoints : this.buildGeneratedSpawnCache())];
      for (let i = spawnCandidates.length - 1; i > 0; i -= 1) {
        const j = Phaser.Math.Between(0, i);
        [spawnCandidates[i], spawnCandidates[j]] = [spawnCandidates[j], spawnCandidates[i]];
      }
      for (const spawn of spawnCandidates) {
        iso = this.jitterGeneratedSpawnPoint(spawn);
        route = this.selectGeneratedEnemyRoute(iso);
        if (route) {
          break;
        }
      }
      if (!route) {
        const refreshedCandidates = this.buildGeneratedSpawnCache();
        for (const spawn of refreshedCandidates) {
          iso = this.jitterGeneratedSpawnPoint(spawn);
          route = this.selectGeneratedEnemyRoute(iso);
          if (route) {
            break;
          }
        }
        if (!route) {
          console.warn('Generated enemy spawn skipped: no route to a protected target.', iso);
          return false;
        }
      }
      target = route.target;
    }
    if (!iso) {
      const side = Phaser.Math.Between(0, 3);
      if (side === 0) {iso = { x: Phaser.Math.FloatBetween(1.4, 13.3), y: 1.1 };}
      else if (side === 1) {iso = { x: 13.7, y: Phaser.Math.FloatBetween(1.4, 13.3) };}
      else if (side === 2) {iso = { x: Phaser.Math.FloatBetween(1.4, 13.3), y: 13.7 };}
      else {iso = { x: 1.1, y: Phaser.Math.FloatBetween(1.4, 13.3) };}
    }
    const archetype = this.getEnemyArchetype(level);
    const variant = this.getEnemyVariant(level);
    const visual = this.getWorldEliteVisual(level, variant);
    const p = this.isoToScreen(iso.x, iso.y, 16);
    const levelBonus = Math.max(0, level - 1);
    const size = (archetype.size + Math.min(levelBonus, 6) * 1.4) * variant.scale;
    const maxHp = Math.max(1, Math.round((archetype.hp + Math.floor(levelBonus / 2)) * variant.hp));
    const speed = Math.min(1.72, (archetype.speed + levelBonus * 0.035) * variant.speed);
    const buildingDamage = Math.max(1, Math.round((archetype.buildingDamage + Math.floor(levelBonus / 3)) * variant.buildingDamage));
    const contactDamage = Math.max(1, Math.round(archetype.contactDamage * variant.contactDamage));
    const shadow = this.add.ellipse(p.x, p.y + 13, size * 0.58, size * 0.22, 0x315133, 0.2);
    const frameRow = visual.frameRow ?? archetype.row;
    const framePrefix = visual.framePrefix ?? 'monster';
    const idleFrames = visual.frameSheetKey === theme.eliteAssetKey ? theme.eliteIdleFrames : [0, 1, 2, 3];
    const initialFrame = Phaser.Utils.Array.GetRandom(idleFrames);
    const defeatFrame = visual.frameSheetKey === theme.eliteAssetKey ? theme.eliteDefeatFrame : 7;
    const sprite = this.add.sprite(p.x, p.y, visual.frameSheetKey, `${framePrefix}-${frameRow}-${initialFrame}`)
      .setOrigin(0.5, 0.76)
      .setDisplaySize(size, size)
      .setDepth(p.y + 50);
    if (visual.tint) {sprite.setTint(visual.tint);}
    const enemy = {
      type: archetype.row,
      archetype,
      variant,
      variantTint: visual.tint,
      frameSheetKey: visual.frameSheetKey,
      framePrefix,
      frameRow,
      iso,
      sprite,
      shadow,
      target,
      hp: maxHp,
      maxHp,
      speed,
      buildingDamage,
      contactDamage,
      rewardGold: archetype.rewardGold.map((value) => Math.round((value + levelBonus) * variant.reward)),
      rewardXp: Math.round((archetype.rewardXp + levelBonus * 2) * variant.reward),
      touchCooldown: 0,
      heroTouchCooldown: 0,
      defeatFrame,
      dazedUntil: 0,
      wobble: Math.random() * Math.PI * 2,
      path: route?.pathIso ?? null,
      pathIndex: route?.pathIso?.length > 1 ? 1 : 0,
      routeScore: route?.score ?? null,
      routeCost: route?.cost ?? null,
      routeHealthFactor: route?.healthFactor ?? null,
      retreating: false,
      defeated: false,
      countedDefeat: false,
    };
    this.enemies.push(enemy);
    this.levelSpawnedCount += 1;
    this.entityLayer.add([shadow, sprite]);
    if (target.name === 'Bakery' && archetype.key === 'mushroom' && Phaser.Math.Between(0, 2) === 0) {
      this.addGuildNote('Mushroom sprites are heading toward the bakery!');
    } else if (variant.key !== 'normal' && Phaser.Math.Between(0, 5) === 0) {
      this.addGuildNote(`A ${this.getEnemyDisplayName(enemy)} joins Level ${level}!`);
    }
    return true;
  }

  spawnBossEnemy(level) {
    if (this.state.phase !== 'playing') {return false;}
    let target = this.getEnemyTarget();
    if (!target) {return false;}
    let route = null;
    let iso = null;
    if (this.generatedLevelActive) {
      const spawnCandidates = [...(this.generatedValidSpawnPoints?.length ? this.generatedValidSpawnPoints : this.buildGeneratedSpawnCache())];
      for (let i = spawnCandidates.length - 1; i > 0; i -= 1) {
        const j = Phaser.Math.Between(0, i);
        [spawnCandidates[i], spawnCandidates[j]] = [spawnCandidates[j], spawnCandidates[i]];
      }
      for (const spawn of spawnCandidates) {
        iso = this.jitterGeneratedSpawnPoint(spawn);
        route = this.selectGeneratedEnemyRoute(iso);
        if (route) {
          break;
        }
      }
      if (!route || !iso) {
        const refreshedCandidates = this.buildGeneratedSpawnCache();
        for (const spawn of refreshedCandidates) {
          iso = this.jitterGeneratedSpawnPoint(spawn);
          route = this.selectGeneratedEnemyRoute(iso);
          if (route) {
            break;
          }
        }
        if (!route || !iso) {
          console.warn('Boss spawn skipped: no route to a protected target.');
          return false;
        }
      }
      target = route.target;
    } else {
      iso = { x: Phaser.Math.FloatBetween(1.4, 13.3), y: 1.1 };
    }

    const theme = this.getCurrentWorldTheme();
    const bossConfig = BOSS_CONFIGS[this.state.worldKey as SeasonPreset];
    const visual = this.getBossVisual();
    const p = this.isoToScreen(iso.x, iso.y, 18);
    const levelBonus = Math.max(0, level - 1);
    const cycleBonus = this.state.worldCycle * 0.18;
    const maxHp = Math.round(bossConfig.hp + levelBonus * 3 + this.state.worldIndex * 3 + this.state.worldCycle * 8);
    const size = bossConfig.size + this.state.worldIndex * 3 + this.state.worldCycle * 4;
    const shadow = this.add.ellipse(p.x, p.y + 14, size * 0.62, size * 0.24, 0x243829, 0.24);
    const initialFrame = Phaser.Utils.Array.GetRandom(theme.bossIdleFrames);
    const sprite = this.add.sprite(p.x, p.y, visual.frameSheetKey, `${visual.framePrefix}-${visual.frameRow}-${initialFrame}`)
      .setOrigin(0.5, 0.76)
      .setDisplaySize(size, size)
      .setDepth(p.y + 54);
    if (visual.tint) {
      sprite.setTint(visual.tint);
    }
    const enemy = {
      type: 0,
      isBoss: true,
      archetype: { key: 'boss', label: bossConfig.name, row: 0 },
      variant: { key: 'boss', label: theme.label, tint: visual.tint },
      variantTint: visual.tint,
      frameSheetKey: visual.frameSheetKey,
      framePrefix: visual.framePrefix,
      frameRow: visual.frameRow,
      iso,
      sprite,
      shadow,
      target,
      hp: maxHp,
      maxHp,
      speed: bossConfig.speed + levelBonus * 0.018 + cycleBonus,
      buildingDamage: bossConfig.buildingDamage + Math.floor(levelBonus / 2) + this.state.worldCycle,
      contactDamage: bossConfig.contactDamage,
      rewardGold: [
        bossConfig.rewardGold[0] + this.state.worldCycle * 4 + this.state.worldIndex * 2,
        bossConfig.rewardGold[1] + this.state.worldCycle * 6 + this.state.worldIndex * 3,
      ],
      rewardXp: bossConfig.rewardXp + this.state.worldCycle * 12 + this.state.worldIndex * 6,
      touchCooldown: 0,
      heroTouchCooldown: 0,
      defeatFrame: theme.bossDefeatFrame,
      dazedUntil: 0,
      wobble: Math.random() * Math.PI * 2,
      path: route?.pathIso ?? null,
      pathIndex: route?.pathIso?.length > 1 ? 1 : 0,
      routeScore: route?.score ?? null,
      routeCost: route?.cost ?? null,
      routeHealthFactor: route?.healthFactor ?? null,
      retreating: false,
      defeated: false,
      countedDefeat: false,
    };
    this.enemies.push(enemy);
    this.levelSpawnedCount += 1;
    this.entityLayer.add([shadow, sprite]);
    this.addGuildNote(theme.bossIntro);
    return true;
  }

  updateEnemies(dt, time) {
    this.enemies.slice().forEach((enemy) => {
      if (!enemy.retreating && enemy.target.hp <= 0) {
        if (this.generatedLevelActive) {
          const route = this.selectGeneratedEnemyRoute(enemy.iso);
          if (!route) {
            enemy.retreating = true;
            enemy.path = null;
            enemy.pathIndex = 0;
            this.addGuildNote(`${this.getEnemyDisplayName(enemy)} heads back to the forest.`);
            return;
          }
          enemy.target = route.target;
          enemy.path = route.pathIso;
          enemy.pathIndex = route.pathIso.length > 1 ? 1 : 0;
          enemy.routeScore = route.score;
          enemy.routeCost = route.cost;
          enemy.routeHealthFactor = route.healthFactor;
        } else {
          const nextTarget = this.getEnemyTarget();
          if (!nextTarget) {return;}
          enemy.target = nextTarget;
        }
      }
      let targetIso = enemy.retreating ? this.getNearestForestExit(enemy.iso) : enemy.target.iso;
      if (!enemy.retreating && enemy.path?.length) {
        const waypointArrivalRadius = 0.38;
        let currentWaypoint = enemy.path[Math.min(enemy.pathIndex, enemy.path.length - 1)];
        while (
          enemy.pathIndex < enemy.path.length - 1
          && Phaser.Math.Distance.Between(enemy.iso.x, enemy.iso.y, currentWaypoint.x, currentWaypoint.y) <= waypointArrivalRadius
        ) {
          enemy.pathIndex += 1;
          currentWaypoint = enemy.path[Math.min(enemy.pathIndex, enemy.path.length - 1)];
        }
        targetIso = currentWaypoint;
      }
      const dist = Phaser.Math.Distance.Between(enemy.iso.x, enemy.iso.y, targetIso.x, targetIso.y);
      if (time > enemy.dazedUntil && dist > 0.35) {
        const vx = (targetIso.x - enemy.iso.x) / dist;
        const vy = (targetIso.y - enemy.iso.y) / dist;
        enemy.iso.x += vx * enemy.speed * dt * (enemy.retreating ? 1.8 : 1);
        enemy.iso.y += vy * enemy.speed * dt * (enemy.retreating ? 1.8 : 1);
        enemy.sprite.setFlipX(vx < -0.02);
      }
      const reachedAttackZone = !enemy.path?.length || enemy.pathIndex >= enemy.path.length - 1;
      if (!enemy.retreating && reachedAttackZone && dist <= 0.45 && time > enemy.touchCooldown) {
        enemy.touchCooldown = time + 1250;
        this.bumpBuilding(enemy.target, enemy.buildingDamage);
        this.playTone('hit');
      }
      const playerDist = Phaser.Math.Distance.Between(enemy.iso.x, enemy.iso.y, this.player.iso.x, this.player.iso.y);
      if (!enemy.retreating && playerDist <= 0.58 && time > enemy.heroTouchCooldown) {
        enemy.heroTouchCooldown = time + 1400;
        this.takePlayerDamage(enemy.contactDamage, enemy);
      }
      if (enemy.retreating && dist < 0.55) {
        this.removeEnemy(enemy, false);
      }
      const p = this.isoToScreen(enemy.iso.x, enemy.iso.y, 16 + Math.sin(time / 240 + enemy.wobble) * 2);
      enemy.sprite.setPosition(p.x, p.y);
      enemy.shadow.setPosition(p.x, p.y + 14);
      enemy.sprite.rotation = time < enemy.dazedUntil ? Math.sin(time / 65) * 0.1 : Math.sin(time / 220 + enemy.wobble) * 0.04;
    });
  }

  getNearestForestExit(iso) {
    const maxX = this.generatedLevelActive && this.generatedLevel ? this.generatedLevel.width - 0.8 : 14.2;
    const maxY = this.generatedLevelActive && this.generatedLevel ? this.generatedLevel.height - 0.8 : 14.2;
    const exits = [
      { x: iso.x, y: 0.8 },
      { x: maxX, y: iso.y },
      { x: iso.x, y: maxY },
      { x: 0.8, y: iso.y },
    ];
    return exits.reduce((best, exit) => (
      Phaser.Math.Distance.Between(iso.x, iso.y, exit.x, exit.y)
      < Phaser.Math.Distance.Between(iso.x, iso.y, best.x, best.y) ? exit : best
    ), exits[0]);
  }

  damageEnemy(enemy, amount, reason) {
    if (!this.enemies.includes(enemy) || enemy.defeated) {return;}
    enemy.hp -= amount;
    enemy.dazedUntil = Math.max(enemy.dazedUntil, this.time.now + 240);
    enemy.sprite.setTint(reason === 'sparkles' ? 0xbdf6ff : 0xfff3a0);
    this.time.delayedCall(120, () => {
      if (!enemy.sprite?.active || enemy.defeated) {return;}
      if (enemy.variantTint) {enemy.sprite.setTint(enemy.variantTint);}
      else {enemy.sprite.clearTint();}
    });
    this.spawnSparkleBurst(enemy.sprite.x, enemy.sprite.y - 18, reason === 'sparkles' ? 0x9be7ff : 0xffed95, 7, 0.56);
    this.playTone('hit');
    if (enemy.hp <= 0) {
      enemy.defeated = true;
      if (!enemy.countedDefeat) {
        enemy.countedDefeat = true;
        this.levelDefeatsThisRound += 1;
      }
      this.levelEnemiesRemaining = Math.max(0, this.levelRequiredDefeats - this.levelDefeatsThisRound);
      enemy.retreating = true;
      enemy.sprite.setFrame(this.getEnemyFrameKey(enemy, enemy.defeatFrame ?? 7));
      enemy.sprite.setTint(0xffffff);
      enemy.speed += 0.55;
      this.gainXp(enemy.rewardXp);
      this.dropReward(enemy.iso.x, enemy.iso.y, enemy);
      this.playTone('daze');
      if (enemy.isBoss) {
        this.addGuildNote(this.getCurrentWorldTheme().bossDefeat);
      } else {
        this.addGuildNote(Phaser.Math.RND.pick([
          'A forest critter scampered home dazed.',
          'Sparkles solved that little mix-up.',
          'The village cheers your gentle defense!',
        ]));
      }
      this.checkLevelClear();
    }
  }

  removeEnemy(enemy, animate = true) {
    this.enemies = this.enemies.filter((candidate) => candidate !== enemy);
    if (animate) {
      this.tweens.add({
        targets: [enemy.sprite, enemy.shadow],
        alpha: 0,
        scale: 0.4,
        duration: 420,
        ease: 'Back.easeIn',
        onComplete: () => {
          enemy.sprite.destroy();
          enemy.shadow.destroy();
        },
      });
    } else {
      enemy.sprite.destroy();
      enemy.shadow.destroy();
    }
  }

  clearRetreatingEnemies() {
    this.enemies.slice().forEach((enemy) => {
      if (enemy.defeated || enemy.retreating) {
        this.removeEnemy(enemy, true);
      }
    });
  }

  dropReward(x, y, enemy = null) {
    const roll = Phaser.Math.Between(0, 100);
    const type = roll < 58 ? 'gold' : roll < 76 ? 'mana' : roll < 90 ? 'heart' : 'xp';
    const texture = type === 'gold' ? 'coinTexture' : type === 'heart' ? 'heartTexture' : type === 'mana' ? 'manaTexture' : 'xpTexture';
    const p = this.isoToScreen(x, y, 12);
    const sprite = this.add.image(p.x, p.y - 16, texture)
      .setOrigin(0.5)
      .setDisplaySize(32, 32)
      .setDepth(p.y + 120);
    const goldRange = enemy?.rewardGold || [6, 15];
    const value = type === 'gold'
      ? Phaser.Math.Between(goldRange[0], goldRange[1])
      : type === 'xp'
        ? Math.max(12, Math.round((enemy?.rewardXp || 20) * 0.8))
        : 1;
    this.pickups.push({ type, iso: { x, y }, sprite, age: 0, value });
    this.fxLayer.add(sprite);
  }

  updatePickups(dt) {
    this.pickups.slice().forEach((pickup) => {
      pickup.age += dt;
      const p = this.isoToScreen(pickup.iso.x, pickup.iso.y, 22 + Math.sin(pickup.age * 5) * 5);
      pickup.sprite.setPosition(p.x, p.y - 18);
      pickup.sprite.rotation += dt * 1.4;
      const close = Phaser.Math.Distance.Between(pickup.iso.x, pickup.iso.y, this.player.iso.x, this.player.iso.y) < 1.05;
      if (close || pickup.age > 8) {
        this.collectPickup(pickup);
      }
    });
  }

  collectPickup(pickup) {
    this.pickups = this.pickups.filter((candidate) => candidate !== pickup);
    if (pickup.type === 'gold') {
      this.state.gold += pickup.value;
      if (Phaser.Math.Between(0, 4) === 0) {this.addGuildNote(`You found ${pickup.value} gold!`);}
    } else if (pickup.type === 'heart') {
      this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + 1);
    } else if (pickup.type === 'mana') {
      this.state.mana = Math.min(this.playerStats.maxMana, this.state.mana + 22);
    } else {
      this.gainXp(pickup.value);
    }
    this.playTone('sparkle');
    this.tweens.add({
      targets: pickup.sprite,
      y: pickup.sprite.y - 32,
      alpha: 0,
      scale: 1.4,
      duration: 280,
      onComplete: () => pickup.sprite.destroy(),
    });
  }

  updateProjectiles(dt) {
    this.projectiles.slice().forEach((projectile) => {
      projectile.iso.x += projectile.velocity.x * dt;
      projectile.iso.y += projectile.velocity.y * dt;
      projectile.distance += Math.hypot(projectile.velocity.x * dt, projectile.velocity.y * dt);
      const p = this.isoToScreen(projectile.iso.x, projectile.iso.y, 24);
      projectile.sprite.setPosition(p.x, p.y - 8);
      const target = this.enemies.find((enemy) => Phaser.Math.Distance.Between(
        projectile.iso.x,
        projectile.iso.y,
        enemy.iso.x,
        enemy.iso.y,
      ) < 0.54);
      if (target) {
        this.damageEnemy(target, projectile.power, 'arrow');
        this.destroyProjectile(projectile);
      } else if (projectile.distance > projectile.range) {
        this.destroyProjectile(projectile);
      }
    });
  }

  destroyProjectile(projectile) {
    this.projectiles = this.projectiles.filter((candidate) => candidate !== projectile);
    this.tweens.add({
      targets: projectile.sprite,
      alpha: 0,
      scale: 0.45,
      duration: 150,
      onComplete: () => projectile.sprite.destroy(),
    });
  }

  clearProjectiles() {
    this.projectiles.splice(0).forEach((projectile) => projectile.sprite.destroy());
  }

  bumpBuilding(building, amount) {
    if (this.state.phase !== 'playing' || building.hp <= 0) {return;}
    building.hp = Math.max(0, building.hp - amount);
    building.underAttackUntil = this.time.now + 650;
    building.sprite.setTint(0xfff0a0);
    building.repairIcon.setVisible(true);
    this.tweens.add({
      targets: building.sprite,
      x: building.sprite.x + 5,
      yoyo: true,
      repeat: 3,
      duration: 44,
      onComplete: () => {
        this.updateBuildingRepairState(building);
      },
    });
    this.time.delayedCall(1500, () => {
      if (this.time.now > building.underAttackUntil) {this.updateBuildingRepairState(building);}
    });
    if (building.hp <= 0) {
      building.hp = 0;
      this.updateBuildingRepairState(building);
      this.state.villageSafety = Math.max(0, this.state.villageSafety - (building.name === 'Castle' ? 100 : 14));
      if (building.name === 'Castle') {
        this.addGuildNote('The castle needs a rescue rest!');
        this.enterGameOver('The castle needs a rescue rest!');
      } else {
        this.addGuildNote(`${building.name} needs repairs, but everyone is okay!`);
      }
      this.spawnSparkleBurst(building.sprite.x, building.sprite.y - 20, 0xffc785, 13, 0.85);
    }
  }

  updateBuildingRepairState(building) {
    if (building.hp <= 0) {
      building.repairIcon.setVisible(true);
      building.sprite.setTint(0xffc98c);
      return;
    }
    if (building.hp < building.max) {
      building.repairIcon.setVisible(true);
      if (this.time.now > building.underAttackUntil) {building.sprite.clearTint();}
      return;
    }
    building.repairIcon.setVisible(false);
    building.sprite.clearTint();
  }

  updateVillageSafety() {
    const totalImportance = this.buildings.reduce((sum, building) => sum + (building.importance ?? 1), 0);
    const weightedHealth = this.buildings.reduce((sum, building) => (
      sum + (building.hp / building.max) * (building.importance ?? 1)
    ), 0);
    const target = totalImportance > 0 ? Math.round((weightedHealth / totalImportance) * 100) : 100;
    this.state.villageSafety = Phaser.Math.Clamp(Math.round((this.state.villageSafety * 3 + target) / 4), 0, 100);
    if (this.state.villageSafety < 30 && this.state.health > 0) {
      this.addGuildNote('Village safety is low. Protect the buildings!');
    }
  }

  takePlayerDamage(amount, enemy) {
    if (this.state.phase !== 'playing' || this.time.now < this.player.invulnerableUntil) {return;}
    this.state.health = Math.max(0, this.state.health - amount);
    this.player.invulnerableUntil = this.time.now + 1650;
    if (enemy) {
      const dx = this.player.iso.x - enemy.iso.x;
      const dy = this.player.iso.y - enemy.iso.y;
      const len = Math.max(0.01, Math.hypot(dx, dy));
      this.player.iso.x += (dx / len) * 0.28;
      this.player.iso.y += (dy / len) * 0.28;
      this.clampIso(this.player.iso, 1.2);
    }
    this.playTone('hit');
    this.spawnSparkleBurst(this.player.sprite.x, this.player.sprite.y - 28, 0xffb3c1, 10, 0.66);
    if (this.state.health <= 0) {
      this.enterGameOver('Your hero ran out of hearts!');
    }
  }

  checkFailureState() {
    if (this.state.phase === 'gameOver') {return;}
    if (this.state.health <= 0) {
      this.enterGameOver('Your hero ran out of hearts!');
      return;
    }
    const castle = this.buildings.find((building) => building.name === 'Castle');
    if (castle && castle.hp <= 0) {
      this.enterGameOver('The castle needs a rescue rest!');
    }
  }

  enterGameOver(reason) {
    if (this.state.phase === 'gameOver') {return;}
    this.state.phase = 'gameOver';
    this.state.gameOverReason = reason;
    this.state.inventoryOpen = false;
    this.setRepairMode(false, false);
    this.inventoryPanel?.setVisible(false);
    this.countdownOverlay?.setVisible(false);
    this.levelUpOverlay?.setVisible(false);
    this.clearLevelTimers();
    this.clearProjectiles();
    this.showGameOverScreen(reason);
    this.setMusicSoftened(true);
    this.playTone('gameOver');
  }

  gainXp(amount) {
    this.state.xp += amount;
  }

  regenMana(amount) {
    this.state.mana = Math.min(this.playerStats.maxMana, this.state.mana + amount);
  }

  spawnSparkleBurst(x, y, color = 0xfff1a7, count = 10, scale = 1) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.2, 0.2);
      const radius = Phaser.Math.FloatBetween(15, 44) * scale;
      const particle = this.add.circle(x, y, Phaser.Math.FloatBetween(2.4, 5.2) * scale, color, 0.9);
      particle.setDepth(y + 260 + i);
      this.fxLayer.add(particle);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius - Phaser.Math.Between(8, 24),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(360, 720),
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  spawnSpellBloom(x, y, scale = 1) {
    const ring = this.add.circle(x, y, 18, 0x9eefff, 0.16).setStrokeStyle(3, 0xd9fbff, 0.85);
    const burst = this.add.image(x, y, 'spellIconTexture')
      .setOrigin(0.5)
      .setDisplaySize(92 * scale, 92 * scale)
      .setAlpha(0.92)
      .setDepth(y + 300);
    ring.setDepth(y + 299);
    this.fxLayer.add([ring, burst]);
    this.spawnSparkleBurst(x, y, 0xa5efff, 18, scale);
    this.tweens.add({
      targets: [ring, burst],
      scale: 2.8 * scale,
      alpha: 0,
      rotation: Math.PI,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy();
        burst.destroy();
      },
    });
  }

  spawnShieldGlow() {
    const glow = this.add.circle(this.player.sprite.x, this.player.sprite.y - 24, 34, 0x8ef6c0, 0.16)
      .setStrokeStyle(3, 0xd7ffe5, 0.8)
      .setDepth(this.player.sprite.depth + 20);
    this.fxLayer.add(glow);
    this.tweens.add({
      targets: glow,
      scale: 1.8,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onUpdate: () => glow.setPosition(this.player.sprite.x, this.player.sprite.y - 24),
      onComplete: () => glow.destroy(),
    });
  }

  updateEffects(dt) {
    this.effects = this.effects.filter((effect) => {
      effect.life -= dt;
      if (effect.life <= 0) {
        effect.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  updateDepths() {
    if (!this.player) {return;}
    this.player.sprite.setDepth(this.player.sprite.y + 80);
    this.player.shadow.setDepth(this.player.sprite.y + 10);
    this.enemies.forEach((enemy) => {
      enemy.shadow.setDepth(enemy.sprite.y + 5);
      enemy.sprite.setDepth(enemy.sprite.y + 70);
    });
    this.chests.forEach((chest) => {
      if (!chest.opened) {
        chest.glow.setDepth(chest.sprite.y + 40);
        chest.sprite.setDepth(chest.sprite.y + 58);
      }
    });
  }

  createPhaseOverlays() {
    this.createSplashOverlay();
    this.createCountdownOverlay();
    this.createLevelUpOverlay();
    this.createGameOverOverlay();
  }

  createSplashOverlay() {
    this.splashOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7900).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x17344f, 0.36);
    const panel = this.add.image(0, 0, 'gameOverUI')
      .setDisplaySize(760, 428)
      .setAlpha(0.99);
    const title = this.add.text(0, -94, 'The Village Must Stand', {
      ...this.uiTextStyle(43, '#714617'),
      align: 'center',
      strokeThickness: 5,
      wordWrap: { width: 610 },
    }).setOrigin(0.5);
    const credit = this.add.text(0, -30, 'A minigame by Javier Algaba', {
      ...this.uiTextStyle(20, '#31503b'),
      strokeThickness: 3,
    }).setOrigin(0.5);
    const prompt = this.add.text(0, 30, 'Defend the fairy-tale village from forest mischief.', {
      ...this.uiTextStyle(17, COLORS.uiInk),
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5);
    const startButton = this.add.rectangle(0, 144, 250, 62, 0xfff1b8, 0.08)
      .setInteractive({ useHandCursor: true });
    const startText = this.add.text(0, 136, 'START', {
      ...this.uiTextStyle(28, '#684315'),
      strokeThickness: 4,
    }).setOrigin(0.5);
    startButton.on('pointerover', () => startButton.setFillStyle(0xfff1b8, 0.2));
    startButton.on('pointerout', () => startButton.setFillStyle(0xfff1b8, 0.08));
    startButton.on('pointerup', () => this.startGameFromSplash());
    this.splashOverlay.add([shade, panel, title, credit, prompt, startButton, startText]);
    this.uiLayer.add(this.splashOverlay);
  }

  createCountdownOverlay() {
    this.countdownOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7200).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x244866, 0.28);
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 0.82);
    panel.lineStyle(3, 0xffda73, 0.78);
    panel.fillRoundedRect(-210, -116, 420, 232, 8);
    panel.strokeRoundedRect(-210, -116, 420, 232, 8);
    this.countdownLevelText = this.add.text(0, -54, '', this.uiTextStyle(34, '#31503b')).setOrigin(0.5);
    this.countdownNumberText = this.add.text(0, 30, '', {
      ...this.uiTextStyle(72, '#7a4b16'),
      strokeThickness: 5,
    }).setOrigin(0.5);
    this.countdownOverlay.add([shade, panel, this.countdownLevelText, this.countdownNumberText]);
    this.uiLayer.add(this.countdownOverlay);
  }

  createLevelUpOverlay() {
    this.levelUpChoices = [
      {
        key: 'melee',
        label: 'Melee Damage',
        detail: '+1 sword power',
        icon: { texture: 'uiAtlas', frame: 'sword_icon_01' },
        stat: 'swordPower',
        color: 0xf4bc3f,
        stageColor: 0xb94136,
        stageAccent: 0xffd45c,
        apply: () => {
          this.playerStats.swordPower += 1;
          this.addGuildNote('Melee training complete! Sword damage increased.');
        },
      },
      {
        key: 'range',
        label: 'Range Damage',
        detail: '+1 bow power',
        icon: { texture: 'uiAtlas', frame: 'bow_icon_01' },
        stat: 'bowPower',
        color: 0x72c96d,
        stageColor: 0x397f4a,
        stageAccent: 0xbde679,
        apply: () => {
          this.playerStats.bowPower += 1;
          this.addGuildNote('Range training complete! Bow damage increased.');
        },
      },
      {
        key: 'magic',
        label: 'Magic Damage',
        detail: '+1 spell power',
        icon: { texture: 'uiAtlas', frame: 'spell_icon_01' },
        stat: 'spellPower',
        color: 0x6cc5ff,
        stageColor: 0x3267c9,
        stageAccent: 0xa8f3ff,
        apply: () => {
          this.playerStats.spellPower += 1;
          this.addGuildNote('Magic training complete! Spell damage increased.');
        },
      },
    ];

    this.levelUpOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7300).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x17344f, 0.42);
    const art = this.add.image(0, 0, 'levelUpUI').setDisplaySize(780, 438).setAlpha(0.98);
    this.levelUpTitleText = this.add.text(0, -148, 'Level Up!', {
      ...this.uiTextStyle(42, '#714617'),
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.levelUpRewardText = this.add.text(0, -102, 'Heart +1', this.uiTextStyle(22, '#bd415c')).setOrigin(0.5);
    const helper = this.add.text(0, -70, 'Choose your guild training', this.uiTextStyle(18, '#31503b')).setOrigin(0.5);
    this.levelUpOverlay.add([shade, art, this.levelUpTitleText, this.levelUpRewardText, helper]);

    this.levelUpProgressBars = [];
    this.levelUpChoices.forEach((choice, index) => {
      const card = this.add.container(LEVEL_UP_CARD_XS[index], 76);
      const hit = this.add.rectangle(0, 0, 196, 220, 0xfff1b8, 0.001)
        .setInteractive({ useHandCursor: true });
      const stage = this.createLevelUpIconStage(choice);
      const icon = this.add.image(0, -24, choice.icon.texture, choice.icon.frame).setDisplaySize(76, 76);
      const number = this.add.text(-76, -70, `${index + 1}`, this.uiTextStyle(18, '#8a5a20')).setOrigin(0.5);
      const label = this.add.text(0, 82, choice.label, this.uiTextStyle(19, COLORS.uiInk)).setOrigin(0.5);
      const detail = this.add.text(0, 110, choice.detail, this.uiTextStyle(14, '#5e7b4a')).setOrigin(0.5);
      const pips = this.createLevelUpProgressPips(choice);
      hit.on('pointerover', () => {
        hit.setFillStyle(0xfff1b8, 0.16);
        this.updateLevelUpProgressBars(index);
      });
      hit.on('pointerout', () => {
        hit.setFillStyle(0xfff1b8, 0.001);
        this.updateLevelUpProgressBars();
      });
      hit.on('pointerup', () => this.chooseLevelUpgrade(index));
      card.add([hit, stage, icon, number, ...pips, label, detail]);
      this.levelUpOverlay.add(card);
    });
    this.uiLayer.add(this.levelUpOverlay);
  }

  createLevelUpIconStage(choice) {
    const stage = this.add.graphics();
    stage.fillStyle(choice.stageColor, 0.22);
    stage.fillRoundedRect(-58, -72, 116, 94, 10);
    stage.lineStyle(2, choice.stageAccent, 0.36);
    stage.strokeRoundedRect(-58, -72, 116, 94, 10);
    stage.fillStyle(choice.stageColor, 0.34);
    stage.fillEllipse(0, 18, 112, 22);
    stage.fillStyle(choice.stageAccent, 0.18);
    stage.fillRoundedRect(-50, -66, 100, 16, 8);
    return stage;
  }

  createLevelUpProgressPips(choice) {
    const pips = [];
    const pipW = 20;
    const gap = 5;
    const startX = -((LEVEL_UP_MAX_PIPS - 1) * (pipW + gap)) / 2;
    for (let i = 0; i < LEVEL_UP_MAX_PIPS; i += 1) {
      const pip = this.add.rectangle(startX + i * (pipW + gap), 48, pipW, 9, 0xfff3c8, 0.46)
        .setStrokeStyle(1, 0x8c6023, 0.5);
      pips.push(pip);
    }
    this.levelUpProgressBars.push({ pips, stat: choice.stat, color: choice.color });
    return pips;
  }

  updateLevelUpProgressBars(previewIndex = null) {
    this.levelUpProgressBars.forEach((bar, index) => {
      const current = Phaser.Math.Clamp(this.playerStats[bar.stat] - PLAYER_BASE[bar.stat], 0, LEVEL_UP_MAX_PIPS);
      const preview = previewIndex === index ? Phaser.Math.Clamp(current + 1, 0, LEVEL_UP_MAX_PIPS) : current;
      bar.pips.forEach((pip, pipIndex) => {
        if (pipIndex < current) {
          pip.setFillStyle(bar.color, 0.94);
          pip.setStrokeStyle(1, 0xffffff, 0.72);
        } else if (pipIndex < preview) {
          pip.setFillStyle(bar.color, 0.5);
          pip.setStrokeStyle(1, 0xffffff, 0.64);
        } else {
          pip.setFillStyle(0xfff3c8, 0.46);
          pip.setStrokeStyle(1, 0x8c6023, 0.5);
        }
      });
    });
  }

  showSplashScreen() {
    this.clearLevelTimers();
    this.state.phase = 'splash';
    this.state.inventoryOpen = false;
    this.setRepairMode(false, false);
    this.inventoryPanel?.setVisible(false);
    this.countdownOverlay?.setVisible(false);
    this.levelUpOverlay?.setVisible(false);
    this.gameOverOverlay?.setVisible(false);
    if (this.shouldAutoStartFromParams()) {
      this.splashOverlay?.setVisible(false).setAlpha(0);
      this.startGameFromSplash();
      return;
    }
    this.splashOverlay?.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.splashOverlay,
      alpha: 1,
      duration: 260,
      ease: 'Sine.easeOut',
    });
  }

  startGameFromSplash() {
    if (this.state.phase !== 'splash') {return;}
    this.ensureAudio();
    this.playTone('level');
    this.splashOverlay?.setVisible(false);
    this.addGuildNote('The village adventure begins!');
    this.startLevelCountdown();
  }

  createGameOverOverlay() {
    this.gameOverOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7800).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x17344f, 0.48);
    const panel = this.add.image(0, 0, 'gameOverUI')
      .setDisplaySize(780, 439)
      .setAlpha(0.99);
    const title = this.add.text(0, -120, 'Guild Rest Time', {
      ...this.uiTextStyle(40, '#714617'),
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.gameOverReasonText = this.add.text(0, -52, '', {
      ...this.uiTextStyle(21, COLORS.uiInk),
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5);
    this.gameOverStatsText = this.add.text(0, 38, '', this.uiTextStyle(19, '#31503b')).setOrigin(0.5);
    const restartButton = this.add.rectangle(0, 158, 260, 58, 0xfff1b8, 0.04)
      .setInteractive({ useHandCursor: true });
    const restartText = this.add.text(0, 151, 'Restart (R)', {
      ...this.uiTextStyle(22, '#684315'),
      strokeThickness: 3,
    }).setOrigin(0.5);
    restartButton.on('pointerover', () => restartButton.setFillStyle(0xfff1b8, 0.18));
    restartButton.on('pointerout', () => restartButton.setFillStyle(0xfff1b8, 0.04));
    restartButton.on('pointerup', () => this.scene.restart());
    this.gameOverOverlay.add([shade, panel, title, this.gameOverReasonText, this.gameOverStatsText, restartButton, restartText]);
    this.uiLayer.add(this.gameOverOverlay);
  }

  showLevelUpScreen() {
    this.levelUpTitleText.setText('Level Up!');
    this.levelUpRewardText.setText('Heart +1');
    this.updateLevelUpProgressBars();
    this.levelUpOverlay.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.levelUpOverlay,
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut',
    });
    this.spawnSparkleBurst(this.player.sprite.x, this.player.sprite.y - 38, 0xa8f3ff, 28, 1.25);
    this.playTone('level');
  }

  chooseLevelUpgrade(index) {
    if (this.state.phase !== 'levelUp') {return;}
    const choice = this.levelUpChoices[index];
    if (!choice) {return;}
    const wasBossRound = this.state.bossRound;
    this.playerStats.maxHealth += 1;
    this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + 1);
    choice.apply();
    this.updateLevelUpProgressBars();
    this.spawnShieldGlow();
    this.playTone('level');
    this.state.level += 1;
    const nextProgression = this.getNextWorldProgressionState();
    this.state.worldIndex = nextProgression.worldIndex;
    this.state.worldKey = nextProgression.worldKey;
    this.state.worldRound = nextProgression.worldRound;
    this.state.bossRound = nextProgression.bossRound;
    this.state.worldCycle = nextProgression.worldCycle;
    this.levelUpOverlay.setVisible(false);
    if (wasBossRound) {
      const theme = WORLD_ENEMY_THEMES[nextProgression.worldKey as SeasonPreset];
      const transitionNote = `${theme.label} rises over the village.`;
      if (this.generatedLevelActive) {
        const snapshot = this.createRunResumeSnapshot(nextProgression, transitionNote);
        this.scene.restart({
          resumeRunState: snapshot,
          sceneVariantKey: nextProgression.worldKey,
          resumeSkipSplash: true,
        });
        return;
      }
      this.addGuildNote(transitionNote);
    }
    this.startLevelCountdown();
  }

  showGameOverScreen(reason) {
    this.gameOverReasonText.setText(reason);
    this.gameOverStatsText.setText(`Final Level ${this.state.level}   Gold ${this.state.gold}`);
    this.gameOverOverlay.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.gameOverOverlay,
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }

  createHud() {
    this.hud = {};
    this.createTopBar();
    this.createNotesPanel();
    this.createControlsHint();
    this.createInventoryPanel();
    this.createDebugOverlay();
  }

  createTopBar() {
    const top = this.add.container(16, 10).setDepth(7600);
    const bg = this.add.image(0, 0, 'statusPanelUI', 'panel')
      .setOrigin(0, 0)
      .setDisplaySize(892, 92);
    const readability = this.add.graphics();
    readability.fillStyle(0xfff7df, 0.96);
    readability.fillRoundedRect(34, 18, 822, 58, 7);
    top.add([bg, readability]);
    this.hud.hearts = this.add.container(42, 34);
    this.hud.manaBar = this.createMeter(174, 22, 148, 16, 0x6fc9ff, 0x1f6ea7);
    this.hud.xpBar = this.createMeter(174, 51, 148, 14, 0xffd96c, 0xba7620);
    this.hud.goldText = this.add.text(360, 19, '', this.uiTextStyle(20, '#56330f')).setOrigin(0, 0);
    this.hud.levelText = this.add.text(360, 48, '', this.uiTextStyle(17, '#1e3348')).setOrigin(0, 0);
    this.hud.weaponText = this.add.text(526, 19, '', this.uiTextStyle(16, '#1e3348')).setOrigin(0, 0);
    this.hud.spellText = this.add.text(526, 48, '', this.uiTextStyle(16, '#1e3348')).setOrigin(0, 0);
    this.hud.safetyBar = this.createMeter(736, 22, 112, 17, 0x9ce889, 0x2f9b4c);
    this.hud.waveText = this.add.text(738, 48, '', this.uiTextStyle(15, '#224b31')).setOrigin(0, 0);
    top.add([
      this.hud.hearts,
      ...this.hud.manaBar.parts,
      ...this.hud.xpBar.parts,
      this.hud.goldText,
      this.hud.levelText,
      this.hud.weaponText,
      this.hud.spellText,
      ...this.hud.safetyBar.parts,
      this.hud.waveText,
    ]);
    this.uiLayer.add(top);
  }

  createMeter(x, y, w, h, fillColor, strokeColor) {
    const bg = this.add.rectangle(x, y, w, h, 0xf9fff8, 0.9).setOrigin(0, 0).setStrokeStyle(2, strokeColor, 0.8);
    const fill = this.add.rectangle(x + 3, y + 3, w - 6, h - 6, fillColor, 1).setOrigin(0, 0);
    const shine = this.add.rectangle(x + 5, y + 4, w - 10, 3, 0xffffff, 0.42).setOrigin(0, 0);
    return { bg, fill, shine, width: w - 6, parts: [bg, fill, shine] };
  }

  createNotesPanel() {
    const panel = this.add.container(WIDTH - 370, 12).setDepth(7600);
    const bg = this.add.image(0, 0, 'guildNotesUI', 'panel')
      .setOrigin(0, 0)
      .setDisplaySize(354, 236);
    const textBacking = this.add.graphics();
    textBacking.fillStyle(0xfff8df, 0.84);
    textBacking.fillRoundedRect(22, 60, 310, 146, 7);
    const title = this.add.text(177, 29, 'Guild Notes', {
      ...this.uiTextStyle(22, '#102f3e'),
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.hud.notesText = this.add.text(30, 68, '', {
      ...this.uiTextStyle(15, '#162a3c'),
      lineSpacing: 7,
      wordWrap: { width: 292 },
    });
    panel.add([bg, textBacking, title, this.hud.notesText]);
    this.uiLayer.add(panel);
  }

  createControlsHint() {
    const hint = this.add.container(18, HEIGHT - 58).setDepth(6000);
    this.controlsHint = hint;
    const bg = this.add.graphics();
    bg.fillStyle(0x22324a, 0.62);
    bg.fillRoundedRect(0, 0, 792, 38, 8);
    const text = this.add.text(
      14,
      10,
      'WASD/Arrows move   Space sword   Click/F bow   Q/R spell   T repair kit   Space/click/E repair   I inventory',
      this.uiTextStyle(13, '#ffffff'),
    );
    hint.add([bg, text]);
    this.uiLayer.add(hint);
  }

  createInventoryPanel() {
    this.inventoryPanel = this.add.container(WIDTH - 346, 178).setDepth(6100).setVisible(false);
    this.uiLayer.add(this.inventoryPanel);
    this.rebuildInventoryPanel();
  }

  rebuildInventoryPanel() {
    if (!this.inventoryPanel) {return;}
    this.inventoryPanel.removeAll(true);
    const bg = this.add.graphics();
    bg.fillStyle(0xfff9e8, 0.95);
    bg.lineStyle(2, 0xd0a24b, 0.7);
    bg.fillRoundedRect(0, 0, 326, 306, 8);
    bg.strokeRoundedRect(0, 0, 326, 306, 8);
    const title = this.add.text(16, 12, 'Inventory & Upgrades', this.uiTextStyle(20, '#6a4618'));
    const gold = this.add.text(18, 42, `Gold: ${this.state.gold}`, this.uiTextStyle(16, '#75521e'));
    this.inventoryPanel.add([bg, title, gold]);
    this.upgrades.forEach((upgrade, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = 16 + col * 150;
      const y = 72 + row * 72;
      const price = upgrade.cost + upgrade.level * 25;
      const card = this.add.graphics();
      card.fillStyle(0xffffff, 0.82);
      card.lineStyle(2, this.state.gold >= price ? 0x79bd68 : 0xd4c2a1, 0.8);
      card.fillRoundedRect(x, y, 136, 58, 7);
      card.strokeRoundedRect(x, y, 136, 58, 7);
      const icon = this.add.image(x + 24, y + 29, upgrade.icon).setDisplaySize(30, 30);
      const name = this.add.text(x + 46, y + 8, `${index + 1}. ${upgrade.name}`, this.uiTextStyle(14, COLORS.uiInk));
      const detail = this.add.text(x + 46, y + 28, `Lv ${upgrade.level}  ${price}g`, this.uiTextStyle(13, '#6d7b48'));
      const small = this.add.text(x + 8, y + 58, upgrade.detail, this.uiTextStyle(11, '#765f42'));
      this.inventoryPanel.add([card, icon, name, detail, small]);
    });
  }

  toggleInventory() {
    if (this.state.phase !== 'playing') {return;}
    this.state.inventoryOpen = !this.state.inventoryOpen;
    this.inventoryPanel.setVisible(this.state.inventoryOpen);
    this.rebuildInventoryPanel();
    this.addGuildNote(this.state.inventoryOpen ? 'Guild pack opened. Press 1-6 to upgrade.' : 'Guild pack tucked away.');
  }

  isDebugOverlayRequested() {
    const params = new URLSearchParams(window.location.search);
    const storageEnabled = (() => {
      try {
        return localStorage.getItem('debugGameOverlay') === '1';
      } catch {
        return false;
      }
    })();
    return params.has('debugGame') || storageEnabled;
  }

  createDebugOverlay() {
    this.debugOverlayVisible = this.isDebugOverlayRequested();
    const panel = this.add.container(18, 112).setDepth(8050).setVisible(this.debugOverlayVisible);
    const bg = this.add.rectangle(0, 0, 404, 264, 0x102238, 0.78)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffdf7c, 0.72);
    const title = this.add.text(12, 10, 'Balance Debug (B)', {
      ...this.uiTextStyle(14, '#fff2b8'),
      strokeThickness: 2,
    });
    const text = this.add.text(12, 34, '', {
      ...this.uiTextStyle(12, '#f7fff0'),
      lineSpacing: 3,
      wordWrap: { width: 380 },
    });
    panel.add([bg, title, text]);
    this.uiLayer.add(panel);
    this.debugOverlay = { panel, text };
  }

  toggleDebugOverlay() {
    if (!this.debugOverlay) {return;}
    this.debugOverlayVisible = !this.debugOverlayVisible;
    this.debugOverlay.panel.setVisible(this.debugOverlayVisible);
    this.updateDebugOverlay();
  }

  getGeneratedRouteDebugSummary() {
    if (!this.generatedLevel) {
      return '';
    }
    const source = this.generatedLevel.spawnPoints[0] ?? this.generatedLevel.playerSpawn;
    if (!source) {
      return 'Routes unavailable';
    }
    const scores = this.getGeneratedRouteScores(source)
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    if (!scores.length) {
      return 'Routes no reachable targets';
    }
    return scores.map((choice) => (
      `${choice.building.name.slice(0, 3)} ${Math.round(choice.score)} d${choice.cost}`
    )).join(' | ');
  }

  getLiveEnemyTargetSummary() {
    const counts = this.enemies
      .filter((enemy) => !enemy.defeated && !enemy.retreating)
      .reduce((summary, enemy) => {
        const name = enemy.target?.name ?? 'None';
        summary[name] = (summary[name] ?? 0) + 1;
        return summary;
      }, {});
    const entries = Object.entries(counts);
    return entries.length
      ? entries.map(([name, count]) => `${name.slice(0, 3)}:${count}`).join(' ')
      : 'none';
  }

  updateDebugOverlay() {
    if (!this.debugOverlay?.panel.visible) {return;}
    const buildingSummary = this.buildings.length
      ? this.buildings.map((building) => `${building.name.slice(0, 1)}:${building.hp}/${building.max}`).join(' ')
      : 'none';
    const activeEnemies = this.enemies.filter((enemy) => !enemy.defeated && !enemy.retreating).length;
    const metrics = this.getIsoMetrics();
    const levelStatus = this.generatedLevelValidation
      ? `LevelGen ${this.generatedLevelValidation.valid ? 'valid' : 'errors'} | ${this.generatedLevelActive ? 'rendered' : 'standby'} | Grid ${this.levelDebugVisible ? 'G:on' : 'G:off'}`
      : 'LevelGen unavailable';
    const levelNotes = this.generatedLevelValidation
      ? `Gen notes E${this.generatedLevelValidation.errors.length} W${this.generatedLevelValidation.warnings.length + this.generatedLevelSelectionWarnings.length}`
      : '';
    const firstIssue = this.generatedLevelValidation?.errors[0]
      ?? this.generatedLevelSelectionWarnings[0]
      ?? this.generatedLevelValidation?.warnings[0]
      ?? '';
    this.debugOverlay.text.setText([
      `Phase ${this.state.phase} | L${this.state.level} | ${this.getCurrentWorldTheme().label} R${this.state.worldRound}${this.state.bossRound ? ' Boss' : ''} | Safe ${this.state.villageSafety}%`,
      `Hero ${this.state.health}/${this.playerStats.maxHealth} HP | Mana ${this.state.mana}/${this.playerStats.maxMana}`,
      `Gold ${this.state.gold} | XP ${this.state.xp} | Mode ${this.state.repairMode ? 'repair' : 'combat'}`,
      `Defeats ${this.levelDefeatsThisRound}/${this.levelRequiredDefeats} | pending ${this.levelSpawnsPending} | spawned ${this.levelSpawnedCount} | spawn skips ${this.levelSpawnFailures}`,
      `Enemies active ${activeEnemies} | remaining ${this.levelEnemiesRemaining}`,
      `Buildings ${buildingSummary}`,
      `Targets ${this.getLiveEnemyTargetSummary()}`,
      `Atk S${this.playerStats.swordPower} B${this.playerStats.bowPower} M${this.playerStats.spellPower} | Bow ${this.playerStats.bowCooldown}ms`,
      this.generatedLevel ? `Config ${this.generatedLevelConfigId} | Seed ${this.generatedLevel.config.seed}` : '',
      this.generatedLevel ? `Tile ${this.generatedLevel.config.tileSize}px -> ${Math.round(metrics.tileW)}x${Math.round(metrics.tileH)}` : '',
      `${levelStatus} | Time ${this.getActiveTimeOfDay()} (N)`,
      this.generatedLevel ? `Route score ${this.getGeneratedRouteDebugSummary()}` : '',
      levelNotes,
      firstIssue ? `First issue: ${this.truncateGuildNote(firstIssue, 52)}` : '',
    ].join('\n'));
  }

  isCompactUi() {
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    return this.touchControlsEnabled || viewportWidth < 900;
  }

  truncateGuildNote(note, maxLength) {
    if (note.length <= maxLength) {return note;}
    return `${note.slice(0, maxLength - 3).trimEnd()}...`;
  }

  getVisibleGuildNotes() {
    const compact = this.isCompactUi();
    const maxVisible = compact ? COMPACT_NOTES_MAX_VISIBLE : DESKTOP_NOTES_MAX_VISIBLE;
    return this.notes.slice(-maxVisible).map((note) => (
      compact ? this.truncateGuildNote(note, COMPACT_NOTE_MAX_CHARS) : note
    ));
  }

  updateHud() {
    this.renderHearts();
    this.setMeter(this.hud.manaBar, this.state.mana / this.playerStats.maxMana);
    this.setMeter(this.hud.xpBar, (this.state.xp % 100) / 100);
    this.setMeter(this.hud.safetyBar, this.state.villageSafety / 100);
    this.hud.goldText.setText(`Gold ${this.state.gold}`);
    this.hud.levelText.setText(`Level ${this.state.level}  XP ${this.state.xp}`);
    this.hud.weaponText.setText(`Wpn: ${this.state.equipped}`);
    this.hud.spellText.setText(`Spell: ${this.state.spell}`);
    this.hud.waveText.setText(`Safe ${this.state.villageSafety}%  L${this.state.level}`);
    this.hud.notesText.setText(this.getVisibleGuildNotes().map((note) => `- ${note}`).join('\n'));
    if (this.state.inventoryOpen) {
      const inventoryKey = `${this.state.gold}|${this.upgrades.map((upgrade) => upgrade.level).join(',')}`;
      if (this.hud.inventoryKey !== inventoryKey) {
        this.hud.inventoryKey = inventoryKey;
        this.rebuildInventoryPanel();
      }
    }
  }

  renderHearts() {
    if (this.hud.lastHearts === `${this.state.health}/${this.playerStats.maxHealth}`) {return;}
    this.hud.lastHearts = `${this.state.health}/${this.playerStats.maxHealth}`;
    this.hud.hearts.removeAll(true);
    for (let i = 0; i < this.playerStats.maxHealth; i += 1) {
      const x = (i % 8) * 18;
      const y = Math.floor(i / 8) * 19;
      const full = i < this.state.health;
      const heart = this.add.text(x, y, full ? '♥' : '♡', {
        fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
        fontSize: '20px',
        color: full ? '#eb5571' : '#b7a9a2',
      });
      this.hud.hearts.add(heart);
    }
  }

  setMeter(meter, ratio) {
    meter.fill.width = meter.width * Phaser.Math.Clamp(ratio, 0, 1);
    meter.shine.width = Math.max(0, meter.fill.width - 4);
  }

  uiTextStyle(size, color) {
    return {
      fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
      fontSize: `${size}px`,
      color,
      stroke: 'rgba(255,255,255,0.55)',
      strokeThickness: 2,
    };
  }

  addGuildNote(message) {
    if (this.notes[this.notes.length - 1] === message) {return;}
    this.notes.push(message);
    if (this.notes.length > 8) {this.notes.shift();}
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8bd6ff',
  width: WIDTH,
  height: HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: FairyGuildScene,
};

const game = new Phaser.Game(config);

if (import.meta.env.DEV) {
  (window as typeof window & { __fairyGuildGame?: Phaser.Game }).__fairyGuildGame = game;
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Service worker registration failed.', error);
    });
  });
}
