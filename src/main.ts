import * as Phaser from 'phaser';
import './style.css';
import { ASSET_REGISTRY } from './levels/assetRegistry';
import { buildSeasonBoardConfig } from './levels/buildSeasonBoard';
import { generateLevel, validateGeneratedLevel } from './levels/generateLevel';
import { resolveLevelConfigFromParams, shouldRenderGeneratedLevelFromParams } from './levels/levelCatalog';
import type { AssetRenderMetadata, GridPoint, LevelPlacement } from './levels/levelTypes';
import { findGridPath, pathCost } from './levels/pathfinding';
import { findNearestPlayerSafeCell, isPlayerSafeCell } from './levels/playerFootprint';
import { probeScreenSpaceEscape, resolveScreenSpacePlayerMovement, screenDirectionToIsoMovement, SCREEN_ESCAPE_DIRECTIONS } from './playerMovement';
import { getPlayerOccluderAlpha, isPlayerOccludedByScenery } from './playerOcclusion';

import { resolveSceneVariantFromParams, SCENE_VARIANTS, type SceneVariantConfig, type SeasonPreset } from './sceneVariants';
import {
  BOSS_CONFIGS,
  BOSS_HEALTH_MULTIPLIER,
  BOSS_PROJECTILE_COOLDOWN,
  BOSS_PROJECTILE_DAMAGE,
  BOSS_ROUND_INDEX,
  CARD_DEFINITIONS,
  COLORS,
  HERO_CLASSES,
  GENERATED_BUILDING_SPRITE_ALPHA,
  HEIGHT,
  LEVEL_UP_CARD_XS,
  PLAYER_BASE,
  REPAIR_AMOUNT,
  REPAIR_COOLDOWN,
  REPAIR_COST,
  REPAIR_RANGE,
  STATIC_BUILDING_BASE_ALPHA,
  WIDTH,
  WORLD_ENEMY_THEMES,
  WORLD_SEQUENCE,
  type CardKey,
  type EnemyRoleKey,
  type HeroClass,
} from './gameConfig';
import type {
  GeneratedSurroundAnchor,
  GeneratedSurroundLayer,
  ScreenFootprintBounds,
  PlayerOccluder,
  RunResumeBuildingSnapshot,
  RunResumeStateSnapshot,
} from './gameTypes';
import {
  GENERATED_SURROUND_PIECES,
} from './generatedSurroundConfig';
import { createGeneratedTextures } from './generatedTextures';
import { getWorldFogPieces, getWorldBackdropPieces, getWorldEdgeClusters } from './generatedWorldRenderData';
import { syncDevDiagnostics, consumeDevCommand, isDebugAutomationEnabled, getDebugAutomationHost, toDebugSlug, getDebugBuildingSummary, setDebugCommandResult, findDebugBuilding, teleportPlayerToDebugTarget, triggerDebugSeasonTransition } from './devCommands';
import { createUiPanelFrame, createTiledGameUiFrame, getGameUiFrameSize, createHorizontalSlicedFrame, createUiTitleBanner, fitUiTextToWidth, createFittedTitleText, createHudChip, createSharedCardBox, createUiButton, createUiText, debugTextStyle, uiTextStyle } from './uiFactory';
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
import { touchControlsCreate, setupMobileViewportHandlers, touchControlsUpdate, updateTouchClassActions } from './touchControls';
import { updateProjectiles as _updateProjectiles, destroyProjectile as _destroyProjectile, clearProjectiles as _clearProjectiles, fireEnemyProjectile as _fireEnemyProjectile } from './projectiles';
import { clearLevelTimers as _clearLevelTimers, addLevelTimer as _addLevelTimer, showCountdownLabel as _showCountdownLabel, scheduleLevelSpawns as _scheduleLevelSpawns, resetLevelRoundState as _resetLevelRoundState, buildCountdownSequence as _buildCountdownSequence, checkLevelClearCondition, getCurrentRoundTitle, getNextWorldProgressionState, calculateRoundReward } from './levelFlow';
import { pickWeighted as _pickWeighted, getEnemyArchetype as _getEnemyArchetype, getEnemyVariant as _getEnemyVariant, getEnemyDisplayName as _getEnemyDisplayName, getEnemyFrameKey as _getEnemyFrameKey, getWorldEliteVisual as _getWorldEliteVisual, getBossVisual as _getBossVisual } from './enemySpawning';
import { getNearestForestExit as _getNearestForestExit, getPathProgress as _getPathProgress, isRetreatComplete as _isRetreatComplete } from './enemyAI';
import { getFootprintCells as _getFootprintCells, getNearestDamagedBuilding as _getNearestDamagedBuilding } from './repairSystem';
import { isoToGridCell as _isoToGridCell, getGeneratedEdgeSpawnPoints as _getGeneratedEdgeSpawnPoints, getGeneratedFallbackSpawnAnchors as _getGeneratedFallbackSpawnAnchors, getGeneratedPlayableEdgeCells as _getGeneratedPlayableEdgeCells } from './generatedLevelSpawning';
import { getBuildingHealthColor as _getBuildingHealthColor, computeVillageSafety as _computeVillageSafety } from './buildingSystem';
import { spawnSparkleBurst as _spawnSparkleBurst, spawnSpellBloom as _spawnSpellBloom, spawnShieldGlow as _spawnShieldGlow, spawnRepairToolEffect as _spawnRepairToolEffect, updateEffects as _updateEffects } from './effects';
import { useMainAttack as _useMainAttack, useClassSkill as _useClassSkill, updateClassEffects as _updateClassEffects, getClassSkillConfig as _getClassSkillConfig, damageEnemy as _damageEnemy, removeEnemy as _removeEnemy } from './combat';
import { applyCardStats, chooseCardOffer, createEmptyCardTiers, percentageForTiers } from './progression';
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
const SPLASH_HERO_CARD_ART: Record<HeroClass, { texture: string; frame: string }> = {
  warrior: { texture: 'uiAtlas', frame: 'class_warrior_tile_01' },
  archer: { texture: 'uiAtlas', frame: 'class_archer_tile_01' },
  sorcerer: { texture: 'uiAtlas', frame: 'class_sorcerer_tile_01' },
};
const SPLASH_HERO_CARD_FILL_COLOR = 0xfff1b8;
const SPLASH_START_BUTTON_READY_FILL_ALPHA = 0.1;
const SPLASH_START_BUTTON_DISABLED_FILL_ALPHA = 0.035;
const SPLASH_START_BUTTON_DISABLED_TEXT_ALPHA = 0.45;
const PLAYER_ESCAPE_PROBE_DISTANCE = 0.12;
const PLAYER_ESCAPE_PROBE_STEPS = 5;
const PLAYER_MOVEMENT_TRACE_LIMIT = 12;
const GENERATED_CAMERA_FOLLOW_LERP = 0.075;
const GENERATED_CAMERA_HORIZONTAL_PADDING_RATIO = 0.2;
const GENERATED_CAMERA_VERTICAL_PADDING_RATIO = 0.18;
const AMBIENT_MIN_SPAWN_INTERVAL = 150;
const AMBIENT_BASE_SPAWN_INTERVAL = 360;

class FairyGuildScene extends Phaser.Scene {
  [key: string]: any;

  constructor() {
    super('fairy-guild');
    this.player = null;
    this.playerStats = { ...PLAYER_BASE };
    this.state = {
      health: PLAYER_BASE.maxHealth,
      gold: 0,
      level: 1,
      worldIndex: 0,
      worldKey: WORLD_SEQUENCE[0],
      worldRound: 1,
      bossRound: false,
      worldCycle: 0,
      phase: 'splash',
      villageSafety: 100,
      equipped: 'Sword Slash',
      gameOverReason: '',
    };
    this.heroClass = this.resolveRequestedHeroClass();
    this.heroAnimPrefix = 'hero';
    this.keys = {};
    this.enemies = [];
    this.projectiles = [];
    this.buildings = [];
    this.playerOccluders = [] as PlayerOccluder[];
    this.effects = [];
    this.notes = [];
    this.cardTiers = createEmptyCardTiers();
    this.levelUpChoices = [];
    this.lastSelectedCard = null as CardKey | null;
    this.lastOfferedCards = [] as CardKey[];
    this.runStats = { enemiesDefeated: 0 };
    this.traps = [];
    this.guardUntil = 0;
    this.magicShield = null;
    this.roundEnemyQueue = [];
    this.levelUpChoiceCards = [];
    this.lastPointerIso = { x: 7, y: 7 };
    this.lastPlayerSafeIso = null;
    this.lastPlayerMovementIntent = null;
    this.lastRejectedMovementReason = null;
    this.lastPlayerMovementResult = null;
    this.previousPlayerSlideScreen = null;
    this.playerMovementTrace = [];
    this.debugEnemiesFrozen = false;
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
    this.levelDebugLabels = [];
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
    this.autoSelectHero = false;
    this.preselectHero = false;
    this.parallaxSprites = [];
    this.worldCamera = null;
    this.uiCamera = null;
    this.cameraParallaxOrigin = null;
    this.ambientParticles = [];
    this.ambientParticlePreset = null;
    this.nextAmbientParticleAt = 0;
    this.audio = createAudioState();
  }

  init(data) {
    this.sceneVariantOverrideKey = data?.sceneVariantKey ?? null;
    this.forceFreshStart = Boolean(data?.forceFreshStart);
    this.resumeRunState = this.forceFreshStart ? null : data?.resumeRunState ?? null;
    this.resumeSkipSplash = !this.forceFreshStart && Boolean(data?.resumeSkipSplash);
    this.heroClass = data?.heroClass ?? data?.resumeRunState?.heroClass ?? this.resolveRequestedHeroClass();
    this.autoSelectHero = Boolean(data?.autoSelectHero);
    this.preselectHero = Boolean(data?.preselectHero);
  }

  preload() {
    this.load.image('villageBoard', '/assets/village-board.png');
    this.load.image('repairTool', '/assets/repair-tool.png');
    this.load.image('heroSheet', '/assets/hero-sheet.png');
    this.load.image('archerHeroSheet', '/assets/archer-hero-sheet.png');
    this.load.image('sorcererHeroSheet', '/assets/sorcerer-hero-sheet.png');
    this.load.image('princessHeroSheet', '/assets/princess-hero-sheet.png');
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
    if (this.textures.exists('archerHeroSheet')) {
      this.registerSheetFrames('archerHeroSheet', 8, 4, 'archer');
    }
    if (this.textures.exists('sorcererHeroSheet')) {
      this.registerSheetFrames('sorcererHeroSheet', 8, 4, 'sorcerer');
    }
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
    this.createCardProgression();
    this.createPhaseOverlays();
    this.setupGeneratedWorldCamera();
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
          this.updateVillageSafety();
          this.checkFailureState();
        }
      },
    });

    this.addGuildNote('The village is safe for now!');
    this.addGuildNote('Defeated enemies send their gold straight to your purse.');
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
      gold: 0,
      level: 1,
      worldIndex: 0,
      worldKey: WORLD_SEQUENCE[0],
      worldRound: 1,
      bossRound: false,
      worldCycle: 0,
      phase: 'splash',
      villageSafety: 100,
      equipped: 'Sword Slash',
      gameOverReason: '',
    };
    this.enemies = [];
    this.projectiles = [];
    this.buildings = [];
    this.playerOccluders = [] as PlayerOccluder[];
    this.effects = [];
    this.notes = [];
    this.cardTiers = createEmptyCardTiers();
    this.levelUpChoices = [];
    this.lastSelectedCard = null;
    this.lastOfferedCards = [];
    this.runStats = { enemiesDefeated: 0 };
    this.traps = [];
    this.guardUntil = 0;
    this.magicShield = null;
    this.roundEnemyQueue = [];
    this.lastPointerIso = { x: 7, y: 7 };
    this.lastPlayerSafeIso = null;
    this.lastPlayerMovementIntent = null;
    this.lastRejectedMovementReason = null;
    this.lastPlayerMovementResult = null;
    this.previousPlayerSlideScreen = null;
    this.playerMovementTrace = [];
    this.debugEnemiesFrozen = false;
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
    this.levelDebugLabels = [];
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
    this.parallaxSprites = [];
    this.worldCamera = null;
    this.uiCamera = null;
    this.cameraParallaxOrigin = null;
    this.ambientParticles = [];
    this.ambientParticlePreset = null;
    this.nextAmbientParticleAt = 0;
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.updatePointerIso();
    if (this.state.phase === 'playing') {
      this.updatePlayer(dt, time);
      if (!this.debugEnemiesFrozen) {
        this.updateEnemies(dt, time);
      }
      this.updateProjectiles(dt);
      this.updateClassEffects(time);
      this.checkLevelClear();
      this.checkFailureState();
    }
    this.updateEffects(dt);
    this.updateDepths();
    this.updateTouchControls();
    this.updateHud();
    this.updateDebugOverlay();
    this.updateGeneratedLevelDebug(time);
    this.updateCinematicParallax();
    this.updateSeasonalAmbientEffects(time);
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
    if (useGeneratedMap) {
      bg.fillStyle(sceneVariant.scenicFallbackColor, 1);
      bg.fillRect(-WIDTH, -HEIGHT, WIDTH * 3, HEIGHT * 3);
      this.backgroundLayer.add(bg);
      this.renderGeneratedScreenBackdropFill();
      return;
    }
    const topColor = useGeneratedMap ? 0xb2d9ec : 0x7fc8f4;
    const bottomColor = useGeneratedMap ? 0xe7f1ef : 0xd6f3ff;
    bg.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
    bg.fillRect(0, 0, WIDTH, HEIGHT);
    bg.fillStyle(sceneVariant.key === 'night_spring' ? 0x29345a : 0x67c176, useGeneratedMap ? 0.48 : 1);
    bg.fillEllipse(WIDTH / 2, 700, 1320, 316);
    this.backgroundLayer.add(bg);
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

  resolveRequestedHeroClass() {
    const raw = new URLSearchParams(window.location.search).get('heroClass') ?? new URLSearchParams(window.location.search).get('hero');
    if (raw === 'archer' || raw === 'sorcerer' || raw === 'warrior') {
      return raw as HeroClass;
    }
    return 'warrior';
  }

  getHeroConfig(heroClass = this.heroClass) {
    return HERO_CLASSES[heroClass as HeroClass] ?? HERO_CLASSES.warrior;
  }

  getHeroProfile(heroClass = this.heroClass) {
    const archer = heroClass === 'archer' && this.textures.exists('archerHeroSheet');
    const sorcerer = heroClass === 'sorcerer' && this.textures.exists('sorcererHeroSheet');
    const legacySorcerer = heroClass === 'sorcerer' && !sorcerer && this.textures.exists('princessHeroSheet');
    return {
      heroClass: heroClass as HeroClass,
      label: this.getHeroConfig(heroClass).label,
      sheetKey: archer ? 'archerHeroSheet' : sorcerer ? 'sorcererHeroSheet' : legacySorcerer ? 'princessHeroSheet' : 'heroSheet',
      framePrefix: archer ? 'archer' : sorcerer ? 'sorcerer' : legacySorcerer ? 'princess' : 'hero',
      animPrefix: `${heroClass}-hero`,
      tint: heroClass === 'archer' && !archer ? 0xb6ed9a : legacySorcerer ? 0xcfe7ff : null,
      displaySize: [76, 76] as [number, number],
      origin: [0.5, 0.76] as [number, number],
    };
  }

  getHeroAnimationKey(action, heroClass = this.heroClass) {
    return `${this.getHeroProfile(heroClass).animPrefix}-${action}`;
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

  applyHeroClass(heroClass, options: { announce?: boolean; restartIdle?: boolean } = {}) {
    const { announce = false, restartIdle = true } = options;
    const profile = this.getHeroProfile(heroClass);
    this.heroClass = profile.heroClass;
    this.playerStats = applyCardStats(this.heroClass, this.cardTiers);
    this.state.health = this.state.phase === 'splash'
      ? this.playerStats.maxHealth
      : Math.min(this.state.health || this.playerStats.maxHealth, this.playerStats.maxHealth);
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
      if (profile.tint) {
        this.player.sprite.setTint(profile.tint);
      } else {
        this.player.sprite.clearTint();
      }
      if (restartIdle || !this.player.sprite.anims.currentAnim) {
        this.player.sprite.play(`${profile.animPrefix}-idle`, true);
      }
    }
    if (announce) {
      this.addGuildNote(`${profile.label} is ready to defend the village!`);
    }
    updateTouchClassActions(this as any);
    this.updateSplashHeroChoiceUi?.();
    return profile;
  }

  selectHeroClass(heroClass) {
    this.pendingHeroClass = heroClass;
    this.applyHeroClass(heroClass, { announce: false, restartIdle: true });
    this.updateSplashHeroChoiceUi();
  }

  updateSplashHeroChoiceUi() {
    const activeChoice = this.pendingHeroClass ?? null;
    (['warrior', 'archer', 'sorcerer'] as HeroClass[]).forEach((choice) => {
      const card = this.splashHeroCards?.[choice];
      if (!card) {
        return;
      }
      const selected = activeChoice === choice;
      card.setSelected(selected);
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
          ? `Chosen hero: ${this.getHeroConfig(activeChoice).label}`
          : 'Choose your hero before you begin.',
      );
    }
  }

  restartGameFromBeginning() {
    this.scene.restart({ forceFreshStart: true });
  }

  restartSameClass() {
    this.scene.restart({ forceFreshStart: true, heroClass: this.heroClass, autoSelectHero: true });
  }

  chooseNewHero() {
    this.scene.restart({ forceFreshStart: true, heroClass: this.heroClass, preselectHero: true });
  }

  updateCinematicParallax() {
    updateCinematicParallax(this);
  }

  setupGeneratedWorldCamera() {
    if (!this.generatedLevelActive || !this.generatedLevel || !this.player?.sprite) {
      return;
    }
    const variant = this.getActiveSceneVariant();
    const bounds = this.getGeneratedCameraBounds();
    if (!bounds) {
      return;
    }
    this.worldCamera = this.cameras.main;
    this.worldCamera
      .setBackgroundColor(variant.scenicFallbackColor)
      .setZoom(variant.cameraZoom)
      .setBounds(bounds.x, bounds.y, bounds.width, bounds.height)
      .centerOn(this.player.sprite.x, this.player.sprite.y)
      .startFollow(this.player.sprite, true, GENERATED_CAMERA_FOLLOW_LERP, GENERATED_CAMERA_FOLLOW_LERP);
    this.worldCamera.ignore([this.hudLayer, this.touchLayer]);
    this.cameraParallaxOrigin = { x: this.player.sprite.x, y: this.player.sprite.y };

    this.uiCamera = this.cameras.add(0, 0, WIDTH, HEIGHT, false, 'ui-camera');
    this.uiCamera.ignore([
      this.backgroundLayer,
      this.shadowLayer,
      this.terrainBaseLayer,
      this.edgeLayer,
      this.waterLayer,
      this.decorLayer,
      this.buildingLayer,
      this.characterLayer,
      this.effectsLayer,
      this.levelDebugLayer,
      this.lightingLayer,
    ]);
  }

  updateSeasonalAmbientEffects(time) {
    if (!this.generatedLevelActive || !this.lightingLayer) {
      return;
    }
    const ambient = this.getActiveSceneVariant().ambientEffect;
    if (this.ambientParticlePreset !== ambient.preset) {
      this.ambientParticles.forEach((particle) => particle.destroy());
      this.ambientParticles = [];
      this.ambientParticlePreset = ambient.preset;
      this.nextAmbientParticleAt = 0;
    }
    if (this.state.phase !== 'playing' || time < this.nextAmbientParticleAt) {
      return;
    }
    this.ambientParticles = this.ambientParticles.filter((particle) => particle.active);
    if (this.ambientParticles.length < ambient.maxParticles) {
      this.spawnSeasonalAmbientParticle(ambient.preset, ambient.intensity);
    }
    this.nextAmbientParticleAt = time + Math.max(
      AMBIENT_MIN_SPAWN_INTERVAL,
      AMBIENT_BASE_SPAWN_INTERVAL / ambient.intensity,
    );
  }

  spawnSeasonalAmbientParticle(preset, intensity) {
    const particle = this.add.graphics().setDepth(4708).setScrollFactor(0);
    const startX = Phaser.Math.Between(-30, WIDTH + 30);
    const startY = Phaser.Math.Between(-30, Math.floor(HEIGHT * 0.42));
    const travel = { x: 0, y: HEIGHT * 0.7 };
    let duration = Phaser.Math.Between(4600, 6700);
    switch (preset) {
      case 'summer_rain':
        particle.lineStyle(2, 0xffedc7, 0.2 * intensity);
        particle.lineBetween(0, 0, -9, 25);
        travel.x = -110;
        travel.y = HEIGHT * 0.85;
        duration = Phaser.Math.Between(1600, 2400);
        break;
      case 'autumn_leaves':
        particle.fillStyle(0xe69a54, 0.46 * intensity);
        particle.fillEllipse(0, 0, 11, 6);
        travel.x = Phaser.Math.Between(-68, 48);
        travel.y = HEIGHT * 0.76;
        break;
      case 'winter_snow':
        particle.fillStyle(0xffffff, 0.48 * intensity);
        particle.fillCircle(0, 0, Phaser.Math.Between(2, 4));
        travel.x = Phaser.Math.Between(-22, 22);
        travel.y = HEIGHT * 0.64;
        duration = Phaser.Math.Between(5900, 8400);
        break;
      case 'spring_petals':
      default:
        particle.fillStyle(0xf7c9e0, 0.5 * intensity);
        particle.fillEllipse(0, 0, 10, 6);
        travel.x = Phaser.Math.Between(-40, 56);
        travel.y = HEIGHT * 0.72;
        break;
    }
    particle.setPosition(startX, startY);
    this.lightingLayer.add(particle);
    this.ambientParticles.push(particle);
    this.tweens.add({
      targets: particle,
      x: startX + travel.x,
      y: startY + travel.y,
      rotation: Phaser.Math.FloatBetween(-1.5, 1.5),
      alpha: 0,
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => particle.destroy(),
    });
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
        gold: this.state.gold,
        level: this.state.level,
        villageSafety: 100,
        equipped: this.state.equipped,
        gameOverReason: '',
        ...nextProgression,
      },
      buildings: this.buildings.map((building) => ({
        id: building.levelPlacementId,
        name: building.name,
        hp: building.hp,
        max: building.max,
      })),
      heroClass: this.heroClass,
      cardTiers: { ...this.cardTiers },
      lastSelectedCard: this.lastSelectedCard,
      lastOfferedCards: [...this.lastOfferedCards],
      runStats: { ...this.runStats },
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
    if (this.resumeRunState.heroClass) {
      this.heroClass = this.resumeRunState.heroClass;
    }
    if (this.resumeRunState.state) {
      this.state = { ...this.state, ...this.resumeRunState.state, phase: 'countdown' };
    }
    if (this.resumeRunState.cardTiers) {
      this.cardTiers = { ...this.cardTiers, ...this.resumeRunState.cardTiers };
    }
    this.lastSelectedCard = (this.resumeRunState.lastSelectedCard as CardKey | null) ?? null;
    this.lastOfferedCards = (this.resumeRunState.lastOfferedCards as CardKey[] | undefined) ?? [];
    this.runStats = { ...this.runStats, ...this.resumeRunState.runStats };
    this.playerStats = applyCardStats(this.heroClass, this.cardTiers);
    const buildingMap = new Map<string, RunResumeBuildingSnapshot>(
      (this.resumeRunState.buildings ?? []).map((building) => [building.id ?? building.name, building] as const),
    );
    this.buildings.forEach((building) => {
      const snapshot = buildingMap.get(building.levelPlacementId ?? building.name) ?? buildingMap.get(building.name);
      if (!snapshot) {
        return;
      }
      building.max = snapshot.max ?? building.max;
      building.hp = Math.max(0, Math.min(snapshot.hp, building.max));
      this.updateBuildingRepairState(building);
    });
    this.applyReinforcedWallHealth();
    if (this.resumeRunState.note) {
      this.addGuildNote(this.resumeRunState.note);
    }
    this.updateVillageSafety();
  }

  applyReinforcedWallHealth() {
    const multiplier = percentageForTiers('reinforcedWalls', this.cardTiers.reinforcedWalls);
    this.buildings.forEach((building) => {
      building.baseMax = building.baseMax ?? building.max;
      const desiredMax = Math.round(building.baseMax * (1 + multiplier));
      const gained = Math.max(0, desiredMax - building.max);
      building.max = desiredMax;
      building.hp = Math.min(building.max, building.hp + gained);
      this.updateBuildingRepairState(building);
    });
  }

  applyLevelUpCard(choice) {
    this.lastSelectedCard = choice.key;
    if (choice.key === 'magicRepair') {
      this.buildings.filter((building) => building.hp > 0).forEach((building) => {
        building.hp = building.max;
        this.updateBuildingRepairState(building);
      });
      this.addGuildNote('Magic Repair restored every standing building!');
      return;
    }
    this.cardTiers[choice.key] += 1;
    if (choice.key === 'reinforcedWalls') {
      this.applyReinforcedWallHealth();
    }
    const previousMaxHealth = this.playerStats.maxHealth;
    this.playerStats = applyCardStats(this.heroClass, this.cardTiers);
    if (choice.key === 'toughHeart') {
      this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + (this.playerStats.maxHealth - previousMaxHealth));
    }
    this.addGuildNote(`${choice.label} ${this.cardTiers[choice.key]} chosen!`);
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

  getGeneratedCameraBounds() {
    const { tileW, tileH } = this.getIsoMetrics();
    const board = this.getGeneratedWorldBounds(tileW, tileH);
    if (!board) {
      return null;
    }
    const zoom = this.getActiveSceneVariant().cameraZoom;
    const visibleWidth = WIDTH / zoom;
    const visibleHeight = HEIGHT / zoom;
    const horizontalPadding = visibleWidth * GENERATED_CAMERA_HORIZONTAL_PADDING_RATIO;
    const verticalPadding = visibleHeight * GENERATED_CAMERA_VERTICAL_PADDING_RATIO;
    return new Phaser.Geom.Rectangle(
      board.left.x - horizontalPadding,
      board.top.y - verticalPadding,
      Math.max(visibleWidth, board.right.x - board.left.x + horizontalPadding * 2),
      Math.max(visibleHeight, board.bottom.y - board.top.y + verticalPadding * 2),
    );
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

  registerPlayerOccluder(occluder: PlayerOccluder) {
    this.playerOccluders.push(occluder);
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
    const profile = this.getHeroProfile(this.heroClass);
    this.ensureHeroAnimations(profile);
    this.player = {
      iso: { x: playerSpawn.x, y: playerSpawn.y },
      facing: { x: 0, y: 1 },
      lastAttack: 0,
      lastSkill: -99999,
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
    if (profile.tint) {
      this.player.sprite.setTint(profile.tint);
    }
    this.player.sprite.play(`${profile.animPrefix}-idle`);
    this.entityLayer.add([this.player.shadow, this.player.sprite]);
    this.recoverPlayerToSafeAnchor(true);
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
      mainAttack: Phaser.Input.Keyboard.KeyCodes.SPACE,
      skill: Phaser.Input.Keyboard.KeyCodes.F,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
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
        this.useMainAttack(this.time.now, this.lastPointerIso);
      }
    });
    this.input.keyboard.on('keydown', () => this.ensureAudio());
    this.keys.mainAttack.on('down', () => {
      if (this.state.phase === 'splash') {this.startGameFromSplash();}
    });
    this.keys.start.on('down', () => {
      if (this.state.phase === 'splash') {this.startGameFromSplash();}
    });
    this.keys.interact.on('down', () => {
      this.tryRepairBuilding();
    });
    [this.keys.one, this.keys.two, this.keys.three, this.keys.four, this.keys.five, this.keys.six].forEach((key, index) => {
      key.on('down', () => {
        if (this.state.phase === 'levelUp' && index < 2) {
          this.chooseLevelUpgrade(index);
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

  getScreenMovementVector() {
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
    const pointer = this.input.activePointer;
    const worldPoint = this.generatedLevelActive && this.worldCamera
      ? this.worldCamera.getWorldPoint(pointer.x, pointer.y)
      : { x: pointer.x, y: pointer.y };
    this.lastPointerIso = this.clampIso(this.screenToIso(worldPoint.x, worldPoint.y), 0.1);
  }

  isPlayerFootprintWalkable(point) {
    return this.isGeneratedIsoWalkable(point);
  }

  isPlayerRecoveryAnchor(point) {
    if (!this.generatedLevelActive || !this.generatedLevel) {
      return true;
    }
    return this.isPlayerFootprintWalkable(point)
      && isPlayerSafeCell(this.generatedLevel.playerReachableGrid, point);
  }

  rememberPlayerSafePosition() {
    if (this.player && this.isPlayerFootprintWalkable(this.player.iso)) {
      this.lastPlayerSafeIso = { ...this.player.iso };
    }
  }

  recoverPlayerToSafeAnchor(requireRecoveryAnchor = false, forceNearest = false) {
    const isValidPosition = (point) => (
      requireRecoveryAnchor ? this.isPlayerRecoveryAnchor(point) : this.isPlayerFootprintWalkable(point)
    );
    if (!this.player || (!forceNearest && isValidPosition(this.player.iso))) {
      this.rememberPlayerSafePosition();
      return false;
    }
    const previous = this.lastPlayerSafeIso;
    if (!forceNearest && previous && isValidPosition(previous)) {
      this.player.iso = { ...previous };
      return true;
    }
    const nearest = this.generatedLevelActive && this.generatedLevel
      ? findNearestPlayerSafeCell(this.generatedLevel.playerReachableGrid, this.player.iso)
      : null;
    if (nearest) {
      this.player.iso = nearest;
      this.rememberPlayerSafePosition();
      return true;
    }
    if (previous) {
      this.player.iso = { ...previous };
      return true;
    }
    return false;
  }

  getSustainedPlayerEscapeDirections() {
    if (!this.player) {
      return [];
    }
    const metrics = this.getIsoMetrics();
    return Object.entries(SCREEN_ESCAPE_DIRECTIONS)
      .filter(([, direction]) => probeScreenSpaceEscape(
        this.player.iso,
        direction,
        metrics,
        PLAYER_ESCAPE_PROBE_DISTANCE,
        PLAYER_ESCAPE_PROBE_STEPS,
        (candidate) => this.isPlayerFootprintWalkable(candidate),
      ).escaped)
      .map(([label]) => label);
  }

  recordPlayerMovementTrace(result) {
    if (!(import.meta.env.DEV || isDebugAutomationEnabled())) {
      return;
    }
    this.playerMovementTrace.push({
      position: { ...this.player.iso },
      intendedScreen: { ...result.intendedScreen },
      intendedIso: { ...result.intendedIso },
      selectedScreen: result.selectedScreen ? { ...result.selectedScreen } : null,
      reason: result.reason,
      blocked: result.blocked,
    });
    this.playerMovementTrace = this.playerMovementTrace.slice(-PLAYER_MOVEMENT_TRACE_LIMIT);
  }

  getPlayerMovementDebugState() {
    if (!this.player) {
      return null;
    }
    const escapeDirections = this.getSustainedPlayerEscapeDirections();
    return {
      footprintWalkable: this.isPlayerFootprintWalkable(this.player.iso),
      recoveryAnchor: this.isPlayerRecoveryAnchor(this.player.iso),
      escapeDirections,
      runtimeDeadEnd: escapeDirections.length === 0 && this.isPlayerFootprintWalkable(this.player.iso),
      activeIntent: this.lastPlayerMovementIntent,
      movementResult: this.lastPlayerMovementResult,
      rejectedReason: this.lastRejectedMovementReason,
    };
  }

  getPlayerOcclusionDebugState() {
    const active = this.playerOccluders.filter((occluder) => occluder.occluding);
    return {
      registered: this.playerOccluders.length,
      activeLabels: active.map((occluder) => `${occluder.label} (${occluder.category})`),
    };
  }

  updatePlayer(dt, time) {
    if (this.state.health <= 0) {return;}
    const screenMovement = this.getScreenMovementVector();
    const moving = screenMovement.x !== 0 || screenMovement.y !== 0;
    if (moving) {
      const metrics = this.getIsoMetrics();
      const movement = screenDirectionToIsoMovement(screenMovement, metrics);
      this.player.facing = { ...movement };
      this.lastPlayerMovementIntent = { screen: { ...screenMovement }, iso: { ...movement } };
      const result = resolveScreenSpacePlayerMovement(
        this.player.iso,
        screenMovement,
        metrics,
        this.playerStats.speed * dt,
        (candidate) => {
          this.clampIso(candidate, 1.2);
          return this.isPlayerFootprintWalkable(candidate);
        },
        this.previousPlayerSlideScreen,
      );
      this.player.iso = result.position;
      this.clampIso(this.player.iso, 1.2);
      this.lastPlayerMovementResult = result;
      this.lastRejectedMovementReason = result.blocked ? result.reason : null;
      this.previousPlayerSlideScreen = result.reason?.endsWith('-slide') ? result.selectedScreen : null;
      this.rememberPlayerSafePosition();
      this.recordPlayerMovementTrace(result);
      if (result.blocked && this.getSustainedPlayerEscapeDirections().length === 0) {
        this.recoverPlayerToSafeAnchor(true, true);
      }
    } else {
      this.lastPlayerMovementIntent = null;
      this.previousPlayerSlideScreen = null;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.mainAttack)) {
      this.useMainAttack(time, this.lastPointerIso);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.skill)) {
      this.useClassSkill(time);
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

  useMainAttack(time, targetIso = this.lastPointerIso) {
    _useMainAttack(this as any, time, targetIso);
  }

  useClassSkill(time) {
    _useClassSkill(this as any, time);
  }

  getSkillConfig() {
    return _getClassSkillConfig(this as any);
  }

  updateClassEffects(time) {
    _updateClassEffects(this as any, time);
  }

  createCardProgression() {
    this.cardTiers = this.cardTiers ?? createEmptyCardTiers();
  }

  getFootprintCells(x, y, footprint = { w: 1, h: 1 }) {
    return _getFootprintCells(x, y, footprint);
  }

  getNearestDamagedBuilding(range = REPAIR_RANGE) {
    return _getNearestDamagedBuilding(this.buildings, this.player?.iso ?? null, (x, y, f) => this.getFootprintCells(x, y, f), range);
  }

  tryRepairBuilding() {
    if (this.state.phase !== 'playing') {return;}
    this.ensureAudio();
    if (this.time.now - this.lastRepairAt < REPAIR_COOLDOWN) {return;}
    const building = this.getNearestDamagedBuilding();
    if (!building) {
      this.addGuildNote('No building close enough yet.');
      this.playTone('hit');
      return;
    }
    if (this.state.gold < REPAIR_COST) {
      this.addGuildNote(`Repair supplies need ${REPAIR_COST} gold.`);
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
    this.setMusicSoftened(false);
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
    _resetLevelRoundState(this as any, level, isBossRound, this.heroClass);
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
      this.addGuildNote('Tip: press E or Repair near damaged buildings.');
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
    )) {
      this.levelClearQueued = true;
      this.addLevelTimer(720, () => this.completeLevel());
    }
  }

  completeLevel() {
    if (this.state.phase !== 'playing') {return;}
    this.state.phase = 'levelUp';
    this.clearProjectiles();
    this.clearRetreatingEnemies();
    const bossConfig = BOSS_CONFIGS[this.state.worldKey as SeasonPreset];
    const reward = calculateRoundReward(this.state.bossRound, this.state.level, this.state.worldCycle, this.state.worldKey);
    this.state.gold += reward.gold;
    this.addGuildNote(
      this.state.bossRound
        ? `${bossConfig.name} defeated! +${reward.gold} gold`
        : `Level ${this.state.level} clear! +${reward.gold} gold`,
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

  selectGeneratedEnemyRoute(startIso, preferredTarget = null) {
    const choices = this.getGeneratedRouteScores(startIso);
    if (!choices.length) {
      return null;
    }
    const preferred = preferredTarget ? choices.find((choice) => choice.building === preferredTarget) : null;
    const best = preferred ?? choices.reduce((winner, choice) => (choice.score > winner.score ? choice : winner), choices[0]);
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

  getEnemyArchetype(role: EnemyRoleKey) {
    return _getEnemyArchetype(role);
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

  spawnRoundEnemy(level, role: EnemyRoleKey | 'boss' = 'sproutling') {
    return role === 'boss' || this.state.bossRound ? this.spawnBossEnemy(level) : this.spawnEnemy(level, role);
  }

  spawnEnemy(level, role: EnemyRoleKey = 'sproutling') {
    if (this.state.phase !== 'playing') {return false;}
    let route = null;
    const weakestBuilding = role === 'leafSneak'
      ? this.buildings.filter((building) => building.hp > 0).sort((a, b) => (a.hp / a.max) - (b.hp / b.max))[0]
      : null;
    let target = weakestBuilding ?? this.getEnemyTarget();
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
        route = this.selectGeneratedEnemyRoute(iso, weakestBuilding);
        if (route) {
          break;
        }
      }
      if (!route) {
        const refreshedCandidates = this.buildGeneratedSpawnCache();
        for (const spawn of refreshedCandidates) {
          iso = this.jitterGeneratedSpawnPoint(spawn);
          route = this.selectGeneratedEnemyRoute(iso, weakestBuilding);
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
    const archetype = this.getEnemyArchetype(role);
    const variant = this.getEnemyVariant(level);
    const visual = { frameSheetKey: 'monsterSheet', framePrefix: 'monster', frameRow: archetype.row, tint: variant.tint };
    const p = this.isoToScreen(iso.x, iso.y, 16);
    const levelBonus = Math.max(0, level - 1);
    const size = (archetype.size + Math.min(levelBonus, 6) * 1.4) * variant.scale;
    const maxHp = Math.max(1, Math.round((archetype.hp + Math.floor(levelBonus / 2)) * variant.hp));
    const speed = Math.min(1.72, (archetype.speed + levelBonus * 0.035) * variant.speed);
    const buildingDamage = Math.max(1, Math.round((archetype.buildingDamage + Math.floor(levelBonus / 3)) * variant.buildingDamage));
    const contactDamage = Math.max(1, Math.round(archetype.contactDamage * variant.contactDamage));
    const displayScaleX = 1;
    const displayScaleY = 1;
    const shadow = this.add.ellipse(p.x, p.y + 13, size * displayScaleX * 0.42, size * displayScaleY * 0.22, 0x315133, 0.2);
    const frameRow = visual.frameRow ?? archetype.row;
    const framePrefix = visual.framePrefix ?? 'monster';
    const idleFrames = [0, 1, 2, 3];
    const initialFrame = Phaser.Utils.Array.GetRandom(idleFrames);
    const defeatFrame = 7;
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
      slowedUntil: 0,
      ward: 0,
      specialCooldown: 0,
    };
    this.enemies.push(enemy);
    this.levelSpawnedCount += 1;
    this.entityLayer.add([shadow, sprite]);
    if (target.name === 'Bakery' && archetype.key === 'mushroomBrute' && Phaser.Math.Between(0, 2) === 0) {
      this.addGuildNote('A Mushroom Brute is heading toward the bakery!');
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
    const maxHp = Math.round((bossConfig.hp + levelBonus * 3 + this.state.worldIndex * 3 + this.state.worldCycle * 8) * BOSS_HEALTH_MULTIPLIER);
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
      slowedUntil: 0,
      ward: 0,
      specialCooldown: 0,
    };
    this.enemies.push(enemy);
    this.levelSpawnedCount += 1;
    this.entityLayer.add([shadow, sprite]);
    this.addGuildNote(theme.bossIntro);
    return true;
  }

  updateEnemies(dt, time) {
    this.enemies.slice().forEach((enemy) => {
      if (enemy.archetype.key === 'leafSneak' && !enemy.retreating) {
        const weakest = this.buildings
          .filter((building) => building.hp > 0)
          .sort((a, b) => (a.hp / a.max) - (b.hp / b.max))[0];
        if (weakest && weakest !== enemy.target) {
          if (this.generatedLevelActive) {
            const route = this.selectGeneratedEnemyRoute(enemy.iso, weakest);
            if (route) {
              enemy.target = route.target;
              enemy.path = route.pathIso;
              enemy.pathIndex = route.pathIso.length > 1 ? 1 : 0;
            }
          } else {
            enemy.target = weakest;
          }
        }
      }
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
      const buildingDistance = Phaser.Math.Distance.Between(enemy.iso.x, enemy.iso.y, enemy.target.iso.x, enemy.target.iso.y);
      const isRangedAttacker = enemy.isBoss || enemy.archetype.key === 'spitter';
      if (!enemy.retreating && isRangedAttacker && buildingDistance <= (enemy.isBoss ? 8 : 5) && buildingDistance > 0.55) {
        const cooldown = enemy.isBoss ? BOSS_PROJECTILE_COOLDOWN : 2600;
        if (time >= enemy.specialCooldown) {
          enemy.specialCooldown = time + cooldown;
          const target = enemy.target;
          this.spawnSparkleBurst(enemy.sprite.x, enemy.sprite.y - 36, enemy.isBoss ? 0xffbd7a : 0x9fe98d, enemy.isBoss ? 12 : 7, enemy.isBoss ? 0.82 : 0.56);
          this.time.delayedCall(enemy.isBoss ? 360 : 240, () => {
            if (this.state.phase === 'playing' && !enemy.defeated && !enemy.retreating && target.hp > 0) {
              _fireEnemyProjectile(this as any, enemy, target, enemy.isBoss ? BOSS_PROJECTILE_DAMAGE : 3, enemy.isBoss ? 'guardian' : 'spit');
            }
          });
        }
      }
      if (!enemy.retreating && enemy.archetype.key === 'wispMage' && time >= enemy.specialCooldown) {
        enemy.specialCooldown = time + 4000;
        const ally = this.enemies.find((candidate) => candidate !== enemy && !candidate.defeated && !candidate.retreating
          && Phaser.Math.Distance.Between(candidate.iso.x, candidate.iso.y, enemy.iso.x, enemy.iso.y) < 3);
        if (ally) {
          ally.ward = 2;
          this.spawnSparkleBurst(ally.sprite.x, ally.sprite.y - 20, 0xa8f3ff, 8, 0.55);
        }
      }
      let targetIso = enemy.retreating ? this.getNearestForestExit(enemy.iso) : enemy.target.iso;
      if (!enemy.retreating && enemy.path?.length) {
        const progress = _getPathProgress(enemy.path, enemy.pathIndex, enemy.iso, 0.38);
        enemy.pathIndex = progress.pathIndex;
        targetIso = progress.targetIso;
      }
      const dist = Phaser.Math.Distance.Between(enemy.iso.x, enemy.iso.y, targetIso.x, targetIso.y);
      const holdsRange = isRangedAttacker && buildingDistance <= (enemy.isBoss ? 8 : 5) && buildingDistance > 0.55;
      const slowedFactor = time < (enemy.slowedUntil ?? 0) ? 0.55 : 1;
      if (time > enemy.dazedUntil && dist > 0.35 && !holdsRange) {
        const vx = (targetIso.x - enemy.iso.x) / dist;
        const vy = (targetIso.y - enemy.iso.y) / dist;
        enemy.iso.x += vx * enemy.speed * slowedFactor * dt * (enemy.retreating ? 1.8 : 1);
        enemy.iso.y += vy * enemy.speed * slowedFactor * dt * (enemy.retreating ? 1.8 : 1);
        enemy.sprite.setFlipX(vx < -0.02);
      }
      const reachedAttackZone = !enemy.path?.length || enemy.pathIndex >= enemy.path.length - 1;
      if (!enemy.retreating && reachedAttackZone && dist <= 0.45 && time > enemy.touchCooldown) {
        enemy.touchCooldown = time + 1250;
        this.damageProtectedBuilding(enemy.target, enemy.buildingDamage);
        this.playTone('hit');
        if (enemy.archetype.key === 'bombBud') {
          enemy.defeated = true;
          enemy.retreating = true;
          if (!enemy.countedDefeat) {
            enemy.countedDefeat = true;
            this.levelDefeatsThisRound += 1;
            this.levelEnemiesRemaining = Math.max(0, this.levelRequiredDefeats - this.levelDefeatsThisRound);
          }
          this.spawnSparkleBurst(enemy.sprite.x, enemy.sprite.y - 18, 0xffb56c, 16, 0.9);
          this.checkLevelClear();
        }
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

  setMagicShield(shield) {
    if (this.magicShield?.sprite) {
      this.magicShield.sprite.destroy();
    }
    const targetSprite = shield.isBuilding ? shield.target.sprite : this.player.sprite;
    const sprite = this.add.image(targetSprite.x, targetSprite.y - 20, 'effectsAtlas', 'magic_shield_field_01')
      .setDisplaySize(shield.isBuilding ? 108 : 78, shield.isBuilding ? 108 : 78)
      .setAlpha(0.84)
      .setDepth(targetSprite.depth + 22);
    this.fxLayer.add(sprite);
    this.magicShield = { ...shield, sprite };
  }

  updateMagicShield(time) {
    if (!this.magicShield) {
      return;
    }
    const expired = time >= this.magicShield.expiresAt || this.magicShield.hp <= 0;
    if (expired) {
      if (this.heroClass === 'sorcerer' && this.state.level >= 9) {
        const origin = this.magicShield.isBuilding ? this.magicShield.target.iso : this.player.iso;
        this.enemies.forEach((enemy) => {
          const dx = enemy.iso.x - origin.x;
          const dy = enemy.iso.y - origin.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 2 && distance > 0) {
            enemy.iso.x += (dx / distance) * 0.5;
            enemy.iso.y += (dy / distance) * 0.5;
          }
        });
      }
      this.magicShield.sprite.destroy();
      this.magicShield = null;
      return;
    }
    const targetSprite = this.magicShield.isBuilding ? this.magicShield.target.sprite : this.player.sprite;
    this.magicShield.sprite.setPosition(targetSprite.x, targetSprite.y - 20);
  }

  damageProtectedBuilding(building, amount) {
    if (this.magicShield?.isBuilding && this.magicShield.target === building && this.time.now < this.magicShield.expiresAt) {
      const blocked = Math.min(amount, this.magicShield.hp);
      this.magicShield.hp -= blocked;
      amount -= blocked;
      this.spawnSparkleBurst(building.sprite.x, building.sprite.y - 28, 0x9be7ff, 8, 0.55);
    }
    if (amount > 0) {
      this.bumpBuilding(building, amount);
    }
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
    if (this.magicShield && !this.magicShield.isBuilding && this.time.now < this.magicShield.expiresAt) {
      const blocked = Math.min(amount, this.magicShield.hp);
      this.magicShield.hp -= blocked;
      amount -= blocked;
      if (amount <= 0) {
        this.spawnSparkleBurst(this.player.sprite.x, this.player.sprite.y - 28, 0x9be7ff, 8, 0.55);
        return;
      }
    }
    if (this.heroClass === 'warrior' && this.time.now < this.guardUntil) {
      amount = Math.max(0.5, amount * 0.5);
    }
    this.state.health = Math.max(0, this.state.health - amount);
    this.player.invulnerableUntil = this.time.now + 1650;
    if (enemy) {
      const dx = this.player.iso.x - enemy.iso.x;
      const dy = this.player.iso.y - enemy.iso.y;
      const len = Math.max(0.01, Math.hypot(dx, dy));
      this.player.iso.x += (dx / len) * 0.28;
      this.player.iso.y += (dy / len) * 0.28;
      this.clampIso(this.player.iso, 1.2);
      this.recoverPlayerToSafeAnchor(true);
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
    this.countdownOverlay?.setVisible(false);
    this.levelUpOverlay?.setVisible(false);
    this.clearLevelTimers();
    this.clearProjectiles();
    this.showGameOverScreen(reason);
    this.setMusicSoftened(true);
    this.playTone('gameOver');
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
    const playerBounds = this.player.sprite.getBounds();
    this.playerOccluders.forEach((occluder) => {
      const footprintBounds = occluder.footprintCells?.length
        ? this.getFootprintScreenBounds(occluder.footprintCells)
        : undefined;
      occluder.occluding = isPlayerOccludedByScenery({
        playerBounds,
        playerDepth: this.player.sprite.depth,
        occluderBounds: occluder.sprite.getBounds(),
        occluderDepth: occluder.sprite.depth,
        footprintBounds,
      });
      occluder.sprite.setAlpha(getPlayerOccluderAlpha(occluder.baseAlpha, occluder.occluding));
    });
    this.enemies.forEach((enemy) => {
      enemy.shadow.setDepth(enemy.sprite.y + 5);
      enemy.sprite.setDepth(enemy.sprite.y + 70);
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
    const panelHeight = compact ? 552 : 576;
    return {
      compact,
      panelWidth: compact ? 820 : 880,
      panelHeight,
      offsetY: this.getOverlayContentOffset(panelHeight),
      decorScale: compact ? 0.48 : 0.54,
      titleY: compact ? -212 : -224,
      titleWidth: compact ? 470 : 520,
      titleTextWidth: compact ? 392 : 440,
      titleHeight: compact ? 54 : 58,
      titleSize: compact ? 26 : 28,
      titleMinSize: compact ? 20 : 22,
      creditY: compact ? -172 : -182,
      promptY: compact ? -139 : -148,
      choiceY: compact ? -111 : -118,
      cardY: compact ? 32 : 38,
      cardX: compact ? 206 : 222,
      cardWidth: compact ? 160 : 172,
      cardHeight: compact ? 252 : 270,
      artY: compact ? -55 : -59,
      artSize: compact ? 150 : 162,
      captionY: compact ? 38 : 42,
      detailY: compact ? 65 : 71,
      startY: compact ? 218 : 236,
      startWidth: compact ? 230 : 242,
      startHeight: compact ? 50 : 52,
    };
  }

  getLevelUpOverlayLayout() {
    const compact = this.isCompactOverlayLayout();
    const panelHeight = compact ? 492 : 520;
    return {
      compact,
      panelWidth: compact ? 720 : 780,
      panelHeight,
      offsetY: this.getOverlayContentOffset(panelHeight),
      decorScale: compact ? 0.48 : 0.54,
      titleY: compact ? -188 : -200,
      titleWidth: compact ? 360 : 390,
      titleTextWidth: compact ? 292 : 318,
      titleHeight: compact ? 66 : 72,
      titleSize: compact ? 30 : 32,
      titleMinSize: compact ? 21 : 23,
      rewardY: compact ? -143 : -154,
      helperY: compact ? -116 : -126,
      cardY: compact ? 36 : 42,
      cardXScale: compact ? 0.88 : 0.94,
      cardWidth: compact ? 166 : 178,
      cardHeight: compact ? 258 : 278,
      iconY: compact ? -56 : -62,
      iconSize: compact ? 116 : 124,
      badgeX: compact ? 52 : 57,
      badgeY: compact ? -98 : -107,
      labelY: compact ? 39 : 43,
      detailY: compact ? 65 : 70,
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

  createSharedCardBox(x, y, layout, content) {
    return createSharedCardBox(this, x, y, layout, content);
  }

  createUiButton(x, y, width, height, label, onPress) {
    return createUiButton(this, x, y, width, height, label, onPress);
  }

  createUiText(x, y, label, style) {
    return createUiText(this, x, y, label, style);
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
    const credit = this.createUiText(0, layout.creditY, 'A minigame by Javier Algaba', {
      ...this.uiTextStyle(layout.compact ? 16 : 17, '#31503b'),
      strokeThickness: 3,
    }).setOrigin(0.5);
    const prompt = this.createUiText(0, layout.promptY, 'Defend the fairy-tale village from forest mischief.', {
      ...this.uiTextStyle(layout.compact ? 15 : 16, COLORS.uiInk),
      align: 'center',
      wordWrap: { width: layout.panelWidth - 180 },
    }).setOrigin(0.5);
    this.splashHeroChoiceText = this.createUiText(0, layout.choiceY, 'Choose your hero before you begin.', {
      ...this.uiTextStyle(layout.compact ? 14 : 15, '#31503b'),
      align: 'center',
    }).setOrigin(0.5);
    const makeHeroCard = (choice: HeroClass, x: number) => {
      const classConfig = this.getHeroConfig(choice);
      return this.createSharedCardBox(x, layout.cardY, {
        width: layout.cardWidth,
        height: layout.cardHeight,
        artY: layout.artY,
        artSize: layout.artSize,
        titleY: layout.captionY,
        descriptionY: layout.detailY,
        titleSize: layout.compact ? 15 : 16,
        descriptionSize: layout.compact ? 11 : 12,
        badgeX: 0,
        badgeY: 0,
        badgeSize: 0,
      }, {
        art: SPLASH_HERO_CARD_ART[choice],
        title: classConfig.label,
        description: classConfig.identity,
        onSelect: () => this.selectHeroClass(choice),
      });
    };
    const warriorCard = makeHeroCard('warrior', -layout.cardX);
    const archerCard = makeHeroCard('archer', 0);
    const sorcererCard = makeHeroCard('sorcerer', layout.cardX);
    const startButton = this.createUiButton(0, layout.startY, layout.startWidth, layout.startHeight, 'Start Defense', () => this.startGameFromSplash());
    this.splashStartButton = startButton.hit;
    this.splashStartText = startButton.text;
    this.splashHeroCards = {
      warrior: warriorCard,
      archer: archerCard,
      sorcerer: sorcererCard,
    };
    content.add([
      panel,
      titlePlaque,
      title,
      credit,
      prompt,
      this.splashHeroChoiceText,
      warriorCard.container,
      archerCard.container,
      sorcererCard.container,
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
    this.countdownLevelText = this.createUiText(0, -54, '', this.uiTextStyle(34, '#31503b')).setOrigin(0.5);
    this.countdownNumberText = this.createUiText(0, 30, '', {
      ...this.uiTextStyle(72, '#7a4b16'),
      strokeThickness: 5,
    }).setOrigin(0.5);
    this.countdownOverlay.add([shade, panel, this.countdownLevelText, this.countdownNumberText]);
    this.uiLayer.add(this.countdownOverlay);
  }

  createLevelUpOverlay() {
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
    this.levelUpRewardText = this.createUiText(0, layout.rewardY, '', this.uiTextStyle(layout.compact ? 19 : 21, '#bd415c')).setOrigin(0.5).setVisible(false);
    this.levelUpHelperText = this.createUiText(0, layout.helperY, 'Choose one village blessing', this.uiTextStyle(layout.compact ? 15 : 17, '#31503b')).setOrigin(0.5);
    content.add([panel, titlePlaque, this.levelUpTitleText, this.levelUpRewardText, this.levelUpHelperText]);

    this.levelUpChoiceCards = [];
    CARD_DEFINITIONS.slice(0, 2).forEach((choice, index) => {
      const card = this.createSharedCardBox(LEVEL_UP_CARD_XS[index] * layout.cardXScale, layout.cardY, {
        width: layout.cardWidth,
        height: layout.cardHeight,
        artY: layout.iconY,
        artSize: layout.iconSize,
        titleY: layout.labelY,
        descriptionY: layout.detailY,
        titleSize: layout.compact ? 14 : 15,
        descriptionSize: layout.compact ? 11 : 12,
        badgeX: layout.badgeX,
        badgeY: layout.badgeY,
        badgeSize: layout.compact ? 16 : 18,
      }, {
        art: choice.icon,
        title: choice.label,
        description: choice.detail,
        onSelect: () => this.chooseLevelUpgrade(index),
      });
      content.add(card.container);
      this.levelUpChoiceCards.push(card);
    });
    this.levelUpOverlay.add([shade, content]);
    this.uiLayer.add(this.levelUpOverlay);
  }

  getLevelUpTierRoman(tier) {
    return ['I', 'II', 'III', 'IV', 'V'][tier - 1] ?? '';
  }

  updateLevelUpChoicePresentation() {
    this.levelUpChoiceCards?.forEach((card, index) => {
      const choice = this.levelUpChoices[index];
      if (!choice) {
        return;
      }
      const tier = choice.persistent ? this.cardTiers[choice.key] + 1 : null;
      const roman = tier ? this.getLevelUpTierRoman(tier) : '';
      card.setContent({
        art: choice.icon,
        title: choice.label,
        description: choice.detail,
        badgeText: roman,
      });
    });
  }

  showSplashScreen() {
    this.clearLevelTimers();
    this.state.phase = 'splash';
    this.countdownOverlay?.setVisible(false);
    this.levelUpOverlay?.setVisible(false);
    this.gameOverOverlay?.setVisible(false);
    if (!this.forceFreshStart && this.shouldAutoStartFromParams()) {
      this.pendingHeroClass = this.resolveRequestedHeroClass();
      this.applyHeroClass(this.pendingHeroClass, { announce: false, restartIdle: true });
      this.splashOverlay?.setVisible(false).setAlpha(0);
      this.startGameFromSplash();
      return;
    }
    if (this.autoSelectHero) {
      this.pendingHeroClass = this.heroClass;
      this.applyHeroClass(this.heroClass, { announce: false, restartIdle: true });
      this.startGameFromSplash();
      return;
    }
    const explicitHeroChoice = new URLSearchParams(window.location.search).get('heroClass');
    this.pendingHeroClass = this.preselectHero ? this.heroClass : (!this.forceFreshStart && explicitHeroChoice ? this.resolveRequestedHeroClass() : null);
    if (this.pendingHeroClass) {
      this.applyHeroClass(this.pendingHeroClass, { announce: false, restartIdle: true });
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
    if (!this.pendingHeroClass) {
      this.addGuildNote('Choose a hero first.');
      this.playTone('hit');
      return;
    }
    this.applyHeroClass(this.pendingHeroClass, { announce: false, restartIdle: true });
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
    const title = this.createUiText(0, layout.titleY - 3, 'Guild Rest Time', {
      ...this.uiTextStyle(layout.titleSize, '#714617'),
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.gameOverReasonText = this.createUiText(0, layout.reasonY, '', {
      ...this.uiTextStyle(layout.compact ? 18 : 20, COLORS.uiInk),
      align: 'center',
      wordWrap: { width: layout.panelWidth - 140 },
    }).setOrigin(0.5);
    this.gameOverStatsText = this.createUiText(0, layout.statsY, '', this.uiTextStyle(layout.compact ? 16 : 18, '#31503b')).setOrigin(0.5);
    const restartButton = this.createUiButton(-190, layout.buttonY, 174, 48, 'Restart', () => this.restartSameClass());
    const chooseButton = this.createUiButton(0, layout.buttonY, 174, 48, 'New Hero', () => this.chooseNewHero());
    const menuButton = this.createUiButton(190, layout.buttonY, 174, 48, 'Main Menu', () => this.restartGameFromBeginning());
    content.add([
      panel,
      titlePlaque,
      title,
      this.gameOverReasonText,
      this.gameOverStatsText,
      restartButton.container,
      chooseButton.container,
      menuButton.container,
    ]);
    this.gameOverOverlay.add([shade, content]);
    this.uiLayer.add(this.gameOverOverlay);
  }

  showLevelUpScreen() {
    this.levelUpChoices = chooseCardOffer(this.cardTiers, this.buildings, this.lastSelectedCard, this.lastOfferedCards);
    this.lastOfferedCards = this.levelUpChoices.map((choice) => choice.key);
    this.levelUpTitleText.setText('Level Up!');
    this.fitUiTextToWidth(
      this.levelUpTitleText,
      this.levelUpTitleFit.maxWidth,
      this.levelUpTitleFit.maxSize,
      this.levelUpTitleFit.minSize,
    );
    this.levelUpRewardText?.setVisible(false);
    this.levelUpHelperText?.setText('Choose one village blessing');
    this.updateLevelUpChoicePresentation();
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
    this.applyLevelUpCard(choice);
    this.updateLevelUpChoicePresentation();
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
      this.restartForWorldProgression(nextProgression, transitionNote);
      return;
    }
    this.startLevelCountdown();
  }

  showGameOverScreen(reason) {
    this.gameOverReasonText.setText(reason);
    const saved = this.buildings.filter((building) => building.hp > 0).length;
    const highestTier = Math.max(0, ...Object.values(this.cardTiers) as number[]);
    this.gameOverStatsText.setText([
      `Final Level ${this.state.level}   Gold ${this.state.gold}   Hero ${this.getHeroConfig().label}`,
      `Enemies Defeated ${this.runStats.enemiesDefeated}   Buildings Saved ${saved}   Highest Card Tier ${highestTier}`,
      `Reached ${this.getCurrentWorldTheme().label} Round ${this.state.worldRound}`,
    ].join('\n'));
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
    this.createDebugOverlay();
  }

  createTopBar() {
    const top = this.add.container(20, 13).setDepth(7600);
    const goldChip = this.createHudChip(184, 28, 92, 34);
    const levelChip = this.createHudChip(268, 28, 68, 34);
    const roundChip = this.createHudChip(376, 28, 124, 34);
    const skillChip = this.createHudChip(550, 28, 202, 34);
    const coin = this.add.image(154, 28, 'gameUiAtlas', 'coin_badge_01')
      .setDisplaySize(30, 32);
    this.hud.hearts = this.add.container(16, 20);
    this.hud.goldText = this.createUiText(198, 28, '', this.uiTextStyle(16, '#56330f')).setOrigin(0.5);
    this.hud.levelText = this.createUiText(268, 28, '', this.uiTextStyle(15, '#1e3348')).setOrigin(0.5);
    this.hud.waveText = this.createUiText(376, 28, '', this.uiTextStyle(12, '#224b31')).setOrigin(0.5);
    this.hud.skillText = this.createUiText(550, 28, '', this.uiTextStyle(12, '#224b50')).setOrigin(0.5);
    top.add([
      this.hud.hearts,
      goldChip,
      levelChip,
      roundChip,
      skillChip,
      coin,
      this.hud.goldText,
      this.hud.levelText,
      this.hud.waveText,
      this.hud.skillText,
    ]);
    this.uiLayer.add(top);
  }

  createControlsHint() {
    const hint = this.add.container(18, HEIGHT - 58).setDepth(6000);
    this.controlsHint = hint;
    const bg = this.add.graphics();
    bg.fillStyle(0x22324a, 0.62);
    bg.fillRoundedRect(0, 0, 792, 38, 8);
    const text = this.createUiText(
      14,
      10,
      'WASD/Arrows move   Space/Click main attack   F class skill   E repair nearby building',
      this.uiTextStyle(13, '#ffffff'),
    );
    hint.add([bg, text]);
    this.uiLayer.add(hint);
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
      ...debugTextStyle(14, '#fff2b8'),
      strokeThickness: 2,
    });
    const text = this.add.text(12, 34, '', {
      ...debugTextStyle(12, '#f7fff0'),
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
      `Hero ${this.getHeroConfig().label} ${this.state.health}/${this.playerStats.maxHealth} HP | Gold ${this.state.gold}`,
      `Resolved ${this.levelDefeatsThisRound}/${this.levelRequiredDefeats} | defeated ${this.runStats.enemiesDefeated} | pending ${this.levelSpawnsPending}`,
      `Enemies active ${activeEnemies} | remaining ${this.levelEnemiesRemaining}`,
      `Buildings ${buildingSummary}`,
      `Targets ${this.getLiveEnemyTargetSummary()}`,
      `Attack ${this.playerStats.attackDamage.toFixed(2)} | ${Math.round(this.playerStats.attackCooldown)}ms | Skill ${this.getHeroConfig().skill}`,
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
    const remaining = this.player
      ? Math.max(0, (this.player.lastSkill + this.getSkillConfig().cooldown - this.time.now) / 1000)
      : 0;
    const skillStatus = remaining > 0 ? `${remaining.toFixed(1)}s` : 'Ready';
    this.hud.skillText.setText(`${this.getHeroConfig().skill}: ${skillStatus}`);
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
    return uiTextStyle(this, size, color);
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
