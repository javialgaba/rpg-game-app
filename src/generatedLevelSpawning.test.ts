import { describe, it, expect } from 'vitest';
import {
  isoToGridCell,
  getGeneratedEdgeSpawnPoints,
  getGeneratedFallbackSpawnAnchors,
  getGeneratedPlayableEdgeCells,
  type GeneratedLevelData,
} from './generatedLevelSpawning';

function makeLevel(overrides: Partial<GeneratedLevelData> = {}): GeneratedLevelData {
  return {
    width: 20,
    height: 20,
    spawnPoints: [
      { x: 0, y: 5 },
      { x: 10, y: 0 },
      { x: 19, y: 10 },
      { x: 5, y: 19 },
      { x: 10, y: 10 },
    ],
    walkableGrid: Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => true)),
    playableBounds: { minX: 0, minY: 0, maxX: 19, maxY: 19 },
    ...overrides,
  };
}

// ---- isoToGridCell ----

describe('isoToGridCell', () => {
  it('clamps x to grid bounds', () => {
    const level = makeLevel({ width: 10, height: 10 });
    expect(isoToGridCell({ x: -1, y: 5 }, level)).toEqual({ x: 0, y: 5 });
    expect(isoToGridCell({ x: 15, y: 5 }, level)).toEqual({ x: 9, y: 5 });
  });

  it('clamps y to grid bounds', () => {
    const level = makeLevel({ width: 10, height: 10 });
    expect(isoToGridCell({ x: 5, y: -1 }, level)).toEqual({ x: 5, y: 0 });
    expect(isoToGridCell({ x: 5, y: 15 }, level)).toEqual({ x: 5, y: 9 });
  });

  it('rounds iso coordinates', () => {
    const level = makeLevel();
    expect(isoToGridCell({ x: 3.2, y: 7.8 }, level)).toEqual({ x: 3, y: 8 });
  });

  it('returns default bounds when level is null', () => {
    // MAP_W and MAP_H are used as defaults
    const cell = isoToGridCell({ x: -5, y: -5 }, null);
    expect(cell.x).toBe(0);
    expect(cell.y).toBe(0);
  });
});

// ---- getGeneratedEdgeSpawnPoints ----

describe('getGeneratedEdgeSpawnPoints', () => {
  it('returns spawn points on playable edges', () => {
    const level = makeLevel({
      playableBounds: { minX: 0, minY: 0, maxX: 19, maxY: 19 },
    });
    const edgePoints = getGeneratedEdgeSpawnPoints(level);
    // (0,5): x=0 on minX edge ✓
    // (10,0): y=0 on minY edge ✓
    // (19,10): x=19 on maxX edge ✓
    // (5,19): y=19 on maxY edge ✓
    // (10,10): interior ✗
    expect(edgePoints).toHaveLength(4);
  });

  it('returns empty when level has no spawn points', () => {
    expect(getGeneratedEdgeSpawnPoints(null)).toEqual([]);
  });
});

// ---- getGeneratedFallbackSpawnAnchors ----

describe('getGeneratedFallbackSpawnAnchors', () => {
  it('returns mid-edge points from playable bounds', () => {
    const level = makeLevel({
      playableBounds: { minX: 0, minY: 0, maxX: 19, maxY: 19 },
    });
    const anchors = getGeneratedFallbackSpawnAnchors(level);
    // midX = 9, midY = 9
    expect(anchors).toEqual([
      { x: 0, y: 9 },
      { x: 9, y: 0 },
      { x: 19, y: 9 },
      { x: 9, y: 19 },
    ]);
  });

  it('returns empty when level is null', () => {
    expect(getGeneratedFallbackSpawnAnchors(null)).toEqual([]);
  });
});

// ---- getGeneratedPlayableEdgeCells ----

describe('getGeneratedPlayableEdgeCells', () => {
  it('returns walkable edge cells from playable bounds', () => {
    const level = makeLevel({
      playableBounds: { minX: 1, minY: 1, maxX: 3, maxY: 3 },
    });
    const cells = getGeneratedPlayableEdgeCells(level);
    // Edge cells from x=1..3 at y=1 and y=3, and y=2 at x=1 and x=3
    // All are walkable in test data
    expect(cells.length).toBeGreaterThan(0);
    // Every cell should be on an edge
    cells.forEach((cell) => {
      const onEdge = cell.y === 1 || cell.y === 3 || cell.x === 1 || cell.x === 3;
      expect(onEdge).toBe(true);
    });
  });

  it('returns empty when level is null', () => {
    expect(getGeneratedPlayableEdgeCells(null)).toEqual([]);
  });

  it('excludes non-walkable cells', () => {
    const grid = Array.from({ length: 5 }, (_, y) => (
      Array.from({ length: 5 }, () => y !== 1) // row 1 is not walkable
    ));
    const level = makeLevel({
      width: 5,
      height: 5,
      walkableGrid: grid,
      playableBounds: { minX: 0, minY: 0, maxX: 4, maxY: 4 },
    });
    const cells = getGeneratedPlayableEdgeCells(level);
    // y=1 cells should be excluded
    cells.forEach((cell) => {
      expect(cell.y).not.toBe(1);
    });
  });
});
