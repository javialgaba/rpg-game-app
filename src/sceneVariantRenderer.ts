import { WIDTH, HEIGHT } from './gameConfig';
import type { AuthoredTerrainRole, GeneratedGate, GeneratedLevel } from './levels/levelTypes';
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
const GATE_SIGHTLINE_CELL_WIDTH_RATIO = 0.9;
const GATE_SIGHTLINE_CELL_HEIGHT_RATIO = 1.8;
const AUTHORED_TERRAIN_FRAME_SUFFIX = {
  grass: 'grass_01',
  flower_grass: 'grass_03',
  stone_road: 'path_01',
  plaza: 'plaza_01',
  forest_floor: 'grass_02',
  gate_road: 'path_01',
} as const;
const AUTHORED_PROP_FRAME_SUFFIX = {
  tree_broadleaf: 'broadleaf_01',
  tree_conifer: 'conifer_01',
  rock_large: 'rocks_large_01',
  pond: 'pond_01',
  bush: 'bush_01',
  flowers: 'flowers_01',
  grass_tuft: 'grass_tuft_01',
  magic_patch: 'magic_patch_01',
  lamp: 'lamp_01',
  fence: 'fence_01',
  sign: 'sign_01',
} as const;
const GATE_FRAME_DIRECTION: Record<GeneratedGate['direction'], 'n' | 'e' | 's' | 'w'> = {
  north: 'n',
  east: 'e',
  south: 's',
  west: 'w',
};

export type ScenicApronTerrainReason = 'authored-map' | 'gate-road' | 'forest-buffer';

export interface ScenicApronTerrainResolution {
  terrainRole: AuthoredTerrainRole;
  reason: ScenicApronTerrainReason;
}

const isInsideGeneratedLevel = (x: number, y: number, level: Pick<GeneratedLevel, 'width' | 'height'>) => (
  x >= 0 && y >= 0 && x < level.width && y < level.height
);

const isGateRoadApronCell = (
  x: number,
  y: number,
  level: Pick<GeneratedLevel, 'width' | 'height' | 'gates'>,
) => level.gates.some((gate) => {
  if (gate.direction === 'north') {
    return y < 0 && Math.abs(x - gate.threshold.x) <= 1;
  }
  if (gate.direction === 'south') {
    return y >= level.height && Math.abs(x - gate.threshold.x) <= 1;
  }
  if (gate.direction === 'west') {
    return x < 0 && Math.abs(y - gate.threshold.y) <= 1;
  }
  return x >= level.width && Math.abs(y - gate.threshold.y) <= 1;
});

export function resolveScenicApronTerrainRole(
  x: number,
  y: number,
  level: Pick<GeneratedLevel, 'width' | 'height' | 'gates' | 'config'>,
): ScenicApronTerrainResolution {
  if (isInsideGeneratedLevel(x, y, level)) {
    return {
      terrainRole: level.config.authoredMap?.cells[y]?.[x]?.terrain ?? 'grass',
      reason: 'authored-map',
    };
  }
  if (isGateRoadApronCell(x, y, level)) {
    return {
      terrainRole: 'gate_road',
      reason: 'gate-road',
    };
  }
  return {
    terrainRole: 'forest_floor',
    reason: 'forest-buffer',
  };
}

export function getSceneVariantTerrainFrameKey(visualTheme: string, terrainRole: AuthoredTerrainRole) {
  return `${visualTheme}_${AUTHORED_TERRAIN_FRAME_SUFFIX[terrainRole]}`;
}

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
  if (placement.authoredTerrainRole) {
    return {
      textureKey: SEASONAL_TERRAIN_ATLAS,
      frameKey: getSceneVariantTerrainFrameKey(variant.visualTheme, placement.authoredTerrainRole),
    };
  }
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
  const authoredFrame = placement.authoredObjectRole
    ? AUTHORED_PROP_FRAME_SUFFIX[placement.authoredObjectRole]
    : undefined;
  if (authoredFrame) {
    return {
      textureKey: SEASONAL_PROPS_ATLAS,
      frameKey: `${scene.getActiveSceneVariant().visualTheme}_${authoredFrame}`,
    };
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
  const authoredFrame = placement.authoredObjectRole
    ? AUTHORED_PROP_FRAME_SUFFIX[placement.authoredObjectRole]
    : undefined;
  if (authoredFrame) {
    return {
      textureKey: SEASONAL_PROPS_ATLAS,
      frameKey: `${scene.getActiveSceneVariant().visualTheme}_${authoredFrame}`,
    };
  }
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

export function renderSceneVariantGate(scene, gate: GeneratedGate) {
  if (!scene.textures.exists(SEASONAL_PROPS_ATLAS)) {
    return;
  }
  const variant = scene.getActiveSceneVariant();
  const frameKey = getSceneVariantGateFrameKey(variant.visualTheme, gate.direction);
  const texture = scene.textures.get(SEASONAL_PROPS_ATLAS);
  if (!texture.has(frameKey)) {
    return;
  }
  const p = scene.isoToScreen(gate.threshold.x, gate.threshold.y, 4);
  const size = scene.scaleGeneratedSize([224, 224]);
  const sprite = scene.add.image(p.x, p.y, SEASONAL_PROPS_ATLAS, frameKey)
    .setOrigin(0.5, 0.84)
    .setDisplaySize(size[0], size[1])
    .setDepth(p.y + 18);
  scene.decorLayer.add(sprite);
}

export function getSceneVariantGateFrameKey(visualTheme: string, direction: GeneratedGate['direction']) {
  return `${visualTheme}_gate_${GATE_FRAME_DIRECTION[direction]}_01`;
}

export function spriteIntersectsGateSightline(scene, sprite) {
  if (!scene.generatedLevel?.gates?.length || !sprite) {
    return false;
  }
  const spriteBounds = sprite.getBounds();
  const { tileW, tileH } = scene.getIsoMetrics();
  const halfWidth = tileW * GATE_SIGHTLINE_CELL_WIDTH_RATIO * 0.5;
  const halfHeight = tileH * GATE_SIGHTLINE_CELL_HEIGHT_RATIO * 0.5;
  return scene.generatedLevel.gates.some((gate) => gate.sightlineCells.some((cell) => {
    const point = scene.isoToScreen(cell.x, cell.y);
    return spriteBounds.left < point.x + halfWidth
      && spriteBounds.right > point.x - halfWidth
      && spriteBounds.top < point.y + halfHeight
      && spriteBounds.bottom > point.y - halfHeight;
  }));
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
    baseScale * 1.04 * (config.worldZoom ?? 1) * (config.scenicOverscan ?? 1),
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
    baseScale * 1.04 * (config.worldZoom ?? 1) * (config.scenicOverscan ?? 1),
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
    baseScale * 1.04 * (config.worldZoom ?? 1) * (config.scenicOverscan ?? 1),
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
    if (anchor.group !== 'flowers' && spriteIntersectsGateSightline(scene, sprite)) {
      sprite.destroy();
      return;
    }
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
  if (!scene.parallaxSprites?.length || !scene.worldCamera || !scene.cameraParallaxOrigin) {
    return;
  }
  const cameraCenter = scene.worldCamera.midPoint;
  const travelX = cameraCenter.x - scene.cameraParallaxOrigin.x;
  const travelY = cameraCenter.y - scene.cameraParallaxOrigin.y;
  scene.parallaxSprites.forEach((entry) => {
    entry.sprite.setPosition(
      entry.baseX + travelX * entry.factor,
      entry.baseY + travelY * entry.factor,
    );
  });
}
