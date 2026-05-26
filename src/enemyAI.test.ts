import { describe, it, expect } from 'vitest';
import {
  getNearestForestExit,
  getPathProgress,
  hasReachedAttackZone,
  canDamagePlayer,
  canDamageBuilding,
  isRetreatComplete,
} from './enemyAI';

// ---- getNearestForestExit ----

describe('getNearestForestExit', () => {
  it('returns north exit when enemy is near top', () => {
    const exit = getNearestForestExit({ x: 7, y: 1 }, false, null, null);
    expect(exit.y).toBe(0.8);
  });

  it('returns south exit when enemy is near bottom', () => {
    const exit = getNearestForestExit({ x: 7, y: 13 }, false, null, null);
    expect(exit.y).toBe(14.2);
  });

  it('returns west exit when enemy is near left edge', () => {
    const exit = getNearestForestExit({ x: 1, y: 7 }, false, null, null);
    expect(exit.x).toBe(0.8);
  });

  it('returns east exit when enemy is near right edge', () => {
    const exit = getNearestForestExit({ x: 13, y: 7 }, false, null, null);
    expect(exit.x).toBe(14.2);
  });

  it('uses generated level bounds when active', () => {
    const exit = getNearestForestExit({ x: 5, y: 5 }, true, 20, 20);
    // maxX = 20 - 0.8 = 19.2, maxY = 20 - 0.8 = 19.2
    // Center position, should choose nearest exit
    // (5,5) to (5,0.8) = 4.2, (5,5) to (19.2,5) = 14.2, (5,5) to (5,19.2) = 14.2, (5,5) to (0.8,5) = 4.2
    // Either north (4.2) or west (4.2) are shortest
    expect(exit.y === 0.8 || exit.x === 0.8).toBe(true);
  });
});

// ---- getPathProgress ----

describe('getPathProgress', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 4, y: 0 },
    { x: 6, y: 0 },
  ];

  it('returns same index when far from next waypoint', () => {
    const result = getPathProgress(path, 0, { x: 0, y: 0 }, 0.38);
    expect(result.pathIndex).toBe(1);
  });

  it('advances index when close enough to waypoint', () => {
    const result = getPathProgress(path, 1, { x: 2, y: 0 }, 0.38);
    expect(result.pathIndex).toBe(2);
  });

  it('stays at last index when at end', () => {
    const result = getPathProgress(path, 3, { x: 5.8, y: 0 }, 0.38);
    expect(result.pathIndex).toBe(3);
    expect(result.targetIso).toEqual({ x: 6, y: 0 });
  });

  it('skips multiple waypoints in one step', () => {
    const result = getPathProgress(path, 0, { x: 0.1, y: 0 }, 2.5);
    expect(result.pathIndex).toBeGreaterThan(1);
  });
});

// ---- hasReachedAttackZone ----

describe('hasReachedAttackZone', () => {
  it('returns true when no path and close to target', () => {
    expect(hasReachedAttackZone(null, 0, 0.3)).toBe(true);
  });

  it('returns true when at end of path and close to target', () => {
    expect(hasReachedAttackZone([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1, 0.3)).toBe(true);
  });

  it('returns false when far from target', () => {
    expect(hasReachedAttackZone([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1, 1.5)).toBe(false);
  });
});

// ---- canDamagePlayer ----

describe('canDamagePlayer', () => {
  it('returns false when retreating', () => {
    expect(canDamagePlayer({ x: 0, y: 0 }, { x: 0.3, y: 0 }, true, 0, 100)).toBe(false);
  });

  it('returns false when outside range', () => {
    expect(canDamagePlayer({ x: 0, y: 0 }, { x: 2, y: 0 }, false, 0, 100)).toBe(false);
  });

  it('returns false during cooldown', () => {
    expect(canDamagePlayer({ x: 0, y: 0 }, { x: 0.3, y: 0 }, false, 100, 50)).toBe(false);
  });

  it('returns true when in range and past cooldown', () => {
    expect(canDamagePlayer({ x: 0, y: 0 }, { x: 0.3, y: 0 }, false, 0, 100)).toBe(true);
  });
});

// ---- canDamageBuilding ----

describe('canDamageBuilding', () => {
  it('returns true when all conditions met', () => {
    expect(canDamageBuilding(false, true, 0.3, 0, 100)).toBe(true);
  });

  it('returns false during cooldown', () => {
    expect(canDamageBuilding(false, true, 0.3, 100, 50)).toBe(false);
  });

  it('returns false when retreating', () => {
    expect(canDamageBuilding(true, true, 0.3, 0, 100)).toBe(false);
  });
});

// ---- isRetreatComplete ----

describe('isRetreatComplete', () => {
  it('returns true when close enough to exit', () => {
    expect(isRetreatComplete({ x: 0.5, y: 1 }, { x: 0.8, y: 1 })).toBe(true);
  });

  it('returns false when far from exit', () => {
    expect(isRetreatComplete({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false);
  });
});
