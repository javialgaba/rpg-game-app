import * as Phaser from 'phaser';
import { WIDTH, HEIGHT } from './gameConfig';
import {
  resolveSeasonalBuildingPresentation,
  selectSeasonalFrame,
  type SeasonalBuildingRole,
  type SeasonalPropGroup,
} from './sceneVariants';

const SEASONAL_TERRAIN_ATLAS = 'sceneVariantTerrainAtlas';
const SEASONAL_PROPS_ATLAS = 'sceneVariantPropsAtlas';
const SEASONAL_BUILDINGS_ATLAS = 'sceneVariantBuildingsAtlas';
const BUILDING_ROLES = new Set<SeasonalBuildingRole>(['castle', 'house-1', 'house-2', 'market', 'well']);

const getSelectionKey = (scene, placement, group: string) => {
  const variant = scene.getActiveSceneVariant();
  const seed = scene.generatedLevel?.config?.seed ?? variant.key;
  const placementKey = placement?.id
    ?? `${placement?.token ?? group}-${placement?.grid?.x ?? 0}-${placement?.grid?.y ?? 0}`;
  return `${seed}:${placementKey}:${group}`;
};

const getPropTexture = (scene, placement, group: SeasonalPropGroup) => {
  const variant = scene.getActiveSceneVariant();
  return {
    textureKey: SEASONAL_PROPS_ATLAS,
    frameKey: selectSeasonalFrame(variant.propPalette[group], getSelectionKey(scene, placement, group)),
  };
};

export function getSceneVariantTerrainTexture(scene, placement) {
  const variant = scene.getActiveSceneVariant();
  const token = placement.token;
  const palette = token === 'path'
    ? variant.tilePalette.path
    : (token === 'village-center' || token === 'player-spawn'
      ? variant.tilePalette.plaza
      : (token === 'decoration' ? variant.tilePalette.grass.slice(2) : variant.tilePalette.grass));
  return {
    textureKey: SEASONAL_TERRAIN_ATLAS,
    frameKey: selectSeasonalFrame(palette, getSelectionKey(scene, placement, token)),
  };
}

export function getSceneVariantBuildingTexture(scene, placement) {
  if (!BUILDING_ROLES.has(placement.token as SeasonalBuildingRole)) {
    return null;
  }
  const variant = scene.getActiveSceneVariant();
  const presentation = resolveSeasonalBuildingPresentation(
    variant,
    placement.token as SeasonalBuildingRole,
    getSelectionKey(scene, placement, 'building'),
  );
  return {
    textureKey: SEASONAL_BUILDINGS_ATLAS,
    frameKey: presentation.frame,
    label: presentation.label,
  };
}

export function getSceneVariantPropTexture(scene, placement) {
  if (placement.token === 'well') {
    return getSceneVariantBuildingTexture(scene, placement);
  }
  if (placement.token === 'tree') {
    return getPropTexture(scene, placement, 'trees');
  }
  if (placement.token === 'lamp') {
    return getPropTexture(scene, placement, 'lamps');
  }
  if (placement.token === 'fence') {
    return getPropTexture(scene, placement, 'fences');
  }
  if (placement.token === 'sign') {
    return getPropTexture(scene, placement, 'signs');
  }
  if (placement.type === 'terrain' && placement.token === 'decoration') {
    return getPropTexture(scene, placement, 'flowers');
  }
  return null;
}

export function getSceneVariantDecorationTexture(scene, placement) {
  switch (placement.decorationKind) {
    case 'flowers':
      return getPropTexture(scene, placement, 'flowers');
    case 'grassPatch':
      return getPropTexture(scene, placement, 'grassPatches');
    case 'magicPlant':
    case 'mushrooms':
      return getPropTexture(scene, placement, 'magicPatches');
    case 'sapling':
      return getPropTexture(scene, placement, 'saplings');
    case 'fullTree':
      return getPropTexture(scene, placement, 'trees');
    case 'treeCluster':
      return getPropTexture(scene, placement, 'treeClusters');
    case 'rocks':
      return getPropTexture(scene, placement, 'rocks');
    case 'puddle':
      return getPropTexture(scene, placement, 'ponds');
    case 'bush':
      return getPropTexture(scene, placement, 'bushes');
    case 'lamp':
      return getPropTexture(scene, placement, 'lamps');
    case 'fence':
      return getPropTexture(scene, placement, 'fences');
    case 'sign':
      return getPropTexture(scene, placement, 'signs');
    default:
      return null;
  }
}

export function addSceneVariantImage(
  scene,
  layer,
  textureKey,
  x,
  y,
  uniformScale,
  depth,
  options: { alpha?: number; originX?: number; originY?: number; tint?: number } = {},
) {
  if (!scene.textures.exists(textureKey)) {
    return null;
  }
  const sprite = scene.add.image(x, y, textureKey)
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

export function registerParallaxSprite(scene, sprite, factor, baseX, baseY) {
  if (!sprite) {
    return;
  }
  scene.parallaxSprites.push({ sprite, factor, baseX, baseY });
}

export function hasStaticSceneVariantFrame(scene, config) {
  return Boolean(config)
    && scene.textures.exists(config.backgroundAssetKey)
    && scene.textures.exists(config.exteriorFrameAssetKey);
}

export function renderSceneVariantBackground(scene, config, bounds) {
  const baseScale = Math.max(WIDTH / 2048, HEIGHT / 1152);
  const sprite = addSceneVariantImage(
    scene,
    scene.backgroundLayer,
    config.backgroundAssetKey,
    bounds.centerX,
    bounds.centerY - 24,
    baseScale * 1.04 * (config.worldZoom ?? 1),
    2,
    { alpha: 1 },
  );
  registerParallaxSprite(scene, sprite, config.backgroundParallax ?? 0, bounds.centerX, bounds.centerY - 24);
}

export function renderSceneVariantFrame(scene, config, bounds) {
  const baseScale = Math.max(WIDTH / 2048, HEIGHT / 1152);
  const sprite = addSceneVariantImage(
    scene,
    scene.edgeLayer,
    config.exteriorFrameAssetKey,
    bounds.centerX,
    bounds.centerY - 20,
    baseScale * 1.04 * (config.worldZoom ?? 1),
    70,
    { alpha: 1 },
  );
  registerParallaxSprite(scene, sprite, config.frameParallax ?? 0, bounds.centerX, bounds.centerY - 20);
}

export function renderSceneVariantForeground(scene, config, bounds) {
  if (!config.foregroundFogAssetKey) {
    return;
  }
  const baseScale = Math.max(WIDTH / 2048, HEIGHT / 1152);
  const sprite = addSceneVariantImage(
    scene,
    scene.lightingLayer,
    config.foregroundFogAssetKey,
    bounds.centerX,
    bounds.centerY - 20,
    baseScale * 1.04 * (config.worldZoom ?? 1),
    4705,
    { alpha: config.key === 'night_spring' ? 0.9 : 0.72 },
  );
  registerParallaxSprite(scene, sprite, config.foregroundParallax ?? 0, bounds.centerX, bounds.centerY - 20);
}

export function renderSceneVariantOverlapDecor(scene, config, bounds, tileW, tileH) {
  if (!scene.textures.exists(SEASONAL_PROPS_ATLAS)) {
    return;
  }
  const texture = scene.textures.get(SEASONAL_PROPS_ATLAS);
  const atlasScale = scene.generatedLevel?.config?.tileSize ? scene.generatedLevel.config.tileSize / 64 : 1;
  config.overlapDecorAnchors.forEach((anchor, index) => {
    const frame = selectSeasonalFrame(config.propPalette[anchor.group], `${config.key}:overlap:${index}`);
    if (!texture.has(frame)) {
      return;
    }
    const x = bounds.centerX + anchor.x * tileW;
    const y = bounds.centerY + anchor.y * tileH;
    const sprite = scene.add.image(x, y, SEASONAL_PROPS_ATLAS, frame)
      .setOrigin(0.5, 0.82)
      .setScale(anchor.scale * atlasScale)
      .setDepth(bounds.centerY + anchor.depthBias)
      .setAlpha(anchor.alpha ?? 1);
    scene.edgeLayer.add(sprite);
    if (anchor.occludesPlayer) {
      scene.registerPlayerOccluder({
        label: `Foreground ${anchor.group}`,
        category: `foreground-${anchor.group}`,
        sprite,
        baseAlpha: anchor.alpha ?? 1,
        occluding: false,
      });
    }
  });
}

export function applySceneVariantAmbient(scene, config) {
  if (config.ambientAlpha <= 0) {
    return;
  }
  const ambient = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, config.ambientTint, config.ambientAlpha)
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(4701);
  scene.lightingLayer.add(ambient);
}

export function updateCinematicParallax(scene) {
  if (!scene.parallaxSprites?.length || !scene.player || !scene.generatedLevel) {
    return;
  }
  const { minX, minY, maxX, maxY } = scene.generatedLevel.playableBounds;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const spanX = Math.max(1, (maxX - minX) / 2);
  const spanY = Math.max(1, (maxY - minY) / 2);
  const nx = Phaser.Math.Clamp((scene.player.iso.x - centerX) / spanX, -1, 1);
  const ny = Phaser.Math.Clamp((scene.player.iso.y - centerY) / spanY, -1, 1);
  scene.parallaxSprites.forEach((entry) => {
    entry.sprite.setPosition(
      entry.baseX - nx * 46 * entry.factor,
      entry.baseY - ny * 30 * entry.factor,
    );
  });
}
