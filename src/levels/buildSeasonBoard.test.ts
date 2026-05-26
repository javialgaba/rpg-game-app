import { describe, expect, it } from 'vitest';
import { DEFAULT_VILLAGE_LEVEL } from './defaultVillageLevel';
import { buildSeasonBoardConfig } from './buildSeasonBoard';
import { SCENE_VARIANTS, type SeasonPreset } from '../sceneVariants';

describe('expanded seasonal board construction', () => {
  it('builds a 25 by 25 generated map with expanded playable bounds in every season', () => {
    (Object.keys(SCENE_VARIANTS) as SeasonPreset[]).forEach((season) => {
      const config = buildSeasonBoardConfig(DEFAULT_VILLAGE_LEVEL, season, 0);
      expect(config.matrix).toHaveLength(25);
      expect(config.matrix.every((row) => row.length === 25)).toBe(true);
      expect(config.playableBounds).toEqual({ minX: 3, minY: 3, maxX: 21, maxY: 21 });
    });
  });

  it('moves monster entry points to the expanded playable perimeter', () => {
    const config = buildSeasonBoardConfig(DEFAULT_VILLAGE_LEVEL, 'day_spring', 0);
    const spawnPoints = config.matrix.flatMap((row, y) => row.flatMap((token, x) => (
      token === 'monster-spawn' ? [{ x, y }] : []
    )));
    expect(spawnPoints).toEqual(expect.arrayContaining([
      { x: 3, y: 3 },
      { x: 21, y: 3 },
      { x: 21, y: 21 },
      { x: 3, y: 21 },
    ]));
  });
});
