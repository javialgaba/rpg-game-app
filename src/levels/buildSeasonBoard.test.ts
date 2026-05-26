import { describe, expect, it } from 'vitest';
import { DEFAULT_VILLAGE_LEVEL } from './defaultVillageLevel';
import { buildSeasonBoardConfig } from './buildSeasonBoard';
import { SCENE_VARIANTS, type SeasonPreset } from '../sceneVariants';

describe('expanded seasonal board construction', () => {
  it('builds a 29 by 29 generated map with a 23 by 23 playable village in every season', () => {
    (Object.keys(SCENE_VARIANTS) as SeasonPreset[]).forEach((season) => {
      const config = buildSeasonBoardConfig(DEFAULT_VILLAGE_LEVEL, season, 0);
      expect(config.matrix).toHaveLength(29);
      expect(config.matrix.every((row) => row.length === 29)).toBe(true);
      expect(config.playableBounds).toEqual({ minX: 3, minY: 3, maxX: 25, maxY: 25 });
    });
  });

  it('moves monster entry points to four centered forest gates', () => {
    const config = buildSeasonBoardConfig(DEFAULT_VILLAGE_LEVEL, 'day_spring', 0);
    const spawnPoints = config.matrix.flatMap((row, y) => row.flatMap((token, x) => (
      token === 'monster-spawn' ? [{ x, y }] : []
    )));
    expect(spawnPoints).toEqual(expect.arrayContaining([
      { x: 14, y: 3 },
      { x: 25, y: 14 },
      { x: 14, y: 25 },
      { x: 3, y: 14 },
    ]));
    expect(config.gates?.map((gate) => gate.direction)).toEqual(['north', 'east', 'south', 'west']);
  });

  it('reserves long three-cell-wide gate avenues with broader sightline protection', () => {
    const config = buildSeasonBoardConfig(DEFAULT_VILLAGE_LEVEL, 'day_spring', 0);
    expect(config.gates).toHaveLength(4);
    config.gates?.forEach((gate) => {
      expect(gate.clearCells).toHaveLength(15);
      expect(gate.roadCells.length).toBeGreaterThan(gate.clearCells.length);
      expect(gate.sightlineCells.length).toBeGreaterThan(gate.roadCells.length);
      gate.roadCells.forEach((cell) => {
        expect(['path', 'monster-spawn']).toContain(config.matrix[cell.y][cell.x]);
      });
    });
    expect(config.matrix[0][13]).toBe('path');
    expect(config.matrix[0][14]).toBe('path');
    expect(config.matrix[0][15]).toBe('path');
    expect(config.matrix[0][12]).toBe('grass');
    expect(config.matrix[0][11]).toBe('tree');
    expect(config.matrix[8][14]).toBe('path');
  });
});
