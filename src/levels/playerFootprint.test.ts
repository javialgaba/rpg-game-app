import { describe, expect, it } from 'vitest';
import {
  buildPlayerReachableGrid,
  findNearestPlayerSafeCell,
  getPlayerPocketCells,
  isPlayerSafeCell,
} from './playerFootprint';

const grid = (rows: string[]) => rows.map((row) => [...row].map((cell) => cell === '.'));

describe('player clearance topology', () => {
  it('finds cells reachable from the authored player spawn', () => {
    const walkable = grid([
      '#####',
      '#...#',
      '###.#',
      '#...#',
      '#####',
    ]);
    const reachable = buildPlayerReachableGrid(walkable, { x: 1, y: 1 });
    expect(reachable[3][1]).toBe(true);
    expect(getPlayerPocketCells(walkable, reachable)).toEqual([]);
  });

  it('reports disconnected clear cells as trapped pockets', () => {
    const walkable = grid([
      '#######',
      '#...#.#',
      '#######',
    ]);
    const reachable = buildPlayerReachableGrid(walkable, { x: 1, y: 1 });
    expect(getPlayerPocketCells(walkable, reachable)).toEqual([{ x: 5, y: 1 }]);
  });

  it('rejects an isolated standing cell with no escape direction', () => {
    expect(isPlayerSafeCell(grid([
      '###',
      '#.#',
      '###',
    ]), { x: 1, y: 1 })).toBe(false);
  });

  it('recovers to the nearest reachable cell with an escape', () => {
    const reachable = grid([
      '#####',
      '#...#',
      '#####',
    ]);
    expect(findNearestPlayerSafeCell(reachable, { x: 4, y: 1 })).toEqual({ x: 3, y: 1 });
  });
});
