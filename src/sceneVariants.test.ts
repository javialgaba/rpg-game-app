import { describe, expect, it } from 'vitest';
import { ASSET_REGISTRY } from './levels/assetRegistry';
import {
  SCENE_VARIANTS,
  resolveSeasonalBuildingPresentation,
  selectSeasonalFrame,
  type SeasonalBuildingRole,
} from './sceneVariants';

const BUILDING_ROLES: SeasonalBuildingRole[] = ['castle', 'house-1', 'house-2', 'market', 'well'];

describe('seasonal scene variant assets', () => {
  it('assigns the Twilight world a dedicated autumn visual theme', () => {
    expect(SCENE_VARIANTS.night_spring.visualTheme).toBe('twilight_autumn');
    expect(SCENE_VARIANTS.night_spring.season).toBe('autumn');
    expect(SCENE_VARIANTS.night_spring.tilePalette.grass)
      .toEqual(expect.arrayContaining(['twilight_autumn_grass_01']));
  });

  it('declares 128 unique seasonal runtime frames', () => {
    const frameNames = Object.values(SCENE_VARIANTS).flatMap((variant) => [
      ...variant.tilePalette.grass,
      ...variant.tilePalette.path,
      ...variant.tilePalette.plaza,
      ...Object.values(variant.propPalette).flat(),
      ...BUILDING_ROLES.flatMap((role) => variant.buildingPalette[role].map((entry) => entry.frame)),
    ]);
    expect(frameNames).toHaveLength(128);
    expect(new Set(frameNames).size).toBe(128);
  });

  it('selects terrain and building presentations deterministically', () => {
    const variant = SCENE_VARIANTS.noon_winter;
    const selectionKey = 'winter-seed:building-house-1:building';
    expect(selectSeasonalFrame(variant.tilePalette.grass, selectionKey))
      .toBe(selectSeasonalFrame(variant.tilePalette.grass, selectionKey));
    expect(resolveSeasonalBuildingPresentation(variant, 'house-1', selectionKey))
      .toEqual(resolveSeasonalBuildingPresentation(variant, 'house-1', selectionKey));
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
});
