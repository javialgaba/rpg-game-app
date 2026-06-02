import { describe, expect, it } from 'vitest';
import { getNearestCombatTarget } from './combatTargeting';

const makeEnemy = (
  x: number,
  y: number,
  state: Partial<{
    defeated: boolean;
    retreating: boolean;
    entranceState: string;
  }> = {},
) => ({
  iso: { x, y },
  ...state,
});

describe('combat targeting', () => {
  it('selects the nearest enemy even when it appears later in the array', () => {
    const oldestEnemy = makeEnemy(3, 0);
    const nearestEnemy = makeEnemy(1, 0);

    expect(getNearestCombatTarget([oldestEnemy, nearestEnemy], { x: 0, y: 0 }, 5)).toBe(nearestEnemy);
  });

  it('ignores defeated enemies', () => {
    const defeatedEnemy = makeEnemy(1, 0, { defeated: true });
    const validEnemy = makeEnemy(2, 0);

    expect(getNearestCombatTarget([defeatedEnemy, validEnemy], { x: 0, y: 0 }, 5)).toBe(validEnemy);
  });

  it('ignores retreating enemies', () => {
    const retreatingEnemy = makeEnemy(1, 0, { retreating: true });
    const validEnemy = makeEnemy(2, 0);

    expect(getNearestCombatTarget([retreatingEnemy, validEnemy], { x: 0, y: 0 }, 5)).toBe(validEnemy);
  });

  it('ignores enemies still approaching the entrance', () => {
    const approachingEnemy = makeEnemy(1, 0, { entranceState: 'approaching' });
    const validEnemy = makeEnemy(2, 0);

    expect(getNearestCombatTarget([approachingEnemy, validEnemy], { x: 0, y: 0 }, 5)).toBe(validEnemy);
  });

  it('returns null when every enemy is out of range', () => {
    expect(getNearestCombatTarget([makeEnemy(6, 0)], { x: 0, y: 0 }, 5)).toBeNull();
  });

  it('supports projectile overlap checks by selecting the nearest enemy to the projectile', () => {
    const oldestEnemy = makeEnemy(0.5, 0);
    const nearestEnemy = makeEnemy(0.1, 0);

    expect(getNearestCombatTarget([oldestEnemy, nearestEnemy], { x: 0, y: 0 }, 0.54)).toBe(nearestEnemy);
  });
});
