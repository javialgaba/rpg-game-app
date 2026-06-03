import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import terrainAtlas from '../public/assets/scene-variants/scene_variant_terrain_atlas.json';
import { ASSET_REGISTRY } from './levels/assetRegistry';
import {
  SCENE_VARIANTS,
  resolveSeasonalBuildingPresentation,
  selectSeasonalFrame,
  type SeasonalBuildingRole,
} from './sceneVariants';
import {
  getSceneVariantGateDepth,
  getSceneVariantGateFrameKey,
  renderSceneVariantGate,
  resolveScenicApronTerrainRole,
  spriteIntersectsGateSightline,
} from './sceneVariantRenderer';

const BUILDING_ROLES: SeasonalBuildingRole[] = ['castle', 'house-1', 'house-2', 'market', 'well'];
const TERRAIN_ATLAS_IMAGE = 'public/assets/scene-variants/scene_variant_terrain_atlas.png';
const ALPHA_THRESHOLD = 8;

const getFrameAlphaBounds = async (frame: { x: number; y: number; w: number; h: number }) => {
  const { data, info } = await sharp(TERRAIN_ATLAS_IMAGE)
    .extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= ALPHA_THRESHOLD) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { width: maxX - minX + 1, height: maxY - minY + 1, bottom: maxY };
};

describe('seasonal scene variant assets', () => {
  it('assigns the Twilight world a dedicated autumn visual theme', () => {
    expect(SCENE_VARIANTS.night_spring.visualTheme).toBe('twilight_autumn');
    expect(SCENE_VARIANTS.night_spring.season).toBe('autumn');
    expect(SCENE_VARIANTS.night_spring.tilePalette.grass)
      .toEqual(expect.arrayContaining(['twilight_autumn_grass_01']));
  });

  it('declares 144 unique seasonal runtime frames including directional gates', () => {
    const frameNames = Object.values(SCENE_VARIANTS).flatMap((variant) => [
      ...variant.tilePalette.grass,
      ...variant.tilePalette.path,
      ...variant.tilePalette.plaza,
      ...Object.values(variant.propPalette).flat(),
      ...BUILDING_ROLES.flatMap((role) => variant.buildingPalette[role].map((entry) => entry.frame)),
    ]);
    expect(frameNames).toHaveLength(144);
    expect(new Set(frameNames).size).toBe(144);
  });

  it('selects terrain and building presentations deterministically', () => {
    const variant = SCENE_VARIANTS.noon_winter;
    const selectionKey = 'winter-seed:building-house-1:building';
    expect(selectSeasonalFrame(variant.tilePalette.grass, selectionKey))
      .toBe(selectSeasonalFrame(variant.tilePalette.grass, selectionKey));
    expect(resolveSeasonalBuildingPresentation(variant, 'house-1', selectionKey))
      .toEqual(resolveSeasonalBuildingPresentation(variant, 'house-1', selectionKey));
  });

  it('builds every seasonal terrain frame as a flat 2:1 atlas diamond', async () => {
    const frameNames = Object.values(SCENE_VARIANTS).flatMap((variant) => [
      ...variant.tilePalette.grass,
      ...variant.tilePalette.path,
      ...variant.tilePalette.plaza,
    ]);

    for (const frameName of frameNames) {
      const frame = terrainAtlas.frames[frameName as keyof typeof terrainAtlas.frames]?.frame;
      expect(frame, frameName).toBeDefined();
      const bounds = await getFrameAlphaBounds(frame);
      expect(bounds.width / bounds.height, frameName).toBeGreaterThan(1.75);
      expect(bounds.width / bounds.height, frameName).toBeLessThan(2.15);
      expect(bounds.bottom, frameName).toBeLessThanOrEqual(Math.round(frame.h * 0.76));
    }
  });

  it('keeps building gameplay roles and footprints unchanged while varying presentation', () => {
    const expectedStats: Record<SeasonalBuildingRole, {
      footprint: { w: number; h: number };
      maxHealth?: number;
      importance?: number;
    }> = {
      castle: { footprint: { w: 3, h: 3 }, maxHealth: 110, importance: 100 },
      'house-1': { footprint: { w: 3, h: 2 }, maxHealth: 74, importance: 50 },
      'house-2': { footprint: { w: 3, h: 2 }, maxHealth: 76, importance: 50 },
      market: { footprint: { w: 3, h: 2 }, maxHealth: 68, importance: 70 },
      well: { footprint: { w: 2, h: 2 } },
    };
    BUILDING_ROLES.forEach((role) => {
      expect(ASSET_REGISTRY[role].footprint).toEqual(expectedStats[role].footprint);
      expect(ASSET_REGISTRY[role].maxHealth).toBe(expectedStats[role].maxHealth);
      expect(ASSET_REGISTRY[role].importance).toBe(expectedStats[role].importance);
      Object.values(SCENE_VARIANTS).forEach((variant) => {
        expect(variant.buildingPalette[role].length).toBeGreaterThan(0);
        expect(variant.buildingPalette[role][0].frame).toContain(`${variant.visualTheme}_`);
      });
    });
  });

  it('marks tall foreground scenery for player occlusion without fading ground flowers', () => {
    expect(ASSET_REGISTRY.tree.render?.occludesPlayer).toBe(true);
    expect(ASSET_REGISTRY.well.render?.occludesPlayer).toBe(true);
    expect(ASSET_REGISTRY.decoration.render?.occludesPlayer).not.toBe(true);

    Object.values(SCENE_VARIANTS).forEach((variant) => {
      const tallAnchors = variant.overlapDecorAnchors.filter((anchor) => anchor.group !== 'flowers');
      const flowerAnchors = variant.overlapDecorAnchors.filter((anchor) => anchor.group === 'flowers');
      expect(tallAnchors.every((anchor) => anchor.occludesPlayer)).toBe(true);
      expect(flowerAnchors.every((anchor) => !anchor.occludesPlayer)).toBe(true);
    });
  });

  it('configures the expanded generated village presentation for each season', () => {
    Object.values(SCENE_VARIANTS).forEach((variant) => {
      expect(variant.playableBounds).toEqual({ minX: 3, minY: 3, maxX: 25, maxY: 25 });
      expect(variant.propPalette.gates).toEqual([
        `${variant.visualTheme}_gate_n_01`,
        `${variant.visualTheme}_gate_e_01`,
        `${variant.visualTheme}_gate_s_01`,
        `${variant.visualTheme}_gate_w_01`,
      ]);
      expect(variant.cameraZoom).toBe(1.12);
      expect(variant.scenicOverscan).toBeGreaterThan(1);
      expect(variant.ambientEffect.maxParticles).toBeGreaterThan(0);
      expect(variant.foregroundParallax).toBeGreaterThan(variant.backgroundParallax);
    });
  });

  it('resolves authored gate directions directly to their named art frames', () => {
    expect(getSceneVariantGateFrameKey('spring', 'north')).toBe('spring_gate_n_01');
    expect(getSceneVariantGateFrameKey('spring', 'east')).toBe('spring_gate_e_01');
    expect(getSceneVariantGateFrameKey('spring', 'south')).toBe('spring_gate_s_01');
    expect(getSceneVariantGateFrameKey('spring', 'west')).toBe('spring_gate_w_01');
  });

  it('keeps gate sprites above nearby decorative tree sprites', () => {
    const gateScreenY = 320;
    const nearbyTreeScreenY = gateScreenY + 46;
    const treeDecorationDepth = nearbyTreeScreenY + 6;

    expect(getSceneVariantGateDepth(gateScreenY)).toBeGreaterThan(treeDecorationDepth);
  });

  it('renders gates in the scenery layer below actors and buildings', () => {
    const addedToDecor: unknown[] = [];
    const sprite: any = {
      depth: 0,
      setOrigin: () => sprite,
      setDisplaySize: () => sprite,
      setDepth: (depth: number) => {
        sprite.depth = depth;
        return sprite;
      },
    };
    const scene = {
      textures: {
        exists: () => true,
        get: () => ({ has: () => true }),
      },
      getActiveSceneVariant: () => ({ visualTheme: 'spring' }),
      isoToScreen: () => ({ x: 120, y: 320 }),
      scaleGeneratedSize: (size: [number, number]) => size,
      add: {
        image: () => sprite,
      },
      decorLayer: {
        add: (entry: unknown) => addedToDecor.push(entry),
      },
      entityLayer: {
        add: () => {
          throw new Error('Gates should not render in the actor layer.');
        },
      },
    };

    renderSceneVariantGate(scene as any, { direction: 'west', threshold: { x: 3, y: 14 } } as any);

    expect(addedToDecor).toEqual([sprite]);
    expect(sprite.depth).toBe(getSceneVariantGateDepth(320));
  });

  it('resolves scenic apron terrain without leaking plain grass beyond the authored board', () => {
    const cells = Array.from({ length: 29 }, (_, y) => (
      Array.from({ length: 29 }, (__, x) => ({
        terrain: x === 4 && y === 4 ? 'grass' as const : 'forest_floor' as const,
      }))
    ));
    const level = {
      width: 29,
      height: 29,
      config: {
        authoredMap: {
          id: 'test-village',
          cells,
          errors: [],
        },
      },
      gates: [
        { direction: 'north', threshold: { x: 14, y: 3 } },
        { direction: 'east', threshold: { x: 25, y: 14 } },
        { direction: 'south', threshold: { x: 14, y: 25 } },
        { direction: 'west', threshold: { x: 3, y: 14 } },
      ],
    } as any;

    expect(resolveScenicApronTerrainRole(4, 4, level)).toEqual({
      terrainRole: 'grass',
      reason: 'authored-map',
    });
    expect(resolveScenicApronTerrainRole(14, -1, level)).toEqual({
      terrainRole: 'gate_road',
      reason: 'gate-road',
    });
    expect(resolveScenicApronTerrainRole(29, 14, level)).toEqual({
      terrainRole: 'gate_road',
      reason: 'gate-road',
    });
    expect(resolveScenicApronTerrainRole(10, -1, level)).toEqual({
      terrainRole: 'forest_floor',
      reason: 'forest-buffer',
    });
    expect(resolveScenicApronTerrainRole(-1, 10, level).terrainRole).not.toBe('grass');
  });

  it('detects large foreground art that crosses a protected gate sightline', () => {
    const scene = {
      generatedLevel: {
        gates: [{ sightlineCells: [{ x: 5, y: 5 }] }],
      },
      getIsoMetrics: () => ({ tileW: 100, tileH: 50 }),
      isoToScreen: () => ({ x: 200, y: 120 }),
    };
    expect(spriteIntersectsGateSightline(scene, {
      getBounds: () => ({ left: 160, right: 240, top: 90, bottom: 150 }),
    })).toBe(true);
    expect(spriteIntersectsGateSightline(scene, {
      getBounds: () => ({ left: 400, right: 470, top: 260, bottom: 330 }),
    })).toBe(false);
  });
});
