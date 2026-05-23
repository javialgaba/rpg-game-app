import * as Phaser from 'phaser';
import { WIDTH, HEIGHT } from './gameConfig';

export function getSceneVariantTerrainTexture(scene, token) {
  const variant = scene.getActiveSceneVariant();
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

export function getSceneVariantPropTexture(scene, placement) {
  const variant = scene.getActiveSceneVariant();
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

export function getSceneVariantDecorationTexture(scene, placement) {
  const variant = scene.getActiveSceneVariant();
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
  config.overlapDecorAnchors.forEach((anchor) => {
    const x = bounds.centerX + anchor.x * tileW;
    const y = bounds.centerY + anchor.y * tileH;
    scene.addEnvironmentUniformSprite(
      scene.edgeLayer,
      anchor.frame,
      x,
      y,
      anchor.scale,
      bounds.centerY + anchor.depthBias,
      { alpha: anchor.alpha, originY: 0.82 },
    );
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
