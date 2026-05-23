import * as Phaser from 'phaser';
import './style.css';
import { ASSET_REGISTRY } from './levels/assetRegistry';
import { buildSeasonBoardConfig } from './levels/buildSeasonBoard';
import { generateLevel, validateGeneratedLevel } from './levels/generateLevel';
import { resolveLevelConfigFromParams, shouldRenderGeneratedLevelFromParams } from './levels/levelCatalog';
import type { AssetRenderMetadata, GridPoint, LevelPlacement } from './levels/levelTypes';
import { findGridPath, pathCost } from './levels/pathfinding';


import { DEFAULT_PLAYABLE_BOUNDS, resolveSceneVariantFromParams, SCENE_VARIANTS, type SceneVariantConfig, type SeasonPreset } from './sceneVariants';
import {
  BOSS_CONFIGS,
  BOSS_ROUND_INDEX,
  COLORS,
  ENEMY_ARCHETYPES,
  ENEMY_VARIANTS,
  getLevelUpProgressForStat,
  getRangeLevelUpPresentationForStats,
  isBowEvolutionReadyForStats,
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
  PLAYER_BASE,
  REPAIR_AMOUNT,
  REPAIR_COOLDOWN,
  REPAIR_COST,
  REPAIR_OUTLINE_BACKING_COLOR,
  REPAIR_OUTLINE_BACKING_WIDTH,
  REPAIR_OUTLINE_COLORS,
  REPAIR_OUTLINE_FILL_ALPHA,
  REPAIR_OUTLINE_STROKE_WIDTH,
  REPAIR_RANGE,
  ROUNDS_PER_WORLD,
  TILE_H,
  TILE_W,
  WIDTH,
  WORLD_ENEMY_THEMES,
  WORLD_SEQUENCE,
  UPGRADE_DEFS,
  LEVEL_UP_CHOICE_DEFS,
} from './gameConfig';
import type {
  HeroChoice,
  TouchActionKey,
  TouchButtonSlot,
  UpgradePauseContext,
  TouchActionIcon,
  RepairModeTargetState,
  GeneratedSurroundAnchor,
  GeneratedSurroundLayer,
  ScreenFootprintBounds,
  TouchControlsState,
  RunResumeBuildingSnapshot,
  RunResumeStateSnapshot,
  DroppedChest,
} from './gameTypes';
import {
  GENERATED_SURROUND_PIECES,
} from './generatedSurroundConfig';
import { createGeneratedTextures } from './generatedTextures';
import { getWorldFogPieces, getWorldBackdropPieces, getWorldEdgeClusters } from './generatedWorldRenderData';
import { syncDevDiagnostics, consumeDevCommand, isDebugAutomationEnabled, getDebugAutomationHost, toDebugSlug, getDebugBuildingSummary, setDebugCommandResult, findDebugBuilding, teleportPlayerToDebugTarget, triggerDebugSeasonTransition } from './devCommands';
import { createUiPanelFrame, createTiledGameUiFrame, getGameUiFrameSize, createHorizontalSlicedFrame, createUiTitleBanner, fitUiTextToWidth, createFittedTitleText, createHudChip, createUiCardFrame, createUiButton, createManaMeter, uiTextStyle } from './uiFactory';
import { drawGeneratedLevelDebug, toggleGeneratedLevelDebug, updateGeneratedLevelDebug } from './levelDebugRenderer';
import { getActiveTimeOfDay, cycleTimeOfDay, getLampGlowIsoPoints, createTimeOfDayLayer } from './timeOfDayRenderer';
import { createAudioState, ensureAudio, playTone, playAudioNote, setMusicSoftened } from './audioManager';
import {
  getIsoMetrics as _getIsoMetrics,
  scaleGeneratedSize as _scaleGeneratedSize,
  getFootprintScreenBounds as _getFootprintScreenBounds,
  isoToScreen as _isoToScreen,
  isoToGroundedEntityScreen as _isoToGroundedEntityScreen,
  screenToIso as _screenToIso,
  clampIso as _clampIso,
  isGeneratedIsoWalkable as _isGeneratedIsoWalkable,
} from './isoUtils';

const TOUCH_CONTROL_SCALE = 1.5;
const scaleTouchControl = (value: number) => value * TOUCH_CONTROL_SCALE;

const GENERATED_BUILDING_SPRITE_ALPHA = 1;
const STATIC_BUILDING_BASE_ALPHA = 0.14;
const STATIC_BUILDING_SPRITE_ALPHA = 0.74;
const OCCLUDED_BUILDING_SPRITE_ALPHA = 0.5;
const OCCLUDED_STATIC_BUILDING_BASE_ALPHA = 0.06;
const BUILDING_OCCLUSION_PLAYER_Y_OFFSET_MAX = 12;
const BUILDING_OCCLUSION_PLAYER_Y_OFFSET_RATIO = 0.18;
const BUILDING_OCCLUSION_VERTICAL_CLEARANCE = 6;
const BUILDING_OCCLUSION_SPRITE_TOP_PADDING_RATIO = 0.12;
const BUILDING_OCCLUSION_HORIZONTAL_PADDING = 12;
const SPLASH_HERO_CARD_FILL_COLOR = 0xfff1b8;
const SPLASH_HERO_CARD_SELECTED_FILL_ALPHA = 0.18;
const SPLASH_HERO_CARD_IDLE_FILL_ALPHA = 0.045;
const SPLASH_HERO_CARD_SELECTION_STROKE_WIDTH = 3;
const SPLASH_HERO_CARD_SELECTED_STROKE_COLOR = 0xffd26d;
const SPLASH_HERO_CARD_IDLE_STROKE_COLOR = 0xd0a24b;
const SPLASH_HERO_CARD_SELECTED_STROKE_ALPHA = 0.95;
const SPLASH_HERO_CARD_IDLE_STROKE_ALPHA = 0.35;
const SPLASH_HERO_CARD_SELECTED_LABEL_COLOR = '#5f3b12';
const SPLASH_HERO_CARD_IDLE_LABEL_COLOR = '#7d6039';
const SPLASH_START_BUTTON_READY_FILL_ALPHA = 0.1;
const SPLASH_START_BUTTON_DISABLED_FILL_ALPHA = 0.035;
const SPLASH_START_BUTTON_DISABLED_TEXT_ALPHA = 0.45;

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
    this.heroChoice = this.resolveRequestedHeroChoice();
    this.heroAnimPrefix = 'hero';
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
    this.levelUpChoiceCards = [];
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
    this.repairModeOutline = null;
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
    this.levelDebugLayer = null;
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
    this.forceFreshStart = false;
    this.upgradePauseContext = 'roundClear';
    this.pausedRoundTimers = [];
    this.parallaxSprites = [];
    this.audio = createAudioState();
  }

  init(data) {
    this.sceneVariantOverrideKey = data?.sceneVariantKey ?? null;
    this.forceFreshStart = Boolean(data?.forceFreshStart);
    this.resumeRunState = this.forceFreshStart ? null : data?.resumeRunState ?? null;
    this.resumeSkipSplash = !this.forceFreshStart && Boolean(data?.resumeSkipSplash);
    this.heroChoice = data?.heroChoice ?? data?.resumeRunState?.heroChoice ?? this.resolveRequestedHeroChoice();
  }

  preload() {
    this.load.image('villageBoard', '/assets/village-board.png');
    this.load.image('repairTool', '/assets/repair-tool.png');
    this.load.image('heroSheet', '/assets/hero-sheet.png');
    this.load.image('princessHeroSheet', '/assets/princess-hero-sheet.png');
    this.load.image('repairModeCancelIcon', '/assets/repair-mode-cancel-icon.png');
    this.load.image('monsterSheet', '/assets/monster-pickup-sheet.png');
    this.load.atlas('worldTilesAtlas', '/assets/world_tiles_atlas.png', '/assets/world_tiles_atlas.json');
    this.load.atlas('buildingsAtlas', '/assets/buildings_atlas.png', '/assets/buildings_atlas.json');
    this.load.atlas('uiAtlas', '/assets/ui_atlas.png', '/assets/ui_atlas.json');
    this.load.atlas('gameUiAtlas', '/assets/game_ui_atlas.png', '/assets/game_ui_atlas.json');
    this.load.atlas('touchControlsAtlas', '/assets/touch_controls_atlas.png', '/assets/touch_controls_atlas.json');
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
    this.registerSheetFrames('heroSheet', 8, 4, 'hero');
    if (this.textures.exists('princessHeroSheet')) {
      this.registerSheetFrames('princessHeroSheet', 8, 4, 'princess');
    }
    this.registerSheetFrames('monsterSheet', 8, 5, 'monster');
    this.registerWorldEnemySheets();
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
    this.levelDebugLayer = this.add.layer().setDepth(4600);
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
    this.addGuildNote('Dropped chests open on contact and fade quickly.');
  }

  registerWorldEnemySheets() {
    WORLD_SEQUENCE.forEach((worldKey) => {
      const theme = WORLD_ENEMY_THEMES[worldKey];
      if (this.textures.exists(theme.eliteAssetKey)) {
        this.validateWorldEnemySheet(theme.eliteAssetKey, theme.eliteCellSize, theme.frameCount, worldKey, 'elite');
        this.registerSheetFrames(theme.eliteAssetKey, theme.frameCount, 1, theme.eliteFramePrefix);
      }
      if (this.textures.exists(theme.bossAssetKey)) {
        this.validateWorldEnemySheet(theme.bossAssetKey, theme.bossCellSize, theme.frameCount, worldKey, 'boss');
        this.registerSheetFrames(theme.bossAssetKey, theme.frameCount, 1, theme.bossFramePrefix);
      }
    });
  }

  validateWorldEnemySheet(textureKey: string, cellSize: number, frameCount: number, worldKey: string, kind: 'elite' | 'boss') {
    const texture = this.textures.get(textureKey);
    const image = texture.getSourceImage();
    const expectedWidth = cellSize * frameCount;
    const expectedHeight = cellSize;
    if (image.width !== expectedWidth || image.height !== expectedHeight) {
      console.warn(
        `Unexpected ${kind} sheet geometry for ${worldKey}: expected ${expectedWidth}x${expectedHeight}, received ${image.width}x${image.height}.`,
      );
    }
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
    this.repairModeOutline = null;
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
    this.levelDebugLayer = null;
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
    this.upgradePauseContext = 'roundClear';
    this.pausedRoundTimers = [];
    this.parallaxSprites = [];
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
    this.updateCinematicParallax();
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

  createGeneratedTextures() {
    createGeneratedTextures(this);
  }

  getIsoMetrics() {
    return _getIsoMetrics(this.generatedLevelActive, this.generatedLevel);
  }

  scaleGeneratedSize(size) {
    return _scaleGeneratedSize(size, this.generatedLevelActive, this.generatedLevel);
  }

  getFootprintScreenBounds(footprintCells: GridPoint[]): ScreenFootprintBounds {
    return _getFootprintScreenBounds(footprintCells, this.generatedLevelActive, this.generatedLevel);
  }

  getGeneratedFootprintSpriteLayout(
    placement: LevelPlacement,
    render: AssetRenderMetadata,
    fallbackFrameSize: [number, number],
  ) {
    const footprintCells = placement.cells?.length
      ? placement.cells
      : this.getFootprintCells(placement.iso.x, placement.iso.y, placement.footprint);
    const footprintBounds = this.getFootprintScreenBounds(footprintCells);
    const textureFrame = render.textureKey
      ? this.textures.getFrame(render.textureKey, render.frameKey)
      : null;
    const frameWidth = textureFrame?.width ?? fallbackFrameSize[0];
    const frameHeight = textureFrame?.height ?? fallbackFrameSize[1];
    const floorFrameWidth = Math.max(1, render.floorFrameWidth ?? frameWidth);
    const displayScale = footprintBounds.width / floorFrameWidth;
    const bottomPadding = render.floorFrameBottomPadding ?? 0;

    return {
      x: footprintBounds.bottomCenterX,
      y: footprintBounds.bottomCenterY + bottomPadding * displayScale,
      depth: footprintBounds.bottomCenterY,
      size: [frameWidth * displayScale, frameHeight * displayScale] as [number, number],
      bounds: footprintBounds,
    };
  }

  isoToScreen(x, y, z = 0) {
    return _isoToScreen(x, y, z, this.generatedLevelActive, this.generatedLevel);
  }

  isoToGroundedEntityScreen(x, y, z = 18) {
    return _isoToGroundedEntityScreen(x, y, z, this.generatedLevelActive, this.generatedLevel);
  }

  screenToIso(x, y) {
    return _screenToIso(x, y, this.generatedLevelActive, this.generatedLevel);
  }

  clampIso(point, padding = 0.5) {
    return _clampIso(point, padding, this.generatedLevelActive, this.generatedLevel);
  }

  isGeneratedIsoWalkable(iso) {
    return _isGeneratedIsoWalkable(iso, this.generatedLevelActive, this.generatedLevel);
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

  resolveRequestedHeroChoice() {
    const raw = new URLSearchParams(window.location.search).get('hero');
    if (raw === 'princess') {
      return 'princess' as HeroChoice;
    }
    if (raw === 'male') {
      return 'male' as HeroChoice;
    }
    return 'male';
  }

  getHeroProfile(choice = this.heroChoice) {
    const wantsPrincess = choice === 'princess' && this.textures.exists('princessHeroSheet');
    const resolvedChoice = wantsPrincess ? 'princess' : 'male';
    return {
      choice: resolvedChoice as HeroChoice,
      label: resolvedChoice === 'princess' ? 'Princess Hero' : 'Village Hero',
      sheetKey: resolvedChoice === 'princess' ? 'princessHeroSheet' : 'heroSheet',
      framePrefix: resolvedChoice === 'princess' ? 'princess' : 'hero',
      animPrefix: resolvedChoice === 'princess' ? 'princess-hero' : 'male-hero',
      displaySize: [76, 76] as [number, number],
      origin: [0.5, 0.76] as [number, number],
    };
  }

  getHeroAnimationKey(action, choice = this.heroChoice) {
    return `${this.getHeroProfile(choice).animPrefix}-${action}`;
  }

  ensureHeroAnimations(profile) {
    const idleKey = `${profile.animPrefix}-idle`;
    if (!this.anims.exists(idleKey)) {
      this.anims.create({
        key: idleKey,
        frames: [0, 1, 2, 3].map((col) => ({ key: profile.sheetKey, frame: `${profile.framePrefix}-0-${col}` })),
        frameRate: 3,
        repeat: -1,
      });
    }
    const walkKey = `${profile.animPrefix}-walk`;
    if (!this.anims.exists(walkKey)) {
      this.anims.create({
        key: walkKey,
        frames: Array.from({ length: 8 }, (_, col) => ({ key: profile.sheetKey, frame: `${profile.framePrefix}-1-${col}` })),
        frameRate: 9,
        repeat: -1,
      });
    }
    const meleeKey = `${profile.animPrefix}-melee`;
    if (!this.anims.exists(meleeKey)) {
      this.anims.create({
        key: meleeKey,
        frames: Array.from({ length: 8 }, (_, col) => ({ key: profile.sheetKey, frame: `${profile.framePrefix}-2-${col}` })),
        frameRate: 16,
        repeat: 0,
      });
    }
    const specialKey = `${profile.animPrefix}-special`;
    if (!this.anims.exists(specialKey)) {
      this.anims.create({
        key: specialKey,
        frames: Array.from({ length: 8 }, (_, col) => ({ key: profile.sheetKey, frame: `${profile.framePrefix}-3-${col}` })),
        frameRate: 12,
        repeat: 0,
      });
    }
  }

  applyHeroChoice(choice, options: { announce?: boolean; restartIdle?: boolean } = {}) {
    const { announce = false, restartIdle = true } = options;
    const profile = this.getHeroProfile(choice);
    this.heroChoice = profile.choice;
    this.heroAnimPrefix = profile.animPrefix;
    this.ensureHeroAnimations(profile);
    if (this.player?.sprite) {
      this.player.sheetKey = profile.sheetKey;
      this.player.framePrefix = profile.framePrefix;
      this.player.animPrefix = profile.animPrefix;
      this.player.sprite
        .setTexture(profile.sheetKey, `${profile.framePrefix}-0-0`)
        .setOrigin(profile.origin[0], profile.origin[1])
        .setDisplaySize(profile.displaySize[0], profile.displaySize[1]);
      if (restartIdle || !this.player.sprite.anims.currentAnim) {
        this.player.sprite.play(`${profile.animPrefix}-idle`, true);
      }
    }
    if (announce) {
      this.addGuildNote(profile.choice === 'princess' ? 'The princess joins the village watch!' : 'The village hero is ready to patrol!');
    }
    this.updateSplashHeroChoiceUi?.();
    return profile;
  }

  selectHeroChoice(choice) {
    this.pendingHeroChoice = choice;
    this.applyHeroChoice(choice, { announce: false, restartIdle: true });
    this.updateSplashHeroChoiceUi();
  }

  updateSplashHeroChoiceUi() {
    const activeChoice = this.pendingHeroChoice ?? null;
    ['male', 'princess'].forEach((choice) => {
      const card = this.splashHeroCards?.[choice];
      if (!card) {
        return;
      }
      const selected = activeChoice === choice;
      card.hit.setFillStyle(
        SPLASH_HERO_CARD_FILL_COLOR,
        selected ? SPLASH_HERO_CARD_SELECTED_FILL_ALPHA : SPLASH_HERO_CARD_IDLE_FILL_ALPHA,
      );
      card.selection?.setStrokeStyle(
        SPLASH_HERO_CARD_SELECTION_STROKE_WIDTH,
        selected ? SPLASH_HERO_CARD_SELECTED_STROKE_COLOR : SPLASH_HERO_CARD_IDLE_STROKE_COLOR,
        selected ? SPLASH_HERO_CARD_SELECTED_STROKE_ALPHA : SPLASH_HERO_CARD_IDLE_STROKE_ALPHA,
      );
      if (selected) {
        card.frame.setTint(0xffffff);
      } else {
        card.frame.clearTint();
      }
      card.label.setColor(selected ? SPLASH_HERO_CARD_SELECTED_LABEL_COLOR : SPLASH_HERO_CARD_IDLE_LABEL_COLOR);
      card.badge?.setVisible(selected);
    });
    const ready = Boolean(activeChoice);
    if (this.splashStartButton) {
      if (!this.splashStartButton.input) {
        this.splashStartButton.setInteractive({ useHandCursor: true });
      }
      this.splashStartButton.setFillStyle(
        SPLASH_HERO_CARD_FILL_COLOR,
        ready ? SPLASH_START_BUTTON_READY_FILL_ALPHA : SPLASH_START_BUTTON_DISABLED_FILL_ALPHA,
      );
    }
    if (this.splashStartText) {
      this.splashStartText.setAlpha(ready ? 1 : SPLASH_START_BUTTON_DISABLED_TEXT_ALPHA);
    }
    if (this.splashHeroChoiceText) {
      this.splashHeroChoiceText.setText(
        activeChoice
          ? `Chosen hero: ${activeChoice === 'princess' ? 'Princess' : 'Village Adventurer'}`
          : 'Choose your hero before you begin.',
      );
    }
  }

  restartGameFromBeginning() {
    this.scene.restart({ forceFreshStart: true });
  }

  updateCinematicParallax() {
    if (!this.parallaxSprites?.length || !this.player || !this.generatedLevel) {
      return;
    }
    const { minX, minY, maxX, maxY } = this.generatedLevel.playableBounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const spanX = Math.max(1, (maxX - minX) / 2);
    const spanY = Math.max(1, (maxY - minY) / 2);
    const nx = Phaser.Math.Clamp((this.player.iso.x - centerX) / spanX, -1, 1);
    const ny = Phaser.Math.Clamp((this.player.iso.y - centerY) / spanY, -1, 1);
    this.parallaxSprites.forEach((entry) => {
      entry.sprite.setPosition(
        entry.baseX - nx * 46 * entry.factor,
        entry.baseY - ny * 30 * entry.factor,
      );
    });
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
        villageSafety: 100,
        equipped: this.state.equipped,
        repairMode: false,
        spell: this.state.spell,
        inventoryOpen: false,
        gameOverReason: '',
        ...nextProgression,
      },
      buildings: [],
      heroChoice: this.heroChoice,
      upgradeLevels: this.upgrades.map((upgrade) => upgrade.level),
      note,
    };
  }

  restartForWorldProgression(nextProgression, note) {
    const snapshot = this.createRunResumeSnapshot(nextProgression, note);
    this.scene.restart({
      resumeRunState: snapshot,
      sceneVariantKey: nextProgression.worldKey,
      resumeSkipSplash: true,
    });
    return `restart:${nextProgression.worldKey}`;
  }

  restoreRunStateFromResume() {
    if (!this.resumeRunState) {
      return;
    }
    if (this.resumeRunState.playerStats) {
      this.playerStats = { ...this.playerStats, ...this.resumeRunState.playerStats };
    }
    if (this.resumeRunState.heroChoice) {
      this.heroChoice = this.resumeRunState.heroChoice;
    }
    if (this.resumeRunState.state) {
      this.state = { ...this.state, ...this.resumeRunState.state, phase: 'countdown', inventoryOpen: false, repairMode: false };
    }
    if (this.resumeRunState.upgradeLevels?.length) {
      this.resumeRunState.upgradeLevels.forEach((level, index) => {
        if (this.upgrades[index]) {
          this.upgrades[index].level = level;
        }
      });
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

  registerParallaxSprite(sprite, factor, baseX, baseY) {
    if (!sprite) {
      return;
    }
    this.parallaxSprites.push({ sprite, factor, baseX, baseY });
  }

  hasStaticSceneVariantFrame(config) {
    return Boolean(config)
      && this.textures.exists(config.backgroundAssetKey)
      && this.textures.exists(config.exteriorFrameAssetKey);
  }

  renderSceneVariantBackground(config, bounds) {
    const baseScale = Math.max(WIDTH / 2048, HEIGHT / 1152);
    const sprite = this.addSceneVariantImage(
      this.backgroundLayer,
      config.backgroundAssetKey,
      bounds.centerX,
      bounds.centerY - 24,
      baseScale * 1.04 * (config.worldZoom ?? 1),
      2,
      { alpha: 1 },
    );
    this.registerParallaxSprite(sprite, config.backgroundParallax ?? 0, bounds.centerX, bounds.centerY - 24);
  }

  renderSceneVariantFrame(config, bounds) {
    const baseScale = Math.max(WIDTH / 2048, HEIGHT / 1152);
    const sprite = this.addSceneVariantImage(
      this.edgeLayer,
      config.exteriorFrameAssetKey,
      bounds.centerX,
      bounds.centerY - 20,
      baseScale * 1.04 * (config.worldZoom ?? 1),
      70,
      { alpha: 1 },
    );
    this.registerParallaxSprite(sprite, config.frameParallax ?? 0, bounds.centerX, bounds.centerY - 20);
  }

  renderSceneVariantForeground(config, bounds) {
    if (!config.foregroundFogAssetKey) {
      return;
    }
    const baseScale = Math.max(WIDTH / 2048, HEIGHT / 1152);
    const sprite = this.addSceneVariantImage(
      this.lightingLayer,
      config.foregroundFogAssetKey,
      bounds.centerX,
      bounds.centerY - 20,
      baseScale * 1.04 * (config.worldZoom ?? 1),
      4705,
      { alpha: config.key === 'night_spring' ? 0.9 : 0.72 },
    );
    this.registerParallaxSprite(sprite, config.foregroundParallax ?? 0, bounds.centerX, bounds.centerY - 20);
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
    const worldCycle = Number(this.resumeRunState?.state?.worldCycle ?? this.state.worldCycle ?? 0);
    selection.config.playableBounds = this.sceneVariant.playableBounds;
    const boardConfig = buildSeasonBoardConfig(selection.config, this.sceneVariant.key as SeasonPreset, worldCycle);
    boardConfig.playableBounds = this.sceneVariant.playableBounds;
    this.generatedLevel = generateLevel(boardConfig, ASSET_REGISTRY);
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
    GENERATED_SURROUND_PIECES.forEach((piece) => {
      const anchor = this.getGeneratedSurroundAnchorPoint(bounds, tileW, tileH, piece.anchor);
      const depth = typeof piece.depth === 'number'
        ? piece.depth
        : (piece.depth.edge === 'top' ? bounds.top.y : bounds.bottom.y) + tileH * piece.depth.tileOffset;
      this.addEnvironmentUniformSprite(
        this.getGeneratedSurroundLayer(piece.layer),
        piece.frame,
        anchor.x + piece.offsetXUnits * tileW,
        anchor.y + piece.offsetYUnits * tileH,
        piece.uniformScale,
        depth,
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
    getWorldFogPieces(bounds, tileW, tileH).forEach((piece) => {
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
    getWorldBackdropPieces(bounds, tileW, tileH).forEach((piece) => {
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
    getWorldEdgeClusters(bounds, tileW, tileH).forEach((cluster) => {
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
    const textureKey = render.textureKey ?? 'cottageTexture';
    const layout = this.getGeneratedFootprintSpriteLayout(
      placement,
      { ...render, textureKey },
      [80, 70],
    );
    const size = layout.size;
    const sprite = this.add.image(layout.x, layout.y, textureKey, render.frameKey)
      .setOrigin(0.5, 1)
      .setDisplaySize(size[0], size[1])
      .setDepth(layout.depth)
      .setAlpha(GENERATED_BUILDING_SPRITE_ALPHA);
    const healthBar = this.createBuildingHealthBar(
      layout.x,
      layout.y - size[1] * 0.78,
      Math.max(42, Math.min(76, size[0] * 0.7)),
      10,
      layout.depth + 140,
    );
    this.entityLayer.add([sprite, healthBar.container]);
    const building = {
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
      footprint: placement.footprint,
      footprintCells: placement.cells.map((cell) => ({ ...cell })),
      spriteAlpha: GENERATED_BUILDING_SPRITE_ALPHA,
      sprite,
      healthBar,
      underAttackUntil: 0,
    };
    this.buildings.push(building);
    this.updateBuildingHealthBar(building);
  }

  renderGeneratedProp(placement) {
    if (this.generatedLevelActive && this.generatedLevel && placement.token === 'tree' && this.isGeneratedBoardEdgeCell(placement.grid)) {
      return;
    }
    const render = placement.render ?? {};
    const override = this.getSceneVariantPropTexture(placement);
    const textureKey = override?.textureKey ?? render?.textureKey;
    const frameKey = override?.frameKey ?? render?.frameKey;
    if (!textureKey) {
      return;
    }
    const layout = textureKey === 'buildingsAtlas'
      ? this.getGeneratedFootprintSpriteLayout(placement, { ...render, textureKey, frameKey }, [42, 42])
      : null;
    const p = layout ?? this.isoToScreen(placement.iso.x, placement.iso.y, render.z ?? 7);
    const size = layout?.size ?? this.scaleGeneratedSize(render.displaySize ?? [42, 42]);
    const sprite = this.add.image(p.x, p.y, textureKey, frameKey)
      .setOrigin(layout ? 0.5 : render.origin?.[0] ?? 0.5, layout ? 1 : render.origin?.[1] ?? 0.82)
      .setDisplaySize(size[0], size[1])
      .setDepth((layout?.depth ?? p.y) + 8)
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
    return getActiveTimeOfDay(this);
  }

  cycleTimeOfDay() {
    cycleTimeOfDay(this);
  }

  getLampGlowIsoPoints() {
    return getLampGlowIsoPoints(this);
  }

  createTimeOfDayLayer() {
    createTimeOfDayLayer(this);
  }

  drawGeneratedLevelDebug() {
    drawGeneratedLevelDebug(this);
  }

  toggleGeneratedLevelDebug() {
    toggleGeneratedLevelDebug(this);
  }

  updateGeneratedLevelDebug(time) {
    updateGeneratedLevelDebug(this, time);
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
      { name: 'Castle', x: 7, y: 4, hp: 110, max: 110, importance: 100, texture: 'castleTexture', size: [112, 96], reward: 24, footprint: { w: 3, h: 3 } },
      { name: 'Bakery', x: 4, y: 7, hp: 76, max: 76, importance: 50, texture: 'bakeryTexture', size: [80, 70], reward: 16, footprint: { w: 3, h: 2 } },
      { name: 'Cottage', x: 10, y: 7, hp: 74, max: 74, importance: 50, texture: 'cottageTexture', size: [78, 68], reward: 15, footprint: { w: 3, h: 2 } },
      { name: 'Market', x: 7, y: 10, hp: 68, max: 68, importance: 70, texture: 'marketTexture', size: [90, 66], reward: 18, footprint: { w: 3, h: 2 } },
    ];
    this.buildings = buildingData.map((data) => {
      const p = this.isoToScreen(data.x, data.y, 18);
      const base = this.add.graphics();
      base.fillStyle(0x8f7346, STATIC_BUILDING_BASE_ALPHA);
      base.fillEllipse(p.x, p.y + 22, data.size[0] * 0.62, 28);
      const sprite = this.add.image(p.x, p.y, data.texture)
        .setOrigin(0.5, 0.84)
        .setDisplaySize(data.size[0], data.size[1])
        .setDepth(p.y)
        .setAlpha(STATIC_BUILDING_SPRITE_ALPHA);
      const healthBar = this.createBuildingHealthBar(
        p.x,
        p.y - data.size[1] * 0.78,
        Math.max(42, Math.min(76, data.size[0] * 0.7)),
        10,
        p.y + 140,
      );
      const footprintCells = this.getFootprintCells(data.x, data.y, data.footprint);
      this.entityLayer.add([base, sprite, healthBar.container]);
      const building = {
        ...data,
        iso: { x: data.x, y: data.y },
        footprintCells,
        baseAlpha: STATIC_BUILDING_BASE_ALPHA,
        spriteAlpha: STATIC_BUILDING_SPRITE_ALPHA,
        sprite,
        base,
        healthBar,
        underAttackUntil: 0,
      };
      this.updateBuildingHealthBar(building);
      return building;
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
    const start = this.isoToGroundedEntityScreen(playerSpawn.x, playerSpawn.y);
    const profile = this.getHeroProfile(this.heroChoice);
    this.ensureHeroAnimations(profile);
    this.player = {
      iso: { x: playerSpawn.x, y: playerSpawn.y },
      facing: { x: 0, y: 1 },
      lastAttack: 0,
      lastBow: 0,
      lastSpell: 0,
      invulnerableUntil: 0,
      actionLockUntil: 0,
      sheetKey: profile.sheetKey,
      framePrefix: profile.framePrefix,
      animPrefix: profile.animPrefix,
      shadow: this.add.ellipse(start.x, start.y + 13, 44, 18, 0x325631, 0.24),
      sprite: this.add.sprite(start.x, start.y, profile.sheetKey, `${profile.framePrefix}-0-0`)
        .setOrigin(profile.origin[0], profile.origin[1])
        .setDisplaySize(profile.displaySize[0], profile.displaySize[1])
        .setDepth(start.y + 40),
    };
    this.player.sprite.play(`${profile.animPrefix}-idle`);
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
      if (this.state.phase === 'gameOver') {this.restartGameFromBeginning();}
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
    return isDebugAutomationEnabled();
  }

  getDebugAutomationHost() {
    return getDebugAutomationHost();
  }

  toDebugSlug(value) {
    return toDebugSlug(value);
  }

  getDebugBuildingSummary() {
    return getDebugBuildingSummary(this);
  }

  setDebugCommandResult(command, result) {
    setDebugCommandResult(command, result);
  }

  findDebugBuilding(query) {
    return findDebugBuilding(this, query);
  }

  teleportPlayerToDebugTarget(query) {
    return teleportPlayerToDebugTarget(this, query);
  }

  triggerDebugSeasonTransition() {
    return triggerDebugSeasonTransition(this);
  }

  syncDevDiagnostics() {
    syncDevDiagnostics(this);
  }

  consumeDevCommand() {
    consumeDevCommand(this);
  }

  createTouchControls() {
    this.touchControlsEnabled = this.isTouchDevice();
    if (!this.touchControlsEnabled) {
      this.debugTouchControls('touch controls skipped');
      return;
    }

    this.controlsHint?.setVisible(false);
    const container = this.add.container(0, 0).setDepth(7700).setScrollFactor(0);
    const joystickCenter = {
      x: scaleTouchControl(132),
      y: HEIGHT - scaleTouchControl(118),
    };
    const joystickZoneSize = scaleTouchControl(190);
    const joystickBaseRadius = scaleTouchControl(58);
    const joystickThumbRadius = scaleTouchControl(25);
    const joystickZone = this.add.zone(joystickCenter.x, joystickCenter.y, joystickZoneSize, joystickZoneSize)
      .setOrigin(0.5)
      .setInteractive();
    const joystickBase = this.add.circle(joystickCenter.x, joystickCenter.y, joystickBaseRadius, 0x132a3d, 0.34)
      .setStrokeStyle(scaleTouchControl(4), 0xf8ffe3, 0.42);
    const joystickThumb = this.add.circle(joystickCenter.x, joystickCenter.y, joystickThumbRadius, 0xfff4c8, 0.74)
      .setStrokeStyle(scaleTouchControl(3), 0x6abbd7, 0.78);
    const buttons = {} as Partial<Record<TouchActionKey, Phaser.GameObjects.Container>>;
    const actionCenterX = WIDTH - scaleTouchControl(150);
    const actionCenterY = HEIGHT - scaleTouchControl(118);
    const actionRadiusX = scaleTouchControl(86);
    const actionRadiusY = scaleTouchControl(54);
    const normalLayout: Record<TouchButtonSlot, [TouchActionKey, string, TouchActionIcon, number]> = {
      left: ['melee', 'Sword', { texture: 'touchControlsAtlas', frame: 'touch_sword_01' }, 0xf2bf52],
      top: ['bow', 'Bow', { texture: 'touchControlsAtlas', frame: 'touch_bow_01' }, 0x8fd56c],
      right: ['spell', 'Spell', { texture: 'touchControlsAtlas', frame: 'touch_spell_01' }, 0x75d8ff],
      bottom: ['repair', 'Repair', { texture: 'touchControlsAtlas', frame: 'touch_repair_01' }, 0x9fe9bf],
    };
    const slotPositions: Record<TouchButtonSlot, { x: number; y: number }> = {
      left: { x: actionCenterX - actionRadiusX, y: actionCenterY },
      top: { x: actionCenterX, y: actionCenterY - actionRadiusY },
      right: { x: actionCenterX + actionRadiusX, y: actionCenterY },
      bottom: { x: actionCenterX, y: actionCenterY + actionRadiusY },
    };
    Object.entries(normalLayout).forEach(([slot, [action, label, icon, color]]) => {
      const point = slotPositions[slot as TouchButtonSlot];
      buttons[action] = this.createTouchActionButton(action, point.x, point.y, label, icon, color);
    });
    const repairLayout: Array<[TouchActionKey, TouchButtonSlot, string, TouchActionIcon, number]> = [
      ['repairConfirm', 'left', '', { texture: 'touchControlsAtlas', frame: 'touch_repair_01' }, 0x9fe9bf],
      ['repairCancel', 'right', '', { texture: 'repairModeCancelIcon' }, 0xff9ca0],
    ];
    const repairButtons = repairLayout.map(([action, slot, label, icon, color]) => {
      const point = slotPositions[slot];
      return this.createTouchActionButton(action, point.x, point.y, label, icon, color).setVisible(false);
    });

    const portraitOverlay = this.createPortraitOverlay();
    container.add([joystickZone, joystickBase, joystickThumb, ...Object.values(buttons), ...repairButtons]);
    this.touchLayer.add([container, portraitOverlay]);
    this.touchControls = {
      container,
      joystickBase,
      joystickThumb,
      joystickVector: { x: 0, y: 0 },
      joystickPointerId: null,
      joystickCenter,
      buttons,
      repairButtons,
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
    const hit = this.add.zone(0, 0, scaleTouchControl(78), scaleTouchControl(82))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const labelText = label ? this.add.text(0, scaleTouchControl(34), label, {
      ...this.uiTextStyle(scaleTouchControl(10), '#ffffff'),
      strokeThickness: scaleTouchControl(3),
    }).setOrigin(0.5) : null;
    const glyph = icon
      ? this.add.image(0, -scaleTouchControl(3), icon.texture, icon.frame).setDisplaySize(scaleTouchControl(70), scaleTouchControl(70))
      : this.add.text(0, -scaleTouchControl(5), 'I', {
        ...this.uiTextStyle(scaleTouchControl(24), '#fff0b8'),
        strokeThickness: scaleTouchControl(4),
      }).setOrigin(0.5);
    const focusRing = this.add.circle(0, -scaleTouchControl(3), scaleTouchControl(34), 0xffffff, 0)
      .setStrokeStyle(scaleTouchControl(2), color, 0.28);
    hit.on('pointerdown', () => {
      this.ensureAudio();
      this.pulseTouchButton(button);
      this.handleTouchAction(action);
    });
    button.add(labelText ? [hit, focusRing, glyph, labelText] : [hit, focusRing, glyph]);
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
    const radius = scaleTouchControl(58);
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
    const repairModeActive = this.state.repairMode && this.state.phase === 'playing';
    ['melee', 'bow', 'spell', 'repair'].forEach((action) => {
      this.touchControls?.buttons[action]?.setVisible(!repairModeActive);
    });
    this.touchControls.repairButtons?.forEach((button) => button.setVisible(repairModeActive));
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
    } else if (action === 'repairConfirm') {
      this.tryRepairBuilding();
    } else if (action === 'repairCancel') {
      this.setRepairMode(false, false);
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

  ensureAudio() {
    ensureAudio(this.audio, this);
  }

  playTone(type = 'sparkle') {
    playTone(this.audio, type);
  }

  playAudioNote(note, baseTime, destination) {
    playAudioNote(this.audio, note, baseTime, destination);
  }

  setMusicSoftened(softened) {
    setMusicSoftened(this.audio, softened);
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
      const fullStep = {
        x: this.player.iso.x + dx * this.playerStats.speed * dt,
        y: this.player.iso.y + dy * this.playerStats.speed * dt,
      };
      this.clampIso(fullStep, 1.2);
      if (this.isGeneratedIsoWalkable(fullStep)) {
        this.player.iso.x = fullStep.x;
        this.player.iso.y = fullStep.y;
      } else {
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

    const p = this.isoToGroundedEntityScreen(this.player.iso.x, this.player.iso.y);
    this.player.sprite.setPosition(p.x, p.y);
    this.player.shadow.setPosition(p.x, p.y + 15);
    this.player.sprite.setFlipX(this.player.facing.x < -0.05);

    if (time > this.player.actionLockUntil) {
      const desiredAnim = moving
        ? `${this.player.animPrefix}-walk`
        : `${this.player.animPrefix}-idle`;
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
    this.player.sprite.play(`${this.player.animPrefix}-melee`, true);
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
    this.player.sprite.play(`${this.player.animPrefix}-special`, true);
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
    const evolvedBow = Boolean(this.playerStats.bowEvolved);
    const arrow = this.add.container(p.x, p.y - 24).setDepth(p.y + 120);
    const shaft = this.add.rectangle(0, 0, evolvedBow ? 38 : 32, evolvedBow ? 6 : 5, evolvedBow ? 0xfff0a4 : 0xffe6a3, 1)
      .setStrokeStyle(1, evolvedBow ? 0x4ca6c9 : 0x9d6d3f, 1);
    const tip = this.add.triangle(evolvedBow ? 21 : 18, 0, 0, -6, 0, 6, 10, 0, evolvedBow ? 0xffdf75 : 0x82d5ff, 1);
    arrow.add([shaft, tip]);
    const screenDir = this.isoToScreen(startIso.x + vx, startIso.y + vy, 18);
    arrow.rotation = Phaser.Math.Angle.Between(p.x, p.y, screenDir.x, screenDir.y);
    this.projectiles.push({
      type: 'arrow',
      iso: { x: startIso.x + vx * 0.45, y: startIso.y + vy * 0.45 },
      velocity: { x: vx * (evolvedBow ? 9.2 : 8.2), y: vy * (evolvedBow ? 9.2 : 8.2) },
      power: this.playerStats.bowPower,
      range: 6.8 + this.state.level * 0.35 + (evolvedBow ? 1.2 : 0),
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
    this.player.sprite.play(`${this.player.animPrefix}-special`, true);
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
    this.upgrades = UPGRADE_DEFS.map((def) => ({
      ...def,
      apply: () => def.apply(this),
    }));
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
    // Chests now drop from enemies instead of being pre-placed on the board.
  }

  spawnChest(
    x,
    y,
    reward = 'bonus-upgrade',
    options: { source?: 'enemyDrop'; lifetimeMs?: number } = {},
  ) {
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
    const lifetimeMs = options.lifetimeMs ?? 5000;
    const spawnedAt = this.time.now;
    this.chests.push({
      iso: { x, y },
      sprite,
      glow,
      reward,
      opened: false,
      bob: Math.random() * 1000,
      source: 'enemyDrop',
      spawnedAt,
      despawnAt: spawnedAt + lifetimeMs,
      blinkAt: spawnedAt + Math.max(2500, lifetimeMs - 1800),
    } satisfies DroppedChest);
  }

  updateChests(time) {
    (this.chests as DroppedChest[]).slice().forEach((chest) => {
      if (chest.opened) {return;}
      if (chest.despawnAt && time >= chest.despawnAt) {
        chest.opened = true;
        this.tweens.add({
          targets: [chest.sprite, chest.glow],
          alpha: 0,
          scale: 0.55,
          duration: 180,
          onComplete: () => {
            chest.sprite.destroy();
            chest.glow.destroy();
          },
        });
        this.chests = this.chests.filter((candidate) => candidate !== chest);
        this.checkLevelClear();
        return;
      }
      const p = this.isoToScreen(chest.iso.x, chest.iso.y, 10 + Math.sin(time / 450 + chest.bob) * 2.5);
      chest.sprite.setPosition(p.x, p.y);
      chest.glow.setPosition(p.x, p.y - 20);
      if (chest.blinkAt && time >= chest.blinkAt) {
        const pulse = 0.45 + Math.abs(Math.sin(time / 65)) * 0.55;
        chest.sprite.setAlpha(pulse);
        chest.glow.setAlpha(0.12 + pulse * 0.24);
      } else {
        chest.sprite.setAlpha(1);
        chest.glow.setAlpha(0.18);
      }
      if (Phaser.Math.Distance.Between(chest.iso.x, chest.iso.y, this.player.iso.x, this.player.iso.y) < 0.95) {
        this.openChest(chest);
      }
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
    this.openChest(chest);
  }

  openChest(chest: DroppedChest) {
    if (!chest || chest.opened) {
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
    this.chests = this.chests.filter((candidate) => candidate !== chest);
    if (chest.reward === 'bonus-upgrade') {
      this.pauseRoundForChestBonus();
      return;
    }
    this.grantChestReward(chest.reward);
  }

  pauseRoundForChestBonus() {
    if (this.state.phase !== 'playing') {
      return;
    }
    this.upgradePauseContext = 'chestBonus' as UpgradePauseContext;
    this.state.phase = 'levelUp';
    this.state.inventoryOpen = false;
    this.setRepairMode(false, false);
    this.inventoryPanel?.setVisible(false);
    this.levelTimers.forEach((timer) => { timer.paused = true; });
    this.showLevelUpScreen('chestBonus');
  }

  resumeRoundAfterChestBonus() {
    this.upgradePauseContext = 'roundClear' as UpgradePauseContext;
    this.levelTimers.forEach((timer) => {
      if (timer && !timer.hasDispatched) {
        timer.paused = false;
      }
    });
    this.state.phase = 'playing';
    this.levelUpOverlay?.setVisible(false);
    this.addGuildNote('The chest blessing settles in. Back to the defense!');
    this.checkLevelClear();
  }

  toggleRepairMode() {
    if (this.state.phase !== 'playing') {return;}
    this.ensureAudio();
    this.setRepairMode(!this.state.repairMode);
  }

  getFootprintCells(x, y, footprint = { w: 1, h: 1 }) {
    const offsetX = Math.floor((footprint?.w ?? 1) / 2);
    const offsetY = Math.floor((footprint?.h ?? 1) / 2);
    return Array.from({ length: footprint?.h ?? 1 }, (_, row) => (
      Array.from({ length: footprint?.w ?? 1 }, (__, col) => ({
        x: x + col - offsetX,
        y: y + row - offsetY,
      }))
    )).flat();
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
      this.clearRepairModeOutline();
    }
  }

  showRepairModeIndicator() {
    this.updateRepairModeIndicator(this.time.now);
  }

  hideRepairModeIndicator() {
    if (this.repairModeIndicator) {
      this.repairModeIndicator.destroy();
      this.repairModeIndicator = null;
    }
    this.clearRepairModeOutline();
  }

  updateRepairModeIndicator(time) {
    void time;
    if (!this.state.repairMode || this.state.phase !== 'playing') {
      this.hideRepairModeIndicator();
      return;
    }
    this.updateRepairModeOutline();
  }

  pulseRepairModeIndicator() {
    this.updateRepairModeOutline();
  }

  getBuildingFootprintCells(building) {
    return building.footprintCells ?? this.getFootprintCells(building.iso.x, building.iso.y, building.footprint);
  }

  getRepairDistanceToBuilding(building) {
    if (!this.player) {
      return Infinity;
    }
    const footprintCells = this.getBuildingFootprintCells(building);
    return footprintCells.reduce((bestDistance, cell) => (
      Math.min(
        bestDistance,
        Phaser.Math.Distance.Between(
          cell.x + 0.5,
          cell.y + 0.5,
          this.player.iso.x,
          this.player.iso.y,
        ),
      )
    ), Phaser.Math.Distance.Between(
      building.iso.x,
      building.iso.y,
      this.player.iso.x,
      this.player.iso.y,
    ));
  }

  getNearestDamagedBuilding(range = REPAIR_RANGE) {
    let nearest = null;
    let nearestDistance = Infinity;
    this.buildings.forEach((building) => {
      if (building.hp >= building.max) {return;}
      if (building.name === 'Castle' && building.hp <= 0) {return;}
      const distance = this.getRepairDistanceToBuilding(building);
      if (distance <= range && distance < nearestDistance) {
        nearest = building;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  getRepairModeTarget(range = REPAIR_RANGE) {
    let nearestDamaged = null;
    let nearestPerfect = null;
    this.buildings.forEach((building) => {
      if (building.name === 'Castle' && building.hp <= 0) {return;}
      const distance = this.getRepairDistanceToBuilding(building);
      if (distance > range) {return;}
      if (building.hp < building.max) {
        if (!nearestDamaged || distance < nearestDamaged.distance) {
          nearestDamaged = { building, distance };
        }
        return;
      }
      if (!nearestPerfect || distance < nearestPerfect.distance) {
        nearestPerfect = { building, distance };
      }
    });
    return nearestDamaged?.building ?? nearestPerfect?.building ?? null;
  }

  getRepairModeTargetState(building): RepairModeTargetState {
    if (building.hp >= building.max) {
      return 'perfect';
    }
    return this.state.gold >= REPAIR_COST ? 'repairable' : 'unaffordable';
  }

  clearRepairModeOutline() {
    if (!this.repairModeOutline) {
      return;
    }
    this.repairModeOutline.clear();
    this.repairModeOutline.setVisible(false);
  }

  drawRepairModeFootprintFill(graphics, footprintCells, color, halfW, halfH) {
    graphics.fillStyle(color, REPAIR_OUTLINE_FILL_ALPHA);
    footprintCells.forEach((cell) => {
      const center = this.isoToScreen(cell.x, cell.y);
      graphics.beginPath();
      graphics.moveTo(center.x, center.y - halfH);
      graphics.lineTo(center.x + halfW, center.y);
      graphics.lineTo(center.x, center.y + halfH);
      graphics.lineTo(center.x - halfW, center.y);
      graphics.closePath();
      graphics.fillPath();
    });
  }

  drawRepairModeFootprintEdges(graphics, footprintCells, halfW, halfH) {
    const cellKeys = new Set(footprintCells.map((cell) => `${cell.x},${cell.y}`));
    footprintCells.forEach((cell) => {
      const center = this.isoToScreen(cell.x, cell.y);
      const top = { x: center.x, y: center.y - halfH };
      const right = { x: center.x + halfW, y: center.y };
      const bottom = { x: center.x, y: center.y + halfH };
      const left = { x: center.x - halfW, y: center.y };
      const edges = [
        { neighbor: `${cell.x},${cell.y - 1}`, from: top, to: right },
        { neighbor: `${cell.x + 1},${cell.y}`, from: right, to: bottom },
        { neighbor: `${cell.x},${cell.y + 1}`, from: bottom, to: left },
        { neighbor: `${cell.x - 1},${cell.y}`, from: left, to: top },
      ];
      edges.forEach((edge) => {
        if (cellKeys.has(edge.neighbor)) {return;}
        graphics.beginPath();
        graphics.moveTo(edge.from.x, edge.from.y);
        graphics.lineTo(edge.to.x, edge.to.y);
        graphics.strokePath();
      });
    });
  }

  drawRepairModeFootprintOutline(graphics, building, color) {
    const { tileW, tileH } = this.getIsoMetrics();
    const halfW = tileW / 2;
    const halfH = tileH / 2;
    const footprintCells = this.getBuildingFootprintCells(building);
    this.drawRepairModeFootprintFill(graphics, footprintCells, color, halfW, halfH);
    graphics.lineStyle(REPAIR_OUTLINE_BACKING_WIDTH, REPAIR_OUTLINE_BACKING_COLOR, 0.82);
    this.drawRepairModeFootprintEdges(graphics, footprintCells, halfW, halfH);
    graphics.lineStyle(REPAIR_OUTLINE_STROKE_WIDTH, color, 0.98);
    this.drawRepairModeFootprintEdges(graphics, footprintCells, halfW, halfH);
  }

  updateRepairModeOutline() {
    if (!this.state.repairMode || this.state.phase !== 'playing' || !this.player) {
      this.clearRepairModeOutline();
      return;
    }
    const building = this.getRepairModeTarget();
    if (!building) {
      this.clearRepairModeOutline();
      return;
    }
    if (!this.repairModeOutline) {
      this.repairModeOutline = this.add.graphics().setDepth(building.sprite.depth + 22);
      this.effectsLayer.add(this.repairModeOutline);
    }
    const graphics = this.repairModeOutline;
    const targetState = this.getRepairModeTargetState(building);
    const color = REPAIR_OUTLINE_COLORS[targetState];
    graphics.clear();
    graphics.setVisible(true);
    graphics.setDepth(building.sprite.depth + 22);
    this.drawRepairModeFootprintOutline(graphics, building, color);
  }

  tryRepairBuilding() {
    if (this.state.phase !== 'playing') {return;}
    this.ensureAudio();
    if (this.time.now - this.lastRepairAt < REPAIR_COOLDOWN) {return;}
    const building = this.getRepairModeTarget();
    if (!building) {
      this.addGuildNote('No building close enough yet.');
      this.pulseRepairModeIndicator();
      this.playTone('hit');
      return;
    }
    const targetState = this.getRepairModeTargetState(building);
    if (targetState === 'perfect') {
      this.addGuildNote(`${building.name} is already in perfect condition.`);
      this.pulseRepairModeIndicator();
      this.playTone('sparkle');
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
    this.setRepairMode(false, false);
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
    const pendingEnemyDropChests = this.chests.some((chest) => !chest.opened && chest.source === 'enemyDrop');
    if (this.levelSpawnsPending <= 0 && requiredDefeatsMet && hadRealSpawns && !pendingEnemyDropChests) {
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
    this.showLevelUpScreen('roundClear');
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
    const displayScaleX = visual.frameSheetKey === theme.eliteAssetKey ? theme.eliteDisplayScaleX : 1;
    const displayScaleY = visual.frameSheetKey === theme.eliteAssetKey ? theme.eliteDisplayScaleY : 1;
    const shadow = this.add.ellipse(p.x, p.y + 13, size * displayScaleX * 0.42, size * displayScaleY * 0.22, 0x315133, 0.2);
    const frameRow = visual.frameRow ?? archetype.row;
    const framePrefix = visual.framePrefix ?? 'monster';
    const idleFrames = visual.frameSheetKey === theme.eliteAssetKey ? theme.eliteIdleFrames : [0, 1, 2, 3];
    const initialFrame = Phaser.Utils.Array.GetRandom(idleFrames);
    const defeatFrame = visual.frameSheetKey === theme.eliteAssetKey ? theme.eliteDefeatFrame : 7;
    const sprite = this.add.sprite(p.x, p.y, visual.frameSheetKey, `${framePrefix}-${frameRow}-${initialFrame}`)
      .setOrigin(0.5, 0.76)
      .setDisplaySize(size * displayScaleX, size * displayScaleY)
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
    const displayScaleX = theme.bossDisplayScaleX;
    const displayScaleY = theme.bossDisplayScaleY;
    const shadow = this.add.ellipse(p.x, p.y + 14, size * displayScaleX * 0.42, size * displayScaleY * 0.24, 0x243829, 0.24);
    const initialFrame = Phaser.Utils.Array.GetRandom(theme.bossIdleFrames);
    const sprite = this.add.sprite(p.x, p.y, visual.frameSheetKey, `${visual.framePrefix}-${visual.frameRow}-${initialFrame}`)
      .setOrigin(0.5, 0.76)
      .setDisplaySize(size * displayScaleX, size * displayScaleY)
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
      this.maybeSpawnChestDrop(enemy);
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

  maybeSpawnChestDrop(enemy) {
    const baseChance = enemy.isBoss ? 0.78 : enemy.variant?.key === 'elder' ? 0.34 : enemy.variant?.key === 'bright' ? 0.22 : 0.12;
    if (Phaser.Math.FloatBetween(0, 1) >= baseChance) {
      return;
    }
    const chestIso = {
      x: enemy.iso.x + Phaser.Math.FloatBetween(-0.22, 0.22),
      y: enemy.iso.y + Phaser.Math.FloatBetween(-0.22, 0.22),
    };
    this.spawnChest(chestIso.x, chestIso.y, 'bonus-upgrade', { source: 'enemyDrop', lifetimeMs: 5000 });
    this.addGuildNote(enemy.isBoss ? 'A guardian chest lands beside the battle!' : 'A chest tumbles free from the skirmish!');
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

  createBuildingHealthBar(x, y, width = 58, height = 10, depth = 0) {
    const container = this.add.container(x, y).setDepth(depth);
    const shadow = this.add.rectangle(0, 1, width + 4, height + 4, 0x102238, 0.36)
      .setOrigin(0.5);
    const backing = this.add.rectangle(0, 0, width, height, 0x3d2f26, 0.58)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0xfff2c4, 0.75);
    const fill = this.add.rectangle(-width / 2 + 2, 0, width - 4, height - 4, 0x59c96b, 0.96)
      .setOrigin(0, 0.5);
    const shine = this.add.rectangle(-width / 2 + 3, -2, width - 6, 2, 0xffffff, 0.26)
      .setOrigin(0, 0.5);
    container.add([shadow, backing, fill, shine]);
    return { container, fill, shine, width: width - 4, shineWidth: width - 6 };
  }

  getBuildingHealthColor(ratio) {
    if (ratio > 0.6) {return 0x59c96b;}
    if (ratio > 0.3) {return 0xf2c94c;}
    return 0xe65a45;
  }

  updateBuildingHealthBar(building) {
    if (!building.healthBar) {return;}
    const ratio = Phaser.Math.Clamp(building.hp / building.max, 0, 1);
    const color = this.getBuildingHealthColor(ratio);
    building.healthBar.container.setVisible(true);
    building.healthBar.fill.width = Math.max(1, building.healthBar.width * ratio);
    building.healthBar.fill.setFillStyle(color, 0.96);
    building.healthBar.shine.width = Math.max(0, building.healthBar.shineWidth * ratio);
  }

  bumpBuilding(building, amount) {
    if (this.state.phase !== 'playing' || building.hp <= 0) {return;}
    building.hp = Math.max(0, building.hp - amount);
    building.underAttackUntil = this.time.now + 650;
    building.sprite.setTint(0xfff0a0);
    this.updateBuildingHealthBar(building);
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
    this.updateBuildingHealthBar(building);
    if (building.hp <= 0) {
      building.sprite.setTint(0xffc98c);
      return;
    }
    if (building.hp < building.max) {
      if (this.time.now > building.underAttackUntil) {building.sprite.clearTint();}
      return;
    }
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
    this.buildings.forEach((building) => {
      const footprintBounds = this.getFootprintScreenBounds(
        building.footprintCells ?? this.getFootprintCells(building.iso.x, building.iso.y, building.footprint),
      );
      const spriteBounds = building.sprite.getBounds();
      const playerX = this.player.sprite.x;
      const playerY = this.player.sprite.y - Math.min(
        BUILDING_OCCLUSION_PLAYER_Y_OFFSET_MAX,
        this.player.sprite.displayHeight * BUILDING_OCCLUSION_PLAYER_Y_OFFSET_RATIO,
      );
      const hiddenBehind = playerY < building.sprite.y - BUILDING_OCCLUSION_VERTICAL_CLEARANCE
        && playerY >= spriteBounds.top + building.sprite.displayHeight * BUILDING_OCCLUSION_SPRITE_TOP_PADDING_RATIO
        && playerX >= footprintBounds.left - BUILDING_OCCLUSION_HORIZONTAL_PADDING
        && playerX <= footprintBounds.right + BUILDING_OCCLUSION_HORIZONTAL_PADDING;
      building.sprite.setAlpha(
        hiddenBehind
          ? Math.min(building.spriteAlpha ?? GENERATED_BUILDING_SPRITE_ALPHA, OCCLUDED_BUILDING_SPRITE_ALPHA)
          : (building.spriteAlpha ?? GENERATED_BUILDING_SPRITE_ALPHA),
      );
      building.base?.setAlpha(
        hiddenBehind
          ? Math.min(building.baseAlpha ?? STATIC_BUILDING_BASE_ALPHA, OCCLUDED_STATIC_BUILDING_BASE_ALPHA)
          : (building.baseAlpha ?? STATIC_BUILDING_BASE_ALPHA),
      );
    });
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

  isCompactOverlayLayout() {
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const aspect = viewportWidth / Math.max(1, viewportHeight);
    return this.touchControlsEnabled || viewportWidth < 980 || viewportHeight < 680 || aspect > 2.05 || aspect < 1.45;
  }

  getOverlayContentOffset(panelHeight) {
    const minCenterY = 78 + panelHeight / 2;
    const maxCenterY = HEIGHT - 28 - panelHeight / 2;
    const targetCenterY = Phaser.Math.Clamp(HEIGHT / 2 + 8, minCenterY, maxCenterY);
    return targetCenterY - HEIGHT / 2;
  }

  getSplashOverlayLayout() {
    const compact = this.isCompactOverlayLayout();
    const panelHeight = compact ? 430 : 462;
    return {
      compact,
      panelWidth: compact ? 730 : 780,
      panelHeight,
      offsetY: this.getOverlayContentOffset(panelHeight),
      decorScale: compact ? 0.48 : 0.54,
      titleY: compact ? -152 : -166,
      titleWidth: compact ? 470 : 520,
      titleTextWidth: compact ? 392 : 440,
      titleHeight: compact ? 54 : 58,
      titleSize: compact ? 26 : 28,
      titleMinSize: compact ? 20 : 22,
      creditY: compact ? -108 : -118,
      promptY: compact ? -70 : -80,
      choiceY: compact ? -38 : -48,
      cardY: compact ? 76 : 82,
      cardX: compact ? 204 : 220,
      cardWidth: compact ? 170 : 184,
      cardHeight: compact ? 154 : 166,
      heroY: compact ? 4 : 8,
      heroSize: compact ? 66 : 72,
      badgeY: compact ? -58 : -62,
      captionY: compact ? 54 : 60,
      startY: compact ? 184 : 200,
      startWidth: compact ? 230 : 242,
      startHeight: compact ? 50 : 52,
    };
  }

  getLevelUpOverlayLayout() {
    const compact = this.isCompactOverlayLayout();
    const panelHeight = compact ? 390 : 430;
    return {
      compact,
      panelWidth: compact ? 720 : 780,
      panelHeight,
      offsetY: this.getOverlayContentOffset(panelHeight),
      decorScale: compact ? 0.48 : 0.54,
      titleY: compact ? -140 : -154,
      titleWidth: compact ? 360 : 390,
      titleTextWidth: compact ? 292 : 318,
      titleHeight: compact ? 66 : 72,
      titleSize: compact ? 30 : 32,
      titleMinSize: compact ? 21 : 23,
      rewardY: compact ? -94 : -104,
      helperY: compact ? -70 : -76,
      cardY: compact ? 44 : 48,
      cardXScale: compact ? 0.88 : 0.94,
      cardWidth: compact ? 176 : 188,
      cardHeight: compact ? 176 : 188,
      iconY: compact ? -38 : -42,
      pipsY: compact ? 20 : 24,
      labelY: compact ? 48 : 52,
      detailY: compact ? 66 : 72,
    };
  }

  getGameOverOverlayLayout() {
    const compact = this.isCompactOverlayLayout();
    const panelHeight = compact ? 340 : 360;
    return {
      compact,
      panelWidth: compact ? 600 : 640,
      panelHeight,
      offsetY: this.getOverlayContentOffset(panelHeight),
      decorScale: compact ? 0.46 : 0.5,
      titleY: compact ? -116 : -126,
      titleWidth: compact ? 300 : 320,
      titleHeight: compact ? 54 : 58,
      titleSize: compact ? 29 : 31,
      reasonY: compact ? -50 : -56,
      statsY: compact ? 28 : 34,
      buttonY: compact ? 116 : 126,
    };
  }

  createUiPanelFrame(width, height, options: { decorScale?: number; fillAlpha?: number } = {}) {
    return createUiPanelFrame(this, width, height, options);
  }

  createTiledGameUiFrame(x, y, displayWidth, displayHeight, frameName, scale = 1) {
    return createTiledGameUiFrame(this, x, y, displayWidth, displayHeight, frameName, scale);
  }

  getGameUiFrameSize(frameName) {
    return getGameUiFrameSize(this, frameName);
  }

  createHorizontalSlicedFrame(
    x,
    y,
    width,
    height,
    frameNames,
    options: { leftWidth?: number; rightWidth?: number; alpha?: number } = {},
  ) {
    return createHorizontalSlicedFrame(this, x, y, width, height, frameNames, options);
  }

  createUiTitleBanner(x, y, width = 360, height = 70) {
    return createUiTitleBanner(this, x, y, width, height);
  }

  fitUiTextToWidth(text, maxWidth, maxSize, minSize = 16) {
    return fitUiTextToWidth(text, maxWidth, maxSize, minSize);
  }

  createFittedTitleText(x, y, label, maxWidth, maxSize, minSize) {
    return createFittedTitleText(this, x, y, label, maxWidth, maxSize, minSize);
  }

  createHudChip(x, y, width, height) {
    return createHudChip(this, x, y, width, height);
  }

  createUiCardFrame(x, y, width, height) {
    return createUiCardFrame(this, x, y, width, height);
  }

  createUiButton(x, y, width, height, label, onPress) {
    return createUiButton(this, x, y, width, height, label, onPress);
  }

  createManaMeter(x, y, width, height) {
    return createManaMeter(this, x, y, width, height);
  }

  createSplashOverlay() {
    const layout = this.getSplashOverlayLayout();
    this.splashOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7900).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x17344f, 0.36);
    const content = this.add.container(0, layout.offsetY);
    const panel = this.createUiPanelFrame(layout.panelWidth, layout.panelHeight, { decorScale: layout.decorScale });
    const titlePlaque = this.createUiTitleBanner(0, layout.titleY, layout.titleWidth, layout.titleHeight);
    const title = this.createFittedTitleText(
      0,
      layout.titleY - 3,
      'The Village Must Stand',
      layout.titleTextWidth,
      layout.titleSize,
      layout.titleMinSize,
    );
    const credit = this.add.text(0, layout.creditY, 'A minigame by Javier Algaba', {
      ...this.uiTextStyle(layout.compact ? 16 : 17, '#31503b'),
      strokeThickness: 3,
    }).setOrigin(0.5);
    const prompt = this.add.text(0, layout.promptY, 'Defend the fairy-tale village from forest mischief.', {
      ...this.uiTextStyle(layout.compact ? 15 : 16, COLORS.uiInk),
      align: 'center',
      wordWrap: { width: layout.panelWidth - 180 },
    }).setOrigin(0.5);
    this.splashHeroChoiceText = this.add.text(0, layout.choiceY, 'Choose your hero before you begin.', {
      ...this.uiTextStyle(layout.compact ? 14 : 15, '#31503b'),
      align: 'center',
    }).setOrigin(0.5);
    const makeHeroCard = (choice: HeroChoice, x: number, label: string) => {
      const previewProfile = this.getHeroProfile(choice);
      this.ensureHeroAnimations(previewProfile);
      const card = this.add.container(x, layout.cardY);
      const frame = this.createUiCardFrame(0, 0, layout.cardWidth, layout.cardHeight);
      const selection = this.add.rectangle(0, 0, layout.cardWidth - 4, layout.cardHeight - 4, 0xfff1b8, 0.001)
        .setStrokeStyle(3, 0xffd26d, 0)
        .setOrigin(0.5);
      const hit = this.add.rectangle(0, 0, layout.cardWidth, layout.cardHeight, 0xfff1b8, 0.001)
        .setInteractive({ useHandCursor: true });
      const preview = this.add.sprite(0, layout.heroY, previewProfile.sheetKey, `${previewProfile.framePrefix}-0-0`)
        .setDisplaySize(layout.heroSize, layout.heroSize)
        .setOrigin(0.5, 0.76)
        .play(`${previewProfile.animPrefix}-idle`);
      const caption = this.add.text(0, layout.captionY, label, this.uiTextStyle(layout.compact ? 15 : 16, '#7d6039')).setOrigin(0.5);
      const badge = this.add.text(0, layout.badgeY, 'Selected', this.uiTextStyle(layout.compact ? 11 : 12, '#5c7d3e'))
        .setOrigin(0.5)
        .setVisible(false);
      hit.on('pointerup', () => this.selectHeroChoice(choice));
      card.add([frame, selection, hit, preview, caption, badge]);
      return { card, frame, selection, hit, preview, label: caption, badge };
    };
    const maleCard = makeHeroCard('male', -layout.cardX, 'Village Hero');
    const princessCard = makeHeroCard('princess', layout.cardX, 'Princess Hero');
    const startButton = this.createUiButton(0, layout.startY, layout.startWidth, layout.startHeight, 'START', () => this.startGameFromSplash());
    this.splashStartButton = startButton.hit;
    this.splashStartText = startButton.text;
    this.splashHeroCards = {
      male: maleCard,
      princess: princessCard,
    };
    content.add([
      panel,
      titlePlaque,
      title,
      credit,
      prompt,
      this.splashHeroChoiceText,
      maleCard.card,
      princessCard.card,
      startButton.container,
    ]);
    this.splashOverlay.add([shade, content]);
    this.uiLayer.add(this.splashOverlay);
    this.updateSplashHeroChoiceUi();
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
    this.levelUpChoices = LEVEL_UP_CHOICE_DEFS.map((def) => ({
      ...def,
      apply: () => def.apply(this),
    }));

    const layout = this.getLevelUpOverlayLayout();
    this.levelUpOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7300).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x17344f, 0.42);
    const content = this.add.container(0, layout.offsetY);
    const panel = this.createUiPanelFrame(layout.panelWidth, layout.panelHeight, { decorScale: layout.decorScale });
    const titlePlaque = this.createUiTitleBanner(0, layout.titleY, layout.titleWidth, layout.titleHeight);
    this.levelUpTitleFit = {
      maxWidth: layout.titleTextWidth,
      maxSize: layout.titleSize,
      minSize: layout.titleMinSize,
    };
    this.levelUpTitleText = this.createFittedTitleText(
      0,
      layout.titleY,
      'Level Up!',
      this.levelUpTitleFit.maxWidth,
      this.levelUpTitleFit.maxSize,
      this.levelUpTitleFit.minSize,
    );
    this.levelUpRewardText = this.add.text(0, layout.rewardY, 'Heart +1', this.uiTextStyle(layout.compact ? 19 : 21, '#bd415c')).setOrigin(0.5);
    this.levelUpHelperText = this.add.text(0, layout.helperY, 'Choose your guild training', this.uiTextStyle(layout.compact ? 15 : 17, '#31503b')).setOrigin(0.5);
    content.add([panel, titlePlaque, this.levelUpTitleText, this.levelUpRewardText, this.levelUpHelperText]);

    this.levelUpProgressBars = [];
    this.levelUpChoiceCards = [];
    this.levelUpChoices.forEach((choice, index) => {
      const card = this.add.container(LEVEL_UP_CARD_XS[index] * layout.cardXScale, layout.cardY);
      const frame = this.createUiCardFrame(0, 0, layout.cardWidth, layout.cardHeight);
      const hit = this.add.rectangle(0, 0, layout.cardWidth, layout.cardHeight, 0xfff1b8, 0.001)
        .setInteractive({ useHandCursor: true });
      const stage = this.createLevelUpIconStage(choice);
      stage.setScale(layout.compact ? 0.86 : 0.92);
      const evolutionGlow = this.add.circle(0, layout.iconY, layout.compact ? 42 : 46, 0xffd86e, 0.18)
        .setStrokeStyle(3, 0xfff1a7, 0.75)
        .setVisible(false);
      const icon = this.add.image(0, layout.iconY, choice.icon.texture, choice.icon.frame)
        .setDisplaySize(layout.compact ? 62 : 68, layout.compact ? 62 : 68);
      const evolutionBadge = this.add.container(layout.compact ? 38 : 42, layout.iconY - (layout.compact ? 36 : 40))
        .setVisible(false);
      const badgeBacking = this.add.circle(0, 0, layout.compact ? 13 : 14, 0xfff0a4, 0.96)
        .setStrokeStyle(2, 0xb56b1f, 0.82);
      const badgeText = this.add.text(0, -1, 'UP', this.uiTextStyle(layout.compact ? 8 : 9, '#7a4513'))
        .setOrigin(0.5);
      evolutionBadge.add([badgeBacking, badgeText]);
      const label = this.add.text(0, layout.labelY, choice.label, this.uiTextStyle(layout.compact ? 15 : 17, COLORS.uiInk)).setOrigin(0.5);
      const detailText = choice.detail.replace(' power', '');
      const detail = this.add.text(0, layout.detailY, detailText, this.uiTextStyle(layout.compact ? 12 : 13, '#5e7b4a')).setOrigin(0.5);
      const pips = this.createLevelUpProgressPips(choice, layout.pipsY, layout.compact);
      hit.on('pointerover', () => {
        hit.setFillStyle(0xfff1b8, 0.16);
        frame.setTint(0xfff6cc);
        this.updateLevelUpProgressBars(index);
      });
      hit.on('pointerout', () => {
        hit.setFillStyle(0xfff1b8, 0.001);
        frame.clearTint();
        this.updateLevelUpProgressBars();
      });
      hit.on('pointerup', () => this.chooseLevelUpgrade(index));
      card.add([frame, hit, stage, evolutionGlow, icon, evolutionBadge, ...pips, label, detail]);
      content.add(card);
      this.levelUpChoiceCards.push({ choice, label, detail, icon, evolutionGlow, evolutionBadge });
    });
    this.updateLevelUpChoicePresentation();
    this.levelUpOverlay.add([shade, content]);
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

  createLevelUpProgressPips(choice, y = 48, compact = false) {
    const pips = [];
    const pipW = compact ? 17 : 19;
    const gap = compact ? 4 : 5;
    const startX = -((LEVEL_UP_MAX_PIPS - 1) * (pipW + gap)) / 2;
    for (let i = 0; i < LEVEL_UP_MAX_PIPS; i += 1) {
      const pip = this.add.rectangle(startX + i * (pipW + gap), y, pipW, compact ? 8 : 9, 0xfff3c8, 0.46)
        .setStrokeStyle(1, 0x8c6023, 0.5);
      pips.push(pip);
    }
    this.levelUpProgressBars.push({ pips, stat: choice.stat, color: choice.color, key: choice.key });
    return pips;
  }

  updateLevelUpProgressBars(previewIndex = null) {
    this.levelUpProgressBars.forEach((bar, index) => {
      const current = this.getLevelUpStatProgress(bar.stat);
      const preview = previewIndex === index ? Phaser.Math.Clamp(current + 1, 0, LEVEL_UP_MAX_PIPS) : current;
      const evolvedRange = bar.key === 'range' && (this.playerStats.bowEvolved || this.isBowEvolutionReady());
      const fillColor = evolvedRange ? 0xf2c94c : bar.color;
      bar.pips.forEach((pip, pipIndex) => {
        if (pipIndex < current) {
          pip.setFillStyle(fillColor, 0.94);
          pip.setStrokeStyle(1, 0xffffff, 0.72);
        } else if (pipIndex < preview) {
          pip.setFillStyle(fillColor, 0.5);
          pip.setStrokeStyle(1, 0xffffff, 0.64);
        } else {
          pip.setFillStyle(0xfff3c8, 0.46);
          pip.setStrokeStyle(1, 0x8c6023, 0.5);
        }
      });
    });
  }

  getLevelUpStatProgress(stat) {
    if (stat === 'swordPower' || stat === 'bowPower' || stat === 'spellPower') {
      return getLevelUpProgressForStat(this.playerStats, stat);
    }
    return Phaser.Math.Clamp(this.playerStats[stat] - PLAYER_BASE[stat], 0, LEVEL_UP_MAX_PIPS);
  }

  isBowEvolutionReady() {
    return isBowEvolutionReadyForStats(this.playerStats);
  }

  getRangeLevelUpPresentation() {
    return getRangeLevelUpPresentationForStats(this.playerStats);
  }

  updateLevelUpChoicePresentation() {
    this.levelUpChoiceCards?.forEach((card) => {
      if (card.choice.key !== 'range') {
        card.label.setText(card.choice.label);
        card.detail.setText(card.choice.detail.replace(' power', ''));
        card.icon.clearTint();
        card.evolutionGlow?.setVisible(false);
        card.evolutionBadge?.setVisible(false);
        return;
      }
      const presentation = this.getRangeLevelUpPresentation();
      card.label.setText(presentation.label);
      card.detail.setText(presentation.detail);
      card.evolutionGlow?.setVisible(presentation.evolved);
      card.evolutionBadge?.setVisible(presentation.evolved);
      if (presentation.evolved) {
        card.icon.setTint(0xffdf75);
      } else {
        card.icon.clearTint();
      }
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
    if (!this.forceFreshStart && this.shouldAutoStartFromParams()) {
      this.pendingHeroChoice = this.resolveRequestedHeroChoice();
      this.applyHeroChoice(this.pendingHeroChoice, { announce: false, restartIdle: true });
      this.splashOverlay?.setVisible(false).setAlpha(0);
      this.startGameFromSplash();
      return;
    }
    const explicitHeroChoice = new URLSearchParams(window.location.search).get('hero');
    this.pendingHeroChoice = !this.forceFreshStart && explicitHeroChoice ? this.resolveRequestedHeroChoice() : null;
    if (this.pendingHeroChoice) {
      this.applyHeroChoice(this.pendingHeroChoice, { announce: false, restartIdle: true });
    }
    this.splashOverlay?.setVisible(true).setAlpha(0);
    this.updateSplashHeroChoiceUi();
    this.tweens.add({
      targets: this.splashOverlay,
      alpha: 1,
      duration: 260,
      ease: 'Sine.easeOut',
    });
  }

  startGameFromSplash() {
    if (this.state.phase !== 'splash') {return;}
    if (!this.pendingHeroChoice) {
      this.addGuildNote('Choose a hero first.');
      this.playTone('hit');
      return;
    }
    this.applyHeroChoice(this.pendingHeroChoice, { announce: false, restartIdle: true });
    this.ensureAudio();
    this.playTone('level');
    this.splashOverlay?.setVisible(false);
    this.addGuildNote('The village adventure begins!');
    this.startLevelCountdown();
  }

  createGameOverOverlay() {
    const layout = this.getGameOverOverlayLayout();
    this.gameOverOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7800).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x17344f, 0.48);
    const content = this.add.container(0, layout.offsetY);
    const panel = this.createUiPanelFrame(layout.panelWidth, layout.panelHeight, { decorScale: layout.decorScale });
    const titlePlaque = this.createUiTitleBanner(0, layout.titleY, layout.titleWidth, layout.titleHeight);
    const title = this.add.text(0, layout.titleY - 3, 'Guild Rest Time', {
      ...this.uiTextStyle(layout.titleSize, '#714617'),
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.gameOverReasonText = this.add.text(0, layout.reasonY, '', {
      ...this.uiTextStyle(layout.compact ? 18 : 20, COLORS.uiInk),
      align: 'center',
      wordWrap: { width: layout.panelWidth - 140 },
    }).setOrigin(0.5);
    this.gameOverStatsText = this.add.text(0, layout.statsY, '', this.uiTextStyle(layout.compact ? 16 : 18, '#31503b')).setOrigin(0.5);
    const restartButton = this.createUiButton(0, layout.buttonY, 246, 52, 'Restart (R)', () => this.restartGameFromBeginning());
    content.add([
      panel,
      titlePlaque,
      title,
      this.gameOverReasonText,
      this.gameOverStatsText,
      restartButton.container,
    ]);
    this.gameOverOverlay.add([shade, content]);
    this.uiLayer.add(this.gameOverOverlay);
  }

  showLevelUpScreen(context: UpgradePauseContext = 'roundClear') {
    this.upgradePauseContext = context;
    const bossHeartReward = context === 'roundClear' && this.state.bossRound;
    this.levelUpTitleText.setText(context === 'chestBonus' ? 'Cheerful Surprise!' : 'Level Up!');
    this.fitUiTextToWidth(
      this.levelUpTitleText,
      this.levelUpTitleFit.maxWidth,
      this.levelUpTitleFit.maxSize,
      this.levelUpTitleFit.minSize,
    );
    this.levelUpRewardText
      ?.setText(context === 'chestBonus' ? 'Choose a bonus strength point' : 'Boss reward: Heart +1')
      .setVisible(context === 'chestBonus' || bossHeartReward);
    this.levelUpHelperText?.setText(context === 'chestBonus' ? 'Pick a bonus combat lesson' : 'Choose your guild training');
    this.updateLevelUpChoicePresentation();
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
    const pauseContext = (this.upgradePauseContext ?? 'roundClear') as UpgradePauseContext;
    const wasBossRound = this.state.bossRound;
    if (pauseContext === 'roundClear' && wasBossRound) {
      this.playerStats.maxHealth += 1;
      this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + 1);
      this.addGuildNote('Boss victory training earned a new heart!');
    }
    choice.apply();
    this.updateLevelUpChoicePresentation();
    this.updateLevelUpProgressBars();
    this.spawnShieldGlow();
    this.playTone('level');
    if (pauseContext === 'chestBonus') {
      this.resumeRoundAfterChestBonus();
      return;
    }
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
      this.restartForWorldProgression(nextProgression, transitionNote);
      return;
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
    this.createControlsHint();
    this.createInventoryPanel();
    this.createDebugOverlay();
  }

  createTopBar() {
    const top = this.add.container(20, 13).setDepth(7600);
    const goldChip = this.createHudChip(184, 28, 92, 34);
    const levelChip = this.createHudChip(268, 28, 68, 34);
    const roundChip = this.createHudChip(376, 28, 124, 34);
    const coin = this.add.image(154, 28, 'gameUiAtlas', 'coin_badge_01')
      .setDisplaySize(30, 32);
    this.hud.hearts = this.add.container(16, 20);
    this.hud.goldText = this.add.text(198, 28, '', this.uiTextStyle(16, '#56330f')).setOrigin(0.5);
    this.hud.levelText = this.add.text(268, 28, '', this.uiTextStyle(15, '#1e3348')).setOrigin(0.5);
    this.hud.waveText = this.add.text(376, 28, '', this.uiTextStyle(12, '#224b31')).setOrigin(0.5);
    top.add([
      this.hud.hearts,
      goldChip,
      levelChip,
      roundChip,
      coin,
      this.hud.goldText,
      this.hud.levelText,
      this.hud.waveText,
    ]);
    this.uiLayer.add(top);
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
      'WASD/Arrows move   Space sword   Click/F bow   Q/R spell   T repair mode   Space/click/E repair nearby   I guild pack',
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
    if (!this.state.inventoryOpen) {
      this.setRepairMode(false, false);
    }
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

  updateHud() {
    this.renderHearts();
    this.hud.goldText.setText(`${this.state.gold}`);
    this.hud.levelText.setText(`Lv ${this.state.level}`);
    this.hud.waveText.setText(`${this.getCurrentWorldTheme().label} R${this.state.worldRound}`);
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
      const x = (i % 6) * 22;
      const y = Math.floor(i / 6) * 21;
      const full = i < this.state.health;
      const heart = this.add.image(x, y, 'gameUiAtlas', full ? 'health_full_01' : 'health_empty_01')
        .setOrigin(0.5)
        .setDisplaySize(24, 24);
      this.hud.hearts.add(heart);
    }
  }

  setMeter(meter, ratio) {
    meter.fill.width = meter.width * Phaser.Math.Clamp(ratio, 0, 1);
    meter.shine.width = Math.max(0, meter.fill.width - 4);
  }

  uiTextStyle(size, color) {
    return uiTextStyle(size, color);
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
