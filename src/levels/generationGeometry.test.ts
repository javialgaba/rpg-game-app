import { describe, expect, it } from 'vitest';
import {
  getAnchorFootprintCells,
  getBuildingClearanceErrors,
  getCardinalNeighborCells,
  getNeighborCells,
  isInsidePlayableBounds,
  makeGrid,
  pointKey,
  resolvePlayableBounds,
} from './generationGeometry';

describe('level generation geometry helpers', () => {
  it('builds independent grid rows', () => {
    const grid = makeGrid(2, 2, false);
    grid[0][0] = true;
    expect(grid[1][0]).toBe(false);
  });

  it('calculates centered footprint cells', () => {
    expect(getAnchorFootprintCells({ x: 5, y: 5 }, { w: 2, h: 2 })).toEqual([
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ]);
  });

  it('clamps playable bounds to the map', () => {
    const bounds = resolvePlayableBounds({
      seed: 'test',
      tileSize: 1,
      matrix: [['grass', 'grass']],
      timeOfDay: 'morning',
      decorationDensity: 0,
      difficulty: 1,
      playableBounds: { minX: -10, minY: -2, maxX: 4, maxY: 8 },
    });
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 0 });
    expect(isInsidePlayableBounds({ x: 1, y: 0 }, bounds)).toBe(true);
  });

  it('returns neighbor cells and stable point keys', () => {
    expect(pointKey({ x: 2, y: 3 })).toBe('2,3');
    expect(getCardinalNeighborCells({ x: 2, y: 3 })).toContainEqual({ x: 3, y: 3 });
    expect(getNeighborCells({ x: 2, y: 3 })).toHaveLength(8);
  });

  it('reports protected buildings placed too closely', () => {
    const errors = getBuildingClearanceErrors([
      {
        id: 'castle',
        type: 'building',
        token: 'castle',
        label: 'Castle',
        grid: { x: 5, y: 5 },
        iso: { x: 5, y: 5 },
        footprint: { w: 1, h: 1 },
        cells: [{ x: 5, y: 5 }],
        blocksMovement: true,
        render: { displaySize: [1, 1], origin: [0.5, 1], z: 1 },
      },
      {
        id: 'market',
        type: 'building',
        token: 'market',
        label: 'Market',
        grid: { x: 6, y: 5 },
        iso: { x: 6, y: 5 },
        footprint: { w: 1, h: 1 },
        cells: [{ x: 6, y: 5 }],
        blocksMovement: true,
        render: { displaySize: [1, 1], origin: [0.5, 1], z: 1 },
      },
    ]);
    expect(errors[0]).toContain('Castle at 5,5 and Market at 6,5');
  });
});
