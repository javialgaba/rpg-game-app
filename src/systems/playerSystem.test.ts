import { describe, expect, it } from 'vitest';
import { appendPlayerMovementTrace, resolveAutoTargetIso } from './playerSystem';

describe('player helpers', () => {
  it('keeps only the latest movement trace entries', () => {
    const trace = appendPlayerMovementTrace(
      [{
        position: { x: 0, y: 0 },
        intendedScreen: { x: 1, y: 0 },
        intendedIso: { x: 1, y: 0 },
        selectedScreen: null,
        reason: null,
        blocked: false,
      }],
      { x: 2, y: 2 },
      {
        intendedScreen: { x: 0, y: 1 },
        intendedIso: { x: 2, y: 3 },
        selectedScreen: { x: 0, y: 1 },
        reason: 'slide',
        blocked: false,
      },
      1,
    );
    expect(trace).toEqual([{
      position: { x: 2, y: 2 },
      intendedScreen: { x: 0, y: 1 },
      intendedIso: { x: 2, y: 3 },
      selectedScreen: { x: 0, y: 1 },
      reason: 'slide',
      blocked: false,
    }]);
  });

  it('targets nearest active enemy and ignores unavailable enemies', () => {
    const target = resolveAutoTargetIso(
      { x: 5, y: 5 },
      { x: 1, y: 0 },
      [
        { iso: { x: 6, y: 5 }, defeated: true },
        { iso: { x: 7, y: 5 } },
        { iso: { x: 5.5, y: 5 } },
      ],
      3,
      (point) => point,
    );
    expect(target).toEqual({ x: 5.5, y: 5 });
  });

  it('falls back to clamped facing target when no enemy is available', () => {
    const target = resolveAutoTargetIso(
      { x: 5, y: 5 },
      { x: 1, y: 0 },
      [{ iso: { x: 6, y: 5 }, entranceState: 'approaching' }],
      2,
      (point, padding) => ({ x: point.x + (padding ?? 0), y: point.y }),
    );
    expect(target).toEqual({ x: 7.8, y: 5 });
  });
});
