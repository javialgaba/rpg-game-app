import { describe, it, expect } from 'vitest';
import {
  getFootprintCells,
  getBuildingFootprintCells,
  getRepairDistanceToBuilding,
  getNearestDamagedBuilding,
  getRepairModeTarget,
  getRepairModeTargetState,
} from './repairSystem';
import type { BuildingEntity } from './gameTypes';

const footprintCellsFn = (x: number, y: number, footprint?: { w: number; h: number }) =>
  getFootprintCells(x, y, footprint);

function makeBuilding(overrides: Partial<BuildingEntity> = {}): BuildingEntity {
  return {
    iso: { x: 0, y: 0 },
    hp: 50,
    max: 100,
    name: 'Hut',
    sprite: {} as any,
    footprint: { w: 1, h: 1 },
    ...overrides,
  };
}

// ---- getFootprintCells ----

describe('getFootprintCells', () => {
  it('returns single cell for 1x1 footprint', () => {
    const cells = getFootprintCells(5, 5, { w: 1, h: 1 });
    expect(cells).toEqual([{ x: 5, y: 5 }]);
  });

  it('returns 4 cells for 2x2 footprint', () => {
    const cells = getFootprintCells(5, 5, { w: 2, h: 2 });
    expect(cells).toHaveLength(4);
    expect(cells).toContainEqual({ x: 4, y: 4 });
    expect(cells).toContainEqual({ x: 5, y: 4 });
    expect(cells).toContainEqual({ x: 4, y: 5 });
    expect(cells).toContainEqual({ x: 5, y: 5 });
  });
});

// ---- getBuildingFootprintCells ----

describe('getBuildingFootprintCells', () => {
  it('returns pre-computed cells when present', () => {
    const building = makeBuilding({ footprintCells: [{ x: 99, y: 99 }] });
    const cells = getBuildingFootprintCells(building, footprintCellsFn);
    expect(cells).toEqual([{ x: 99, y: 99 }]);
  });

  it('computes cells from iso and footprint when missing', () => {
    const building = makeBuilding({ iso: { x: 10, y: 20 }, footprint: { w: 2, h: 2 } });
    const cells = getBuildingFootprintCells(building, footprintCellsFn);
    expect(cells).toHaveLength(4);
    expect(cells).toContainEqual({ x: 9, y: 19 });
    expect(cells).toContainEqual({ x: 10, y: 20 });
  });
});

// ---- getRepairDistanceToBuilding ----

describe('getRepairDistanceToBuilding', () => {
  it('returns infinity when player has no iso', () => {
    const building = makeBuilding();
    expect(getRepairDistanceToBuilding(building, null, footprintCellsFn)).toBe(Infinity);
  });

  it('returns distance from player to nearest footprint cell', () => {
    const building = makeBuilding({ iso: { x: 0, y: 0 }, footprint: { w: 1, h: 1 } });
    const dist = getRepairDistanceToBuilding(building, { x: 3, y: 4 }, footprintCellsFn);
    // distance from player (3,4) to cell center (0.5, 0.5) = sqrt(2.5^2 + 3.5^2) = sqrt(6.25 + 12.25) = sqrt(18.5) ≈ 4.30
    expect(dist).toBeCloseTo(4.301, 2);
  });

  it('returns distance to nearest cell for multi-cell building', () => {
    const building = makeBuilding({ iso: { x: 5, y: 5 }, footprint: { w: 2, h: 2 } });
    // cells are (4,4), (5,4), (4,5), (5,5). Player at (4.5, 4.5)
    // cell centers: (4.5, 4.5), (5.5, 4.5), (4.5, 5.5), (5.5, 5.5)
    // distance to (4.5, 4.5) is 0
    const dist = getRepairDistanceToBuilding(building, { x: 4.5, y: 4.5 }, footprintCellsFn);
    expect(dist).toBeCloseTo(0, 2);
  });
});

// ---- getNearestDamagedBuilding ----

describe('getNearestDamagedBuilding', () => {
  it('returns null when no buildings', () => {
    expect(getNearestDamagedBuilding([], { x: 0, y: 0 }, footprintCellsFn)).toBeNull();
  });

  it('returns null when no buildings are damaged', () => {
    const buildings = [makeBuilding({ hp: 100, max: 100 })];
    expect(getNearestDamagedBuilding(buildings, { x: 0, y: 0 }, footprintCellsFn)).toBeNull();
  });

  it('returns nearest damaged building', () => {
    const buildings = [
      makeBuilding({ iso: { x: 10, y: 0 }, hp: 50, max: 100 }),
      makeBuilding({ iso: { x: 2, y: 0 }, hp: 30, max: 100 }),
    ];
    const nearest = getNearestDamagedBuilding(buildings, { x: 0, y: 0 }, footprintCellsFn, 20);
    // building at (2,0) is distance 2, building at (10,0) is distance 10
    expect(nearest).toBe(buildings[1]);
  });
});

// ---- getRepairModeTarget ----

describe('getRepairModeTarget', () => {
  it('prioritizes damaged building over perfect one', () => {
    const buildings = [
      makeBuilding({ iso: { x: 2, y: 0 }, hp: 100, max: 100 }),
      makeBuilding({ iso: { x: 3, y: 0 }, hp: 50, max: 100 }),
    ];
    const target = getRepairModeTarget(buildings, { x: 0, y: 0 }, footprintCellsFn, 20);
    expect(target).toBe(buildings[1]);
  });

  it('returns nearest perfect when no damaged', () => {
    const buildings = [
      makeBuilding({ iso: { x: 10, y: 0 }, hp: 100, max: 100 }),
      makeBuilding({ iso: { x: 2, y: 0 }, hp: 100, max: 100 }),
    ];
    const target = getRepairModeTarget(buildings, { x: 0, y: 0 }, footprintCellsFn, 20);
    expect(target).toBe(buildings[1]);
  });

  it('returns null when nothing in range', () => {
    const buildings = [
      makeBuilding({ iso: { x: 100, y: 0 }, hp: 50, max: 100 }),
    ];
    const target = getRepairModeTarget(buildings, { x: 0, y: 0 }, footprintCellsFn, 10);
    expect(target).toBeNull();
  });
});

// ---- getRepairModeTargetState ----

describe('getRepairModeTargetState', () => {
  it('returns perfect when hp is full', () => {
    expect(getRepairModeTargetState(makeBuilding({ hp: 100, max: 100 }), 50)).toBe('perfect');
  });

  it('returns repairable when damaged and gold sufficient', () => {
    expect(getRepairModeTargetState(makeBuilding({ hp: 50, max: 100 }), 500)).toBe('repairable');
  });

  it('returns unaffordable when damaged and gold insufficient', () => {
    expect(getRepairModeTargetState(makeBuilding({ hp: 50, max: 100 }), 0)).toBe('unaffordable');
  });
});
