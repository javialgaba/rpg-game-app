import * as Phaser from 'phaser';
import './style.css';
import { ASSET_REGISTRY } from './levels/assetRegistry';
import { buildSeasonBoardConfig } from './levels/buildSeasonBoard';
import { generateLevel, validateGeneratedLevel } from './levels/generateLevel';
import { resolveLevelConfigFromParams, shouldRenderGeneratedLevelFromParams } from './levels/levelCatalog';
import type { AssetRenderMetadata, GridPoint, LevelPlacement } from './levels/levelTypes';
import { findGridPath, pathCost } from './levels/pathfinding';


import { resolveSceneVariantFromParams, SCENE_VARIANTS, type SceneVariantConfig, type SeasonPreset } from './sceneVariants';
import {
  BOSS_CONFIGS,
  BOSS_ROUND_INDEX,
  COLORS,
  GENERATED_BUILDING_SPRITE_ALPHA,
  getLevelUpProgressForStat,
  getRangeLevelUpPresentationForStats,
  isBowEvolutionReadyForStats,
  HEIGHT,
  LEVEL_UP_CARD_XS,
  LEVEL_UP_MAX_PIPS,
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
  STATIC_BUILDING_BASE_ALPHA,
  WIDTH,
  WORLD_ENEMY_THEMES,
  WORLD_SEQUENCE,
  UPGRADE_DEFS,
  LEVEL_UP_CHOICE_DEFS,
} from './gameConfig';
import type {
  HeroChoice,
  UpgradePauseContext,
  RepairModeTargetState,
  GeneratedSurroundAnchor,
  GeneratedSurroundLayer,
  ScreenFootprintBounds,
  RunResumeBuildingSnapshot,
  RunResumeStateSnapshot,
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
import {
  drawMapTiles,
  drawDiamond,
  createPathStones,
  createForestBorder,
  createBuildings,
  createProps,
  addFireflyCluster,
  renderGeneratedBuilding,
  renderGeneratedProp,
  renderGeneratedDecoration,
} from './staticMapRenderer';
import {
  getSceneVariantTerrainTexture,
  getSceneVariantBuildingTexture,
  getSceneVariantPropTexture,
  getSceneVariantDecorationTexture,
  addSceneVariantImage,
  registerParallaxSprite,
  hasStaticSceneVariantFrame,
  renderSceneVariantBackground,
  renderSceneVariantFrame,
  renderSceneVariantForeground,
  renderSceneVariantOverlapDecor,
  applySceneVariantAmbient,
  updateCinematicParallax,
} from './sceneVariantRenderer';
import { touchControlsCreate, setupMobileViewportHandlers, touchControlsUpdate } from './touchControls';
import { spawnChest as _spawnChest, updateChests as _updateChests, tryOpenChest as _tryOpenChest, resumeRoundAfterChestBonus as _resumeRoundAfterChestBonus } from './chests';
import { updateProjectiles as _updateProjectiles, destroyProjectile as _destroyProjectile, clearProjectiles as _clearProjectiles, dropReward as _dropReward, updatePickups as _updatePickups, collectPickup as _collectPickup } from './projectiles';
import { clearLevelTimers as _clearLevelTimers, addLevelTimer as _addLevelTimer, showCountdownLabel as _showCountdownLabel, scheduleLevelSpawns as _scheduleLevelSpawns, resetLevelRoundState as _resetLevelRoundState, buildCountdownSequence as _buildCountdownSequence, checkLevelClearCondition, getCurrentRoundTitle, getNextWorldProgressionState, calculateRoundReward } from './levelFlow';
import { pickWeighted as _pickWeighted, getEnemyArchetype as _getEnemyArchetype, getEnemyVariant as _getEnemyVariant, getEnemyDisplayName as _getEnemyDisplayName, getEnemyFrameKey as _getEnemyFrameKey, getWorldEliteVisual as _getWorldEliteVisual, getBossVisual as _getBossVisual } from './enemySpawning';
import { getNearestForestExit as _getNearestForestExit, getPathProgress as _getPathProgress, isRetreatComplete as _isRetreatComplete } from './enemyAI';
import { getFootprintCells as _getFootprintCells, getRepairModeTargetState as _getRepairModeTargetState, getRepairModeTarget as _getRepairModeTarget, getNearestDamagedBuilding as _getNearestDamagedBuilding, getRepairDistanceToBuilding as _getRepairDistanceToBuilding, getBuildingFootprintCells as _getBuildingFootprintCells } from './repairSystem';
import { isoToGridCell as _isoToGridCell, getGeneratedEdgeSpawnPoints as _getGeneratedEdgeSpawnPoints, getGeneratedFallbackSpawnAnchors as _getGeneratedFallbackSpawnAnchors, getGeneratedPlayableEdgeCells as _getGeneratedPlayableEdgeCells } from './generatedLevelSpawning';
import { getBuildingHealthColor as _getBuildingHealthColor, computeVillageSafety as _computeVillageSafety } from './buildingSystem';
import { spawnSparkleBurst as _spawnSparkleBurst, spawnSpellBloom as _spawnSpellBloom, spawnShieldGlow as _spawnShieldGlow, spawnRepairToolEffect as _spawnRepairToolEffect, updateEffects as _updateEffects } from './effects';
import { swingSword as _swingSword, fireBow as _fireBow, castSpell as _castSpell, damageEnemy as _damageEnemy, removeEnemy as _removeEnemy } from './combat';
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
    this.load.atlas('sceneVariantTerrainAtlas', '/assets/scene-variants/scene_variant_terrain_atlas.png', '/assets/scene-variants/scene_variant_terrain_atlas.json');
    this.load.atlas('sceneVariantPropsAtlas', '/assets/scene-variants/scene_variant_props_atlas.png', '/assets/scene-variants/scene_variant_props_atlas.json');
    this.load.atlas('sceneVariantBuildingsAtlas', '/assets/scene-variants/scene_variant_buildings_atlas.png', '/assets/scene-variants/scene_variant_buildings_atlas.json');
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
    updateCinematicParallax(this);
  }

  getCurrentWorldTheme() {
    return WORLD_ENEMY_THEMES[this.state.worldKey as SeasonPreset] ?? WORLD_ENEMY_THEMES.day_spring;
  }

  getCurrentRoundTitle() {
    const theme = this.getCurrentWorldTheme();
    return getCurrentRoundTitle(this.state.level, this.state.bossRound, theme.label, theme.bossLabel);
  }

  getNextWorldProgressionState() {
    return getNextWorldProgressionState(this.state.worldIndex, this.state.worldRound, this.state.worldCycle);
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

  getSceneVariantTerrainTexture(placement) {
    return getSceneVariantTerrainTexture(this, placement);
  }

  getSceneVariantPropTexture(placement) {
    return getSceneVariantPropTexture(this, placement);
  }

  getSceneVariantBuildingTexture(placement) {
    return getSceneVariantBuildingTexture(this, placement);
  }

  getSceneVariantDecorationTexture(placement) {
    return getSceneVariantDecorationTexture(this, placement);
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
    return addSceneVariantImage(this, layer, textureKey, x, y, uniformScale, depth, options);
  }

  registerParallaxSprite(sprite, factor, baseX, baseY) {
    registerParallaxSprite(this, sprite, factor, baseX, baseY);
  }

  hasStaticSceneVariantFrame(config) {
    return hasStaticSceneVariantFrame(this, config);
  }

  renderSceneVariantBackground(config, bounds) {
    renderSceneVariantBackground(this, config, bounds);
  }

  renderSceneVariantFrame(config, bounds) {
    renderSceneVariantFrame(this, config, bounds);
  }

  renderSceneVariantForeground(config, bounds) {
    renderSceneVariantForeground(this, config, bounds);
  }

  renderSceneVariantOverlapDecor(config, bounds, tileW, tileH) {
    renderSceneVariantOverlapDecor(this, config, bounds, tileW, tileH);
  }

  applySceneVariantAmbient(config) {
    applySceneVariantAmbient(this, config);
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
      const terrainTexture = this.getSceneVariantTerrainTexture(placement);
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
    renderGeneratedBuilding(this, placement);
  }

  renderGeneratedProp(placement) {
    renderGeneratedProp(this, placement);
  }

  renderGeneratedDecoration(placement) {
    renderGeneratedDecoration(this, placement);
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
    drawMapTiles(this);
  }

  drawDiamond(x, y, w, h, fill, stroke, alpha = 1, strokeAlpha = 0.45) {
    drawDiamond(this, x, y, w, h, fill, stroke, alpha, strokeAlpha);
  }

  createPathStones() {
    createPathStones(this);
  }

  createForestBorder() {
    createForestBorder(this);
  }

  createBuildings() {
    createBuildings(this);
  }

  createProps() {
    createProps(this);
  }

  addFireflyCluster(x, y, seed) {
    addFireflyCluster(this, x, y, seed);
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

  createTouchControls() {
    touchControlsCreate(this as any);
  }

  setupMobileViewportHandlers() {
    setupMobileViewportHandlers(this as any);
  }

  updateTouchControls() {
    touchControlsUpdate(this as any);
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
    _swingSword(this as any, time);
  }

  fireBow(time, targetIso = this.lastPointerIso) {
    _fireBow(this as any, time, targetIso);
  }

  castSpell(time, targetIso = this.lastPointerIso) {
    _castSpell(this as any, time, targetIso);
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
    _spawnChest(this as any, x, y, reward, options);
  }

  updateChests(time) {
    _updateChests(this as any, time);
  }

  tryOpenChest() {
    _tryOpenChest(this as any);
  }



  resumeRoundAfterChestBonus() {
    _resumeRoundAfterChestBonus(this as any);
  }

  toggleRepairMode() {
    if (this.state.phase !== 'playing') {return;}
    this.ensureAudio();
    this.setRepairMode(!this.state.repairMode);
  }

  getFootprintCells(x, y, footprint = { w: 1, h: 1 }) {
    return _getFootprintCells(x, y, footprint);
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
    return _getBuildingFootprintCells(building, (x, y, f) => this.getFootprintCells(x, y, f));
  }

  getRepairDistanceToBuilding(building) {
    return _getRepairDistanceToBuilding(building, this.player?.iso ?? null, (x, y, f) => this.getFootprintCells(x, y, f));
  }

  getNearestDamagedBuilding(range = REPAIR_RANGE) {
    return _getNearestDamagedBuilding(this.buildings, this.player?.iso ?? null, (x, y, f) => this.getFootprintCells(x, y, f), range);
  }

  getRepairModeTarget(range = REPAIR_RANGE) {
    return _getRepairModeTarget(this.buildings, this.player?.iso ?? null, (x, y, f) => this.getFootprintCells(x, y, f), range);
  }

  getRepairModeTargetState(building): RepairModeTargetState {
    return _getRepairModeTargetState(building, this.state.gold);
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
    _spawnRepairToolEffect(this as any, building, amount);
  }

  clearLevelTimers() {
    _clearLevelTimers(this as any);
  }

  addLevelTimer(delay, callback) {
    return _addLevelTimer(this as any, delay, callback);
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

    const sequence = _buildCountdownSequence(this.getCurrentRoundTitle());
    sequence.forEach((label, index) => {
      this.addLevelTimer(index * 780, () => {
        this.showCountdownLabel(label);
        if (label === 'Go!') {this.playTone('level');}
      });
    });
    this.addLevelTimer(sequence.length * 780, () => this.startLevelRound());
  }

  showCountdownLabel(label) {
    _showCountdownLabel(this as any, label, this.getCurrentRoundTitle());
  }

  startLevelRound() {
    if (this.state.phase !== 'countdown') {return;}
    this.state.phase = 'playing';
    this.countdownOverlay?.setVisible(false);
    this.levelClearQueued = false;

    const level = this.state.level;
    const isBossRound = this.state.bossRound;
    _resetLevelRoundState(this as any, level, isBossRound);
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

    _scheduleLevelSpawns(this as any, level, this.levelSpawnsPending, isBossRound);
  }

  checkLevelClear() {
    if (checkLevelClearCondition(
      this.state.phase,
      this.levelClearQueued,
      this.levelDefeatsThisRound,
      this.levelRequiredDefeats,
      this.levelSpawnsPending,
      this.levelSpawnedCount,
      this.state.bossRound,
      this.chests,
    )) {
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
    const reward = calculateRoundReward(this.state.bossRound, this.state.level, this.state.worldCycle, this.state.worldKey);
    this.state.gold += reward.gold;
    this.gainXp(reward.xp);
    this.addGuildNote(
      this.state.bossRound
        ? `${bossConfig.name} defeated! +${reward.gold} gold`
        : `Level ${this.state.level} clear! +${reward.gold} gold`,
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
    return _isoToGridCell(iso, this.generatedLevel);
  }

  getGeneratedEdgeSpawnPoints() {
    return _getGeneratedEdgeSpawnPoints(this.generatedLevel);
  }

  getGeneratedFallbackSpawnAnchors() {
    return _getGeneratedFallbackSpawnAnchors(this.generatedLevel);
  }

  getGeneratedPlayableEdgeCells() {
    return _getGeneratedPlayableEdgeCells(this.generatedLevel);
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
    return _pickWeighted(items, Phaser.Math.FloatBetween(0, 1));
  }

  getEnemyArchetype(level) {
    return _getEnemyArchetype(level, this.getCurrentWorldTheme().preferredArchetypes, Phaser.Math.FloatBetween(0, 1));
  }

  getEnemyVariant(level) {
    return _getEnemyVariant(level, Phaser.Math.FloatBetween(0, 1));
  }

  getEnemyDisplayName(enemy) {
    return _getEnemyDisplayName(enemy.variant.label, enemy.archetype.label);
  }

  getEnemyFrameKey(enemy, column) {
    const prefix = enemy.framePrefix ?? 'monster';
    const row = enemy.frameRow ?? enemy.archetype?.row ?? 0;
    return _getEnemyFrameKey(prefix, row, column);
  }

  getWorldEliteVisual(level, variant) {
    const theme = this.getCurrentWorldTheme();
    return _getWorldEliteVisual(
      level,
      variant.key,
      theme.eliteSpawnChance,
      theme.eliteAssetKey,
      theme.eliteFramePrefix,
      theme.eliteIdleFrames,
      theme.eliteDefeatFrame,
      theme.eliteDisplayScaleX,
      theme.eliteDisplayScaleY,
      theme.ambientTint,
      variant.tint,
      (key: string) => this.textures.exists(key),
      Phaser.Math.FloatBetween(0, 1),
    );
  }

  getBossVisual() {
    const theme = this.getCurrentWorldTheme();
    const bossConfig = BOSS_CONFIGS[this.state.worldKey as SeasonPreset];
    return _getBossVisual(
      theme.bossAssetKey,
      theme.bossFramePrefix,
      bossConfig.tint,
      (key: string) => this.textures.exists(key),
    );
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
        const progress = _getPathProgress(enemy.path, enemy.pathIndex, enemy.iso, 0.38);
        enemy.pathIndex = progress.pathIndex;
        targetIso = progress.targetIso;
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
      if (enemy.retreating && _isRetreatComplete(enemy.iso, targetIso)) {
        this.removeEnemy(enemy, false);
      }
      const p = this.isoToScreen(enemy.iso.x, enemy.iso.y, 16 + Math.sin(time / 240 + enemy.wobble) * 2);
      enemy.sprite.setPosition(p.x, p.y);
      enemy.shadow.setPosition(p.x, p.y + 14);
      enemy.sprite.rotation = time < enemy.dazedUntil ? Math.sin(time / 65) * 0.1 : Math.sin(time / 220 + enemy.wobble) * 0.04;
    });
  }

  getNearestForestExit(iso) {
    return _getNearestForestExit(iso, this.generatedLevelActive, this.generatedLevel?.width ?? null, this.generatedLevel?.height ?? null);
  }

  damageEnemy(enemy, amount, reason) {
    _damageEnemy(this as any, enemy, amount, reason);
  }


  removeEnemy(enemy, animate = true) {
    _removeEnemy(this as any, enemy, animate);
  }

  clearRetreatingEnemies() {
    this.enemies.slice().forEach((enemy) => {
      if (enemy.defeated || enemy.retreating) {
        this.removeEnemy(enemy, true);
      }
    });
  }

  dropReward(x, y, enemy = null) {
    _dropReward(this as any, x, y, enemy);
  }

  updatePickups(dt) {
    _updatePickups(this as any, dt);
  }

  collectPickup(pickup) {
    _collectPickup(this as any, pickup);
  }

  updateProjectiles(dt) {
    _updateProjectiles(this as any, dt);
  }

  destroyProjectile(projectile) {
    _destroyProjectile(this as any, projectile);
  }

  clearProjectiles() {
    _clearProjectiles(this as any);
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
    return _getBuildingHealthColor(ratio);
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
    this.state.villageSafety = _computeVillageSafety(this.buildings, this.state.villageSafety);
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
    _spawnSparkleBurst(this as any, x, y, color, count, scale);
  }

  spawnSpellBloom(x, y, scale = 1) {
    _spawnSpellBloom(this as any, x, y, scale);
  }

  spawnShieldGlow() {
    _spawnShieldGlow(this as any);
  }

  updateEffects(dt) {
    _updateEffects(this as any, dt);
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
