import { describe, expect, it } from 'vitest';
import {
  getGeneratedTerrainApronOutsideDistance,
  getGeneratedWorldBounds,
  getGeneratedWorldCliffFrame,
  getGeneratedWorldCliffOffset,
  isGeneratedBoardEdgeCell,
  isGeneratedTerrainApronGateSightline,
  shouldRenderGeneratedCellCliff,
} from './worldRenderSystem';

const bounds = { minX: 3, minY: 3, maxX: 25, maxY: 25 };

describe('world render helpers', () => {
  it('measures apron distance outside generated level bounds', () => {
    expect(getGeneratedTerrainApronOutsideDistance(4, 4, { width: 10, height: 10 })).toBe(0);
    expect(getGeneratedTerrainApronOutsideDistance(-2, 4, { width: 10, height: 10 })).toBe(2);
    expect(getGeneratedTerrainApronOutsideDistance(12, 11, { width: 10, height: 10 })).toBe(3);
  });

  it('detects protected gate sightlines outside each edge', () => {
    const level = {
      width: 10,
      height: 10,
      gates: [{
        id: 'gate-n',
        direction: 'north' as const,
        threshold: { x: 5, y: 0 },
        visualEntry: { x: 5, y: -1 },
        approachCells: [],
        clearCells: [],
        roadCells: [],
        sightlineCells: [],
      }],
    };
    expect(isGeneratedTerrainApronGateSightline(6, -1, level)).toBe(true);
    expect(isGeneratedTerrainApronGateSightline(9, -1, level)).toBe(false);
  });

  it('keeps cliff rendering to readable board edges', () => {
    expect(shouldRenderGeneratedCellCliff({ x: 3, y: 3 }, bounds)).toBe(true);
    expect(shouldRenderGeneratedCellCliff({ x: 12, y: 3 }, bounds)).toBe(false);
    expect(shouldRenderGeneratedCellCliff({ x: 3, y: 8 }, bounds)).toBe(false);
    expect(shouldRenderGeneratedCellCliff({ x: 3, y: 10 }, bounds)).toBe(true);
    expect(isGeneratedBoardEdgeCell({ x: 10, y: 10 }, bounds)).toBe(false);
  });

  it('resolves cliff frame and offset by edge', () => {
    expect(getGeneratedWorldCliffFrame({ x: 25, y: 25 }, bounds)).toBe('edge_corner_s_01');
    expect(getGeneratedWorldCliffFrame({ x: 25, y: 12 }, bounds)).toBe('edge_cliff_ne_01');
    expect(getGeneratedWorldCliffOffset({ x: 25, y: 12 }, 100, 50, bounds)).toEqual({ x: 48, y: 46 });
  });

  it('computes generated world bounds from projected corners', () => {
    const result = getGeneratedWorldBounds(
      { width: 3, height: 3 },
      100,
      50,
      (x, y) => ({ x: (x - y) * 50, y: (x + y) * 25 }),
    );
    expect(result?.centerX).toBe(0);
    expect(result?.centerY).toBe(50);
    expect(result?.boardWidth).toBe(455);
  });
});
