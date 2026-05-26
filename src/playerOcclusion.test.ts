import { describe, expect, it } from 'vitest';
import {
  PLAYER_OCCLUDED_SCENERY_ALPHA,
  getPlayerOccluderAlpha,
  isPlayerOccludedByScenery,
  shouldRegisterPlayerOccluder,
} from './playerOcclusion';

const PLAYER_BOUNDS = { left: 44, right: 62, top: 42, bottom: 78 };
const FRONT_TREE = { left: 28, right: 88, top: 18, bottom: 84 };

describe('player scenery occlusion', () => {
  it('fades a foreground tree that visually covers the hero', () => {
    const occluded = isPlayerOccludedByScenery({
      playerBounds: PLAYER_BOUNDS,
      playerDepth: 120,
      occluderBounds: FRONT_TREE,
      occluderDepth: 144,
      footprintBounds: { left: 38, right: 68 },
    });

    expect(occluded).toBe(true);
    expect(getPlayerOccluderAlpha(1, occluded)).toBe(PLAYER_OCCLUDED_SCENERY_ALPHA);
  });

  it('restores base alpha when the hero has moved clear', () => {
    const occluded = isPlayerOccludedByScenery({
      playerBounds: { left: 140, right: 158, top: 42, bottom: 78 },
      playerDepth: 120,
      occluderBounds: FRONT_TREE,
      occluderDepth: 144,
    });

    expect(occluded).toBe(false);
    expect(getPlayerOccluderAlpha(0.92, occluded)).toBe(0.92);
  });

  it('does not fade a sprite drawn behind the player', () => {
    expect(isPlayerOccludedByScenery({
      playerBounds: PLAYER_BOUNDS,
      playerDepth: 120,
      occluderBounds: FRONT_TREE,
      occluderDepth: 100,
    })).toBe(false);
  });

  it('ignores a wide canopy whose footprint is unrelated to the player', () => {
    expect(isPlayerOccludedByScenery({
      playerBounds: PLAYER_BOUNDS,
      playerDepth: 120,
      occluderBounds: FRONT_TREE,
      occluderDepth: 144,
      footprintBounds: { left: 130, right: 160 },
    })).toBe(false);
  });

  it('registers only render definitions explicitly marked as occluders', () => {
    expect(shouldRegisterPlayerOccluder({ occludesPlayer: true })).toBe(true);
    expect(shouldRegisterPlayerOccluder({ occludesPlayer: false })).toBe(false);
    expect(shouldRegisterPlayerOccluder({})).toBe(false);
  });
});
