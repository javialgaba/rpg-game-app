import { describe, it, expect } from 'vitest';
import {
  getBuildingHealthColor,
  computeWeightedHealth,
  computeTotalImportance,
  computeVillageSafety,
} from './buildingSystem';
import type { BuildingEntity } from './gameTypes';

function makeBuilding(overrides: Partial<BuildingEntity> = {}): BuildingEntity {
  return {
    iso: { x: 0, y: 0 },
    hp: 100,
    max: 100,
    name: 'Hut',
    sprite: {} as any,
    footprint: { w: 1, h: 1 },
    ...overrides,
  };
}

// ---- getBuildingHealthColor ----

describe('getBuildingHealthColor', () => {
  it('returns green for ratio > 0.6', () => {
    expect(getBuildingHealthColor(1)).toBe(0x59c96b);
    expect(getBuildingHealthColor(0.61)).toBe(0x59c96b);
  });

  it('returns yellow for ratio 0.3-0.6', () => {
    expect(getBuildingHealthColor(0.6)).toBe(0xf2c94c);
    expect(getBuildingHealthColor(0.31)).toBe(0xf2c94c);
  });

  it('returns red for ratio <= 0.3', () => {
    expect(getBuildingHealthColor(0.3)).toBe(0xe65a45);
    expect(getBuildingHealthColor(0)).toBe(0xe65a45);
  });
});

// ---- computeWeightedHealth ----

describe('computeWeightedHealth', () => {
  it('returns 0 for empty list', () => {
    expect(computeWeightedHealth([])).toBe(0);
  });

  it('computes weighted sum', () => {
    const buildings = [
      makeBuilding({ hp: 50, max: 100, importance: 2 }),
      makeBuilding({ hp: 100, max: 100, importance: 1 }),
    ];
    // (0.5 * 2) + (1.0 * 1) = 2.0
    expect(computeWeightedHealth(buildings)).toBe(2.0);
  });
});

// ---- computeTotalImportance ----

describe('computeTotalImportance', () => {
  it('returns 0 for empty list', () => {
    expect(computeTotalImportance([])).toBe(0);
  });

  it('sums importance values', () => {
    const buildings = [
      makeBuilding({ importance: 2 }),
      makeBuilding({ importance: 3 }),
    ];
    expect(computeTotalImportance(buildings)).toBe(5);
  });

  it('defaults importance to 1', () => {
    const buildings = [makeBuilding({ importance: undefined })];
    expect(computeTotalImportance(buildings)).toBe(1);
  });
});

// ---- computeVillageSafety ----

describe('computeVillageSafety', () => {
  it('returns 100 when all buildings full HP', () => {
    const buildings = [makeBuilding({ hp: 100, max: 100 })];
    const safety = computeVillageSafety(buildings, 100);
    expect(safety).toBe(100);
  });

  it('returns lower when buildings damaged', () => {
    const buildings = [makeBuilding({ hp: 50, max: 100 })];
    const safety = computeVillageSafety(buildings, 100);
    // target = (0.5) * 100 = 50
    // result = round((100*3 + 50)/4) = round(350/4) = round(87.5) = 88
    expect(safety).toBe(88);
  });

  it('clamps to 0-100 range', () => {
    const buildings = [makeBuilding({ hp: 0, max: 100 })];
    const safety = computeVillageSafety(buildings, 0);
    // target = 0, result = round((0*3 + 0)/4) = 0
    expect(safety).toBe(0);
  });
});
