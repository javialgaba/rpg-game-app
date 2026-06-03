import { describe, expect, it } from 'vitest';
import { canTriggerPhaseAction, getScreenMovementVector, normalizeMovementVector } from './inputSystem';

describe('input helpers', () => {
  it('normalizes diagonal movement', () => {
    const vector = normalizeMovementVector({ x: 1, y: 1 });
    expect(vector.x).toBeCloseTo(Math.SQRT1_2);
    expect(vector.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('combines keyboard and joystick movement', () => {
    expect(getScreenMovementVector({ left: true, right: true })).toEqual({ x: 0, y: 0 });
    const vector = getScreenMovementVector({
      right: true,
      joystickVisible: true,
      joystickVector: { x: 0.5, y: 0.5 },
    });
    expect(vector.x).toBeGreaterThan(vector.y);
    expect(Math.hypot(vector.x, vector.y)).toBeCloseTo(1);
  });

  it('gates phase actions', () => {
    expect(canTriggerPhaseAction('splash', 'start')).toBe(true);
    expect(canTriggerPhaseAction('playing', 'start')).toBe(false);
    expect(canTriggerPhaseAction('levelUp', 'levelUpChoice')).toBe(true);
    expect(canTriggerPhaseAction('gameOver', 'restart')).toBe(true);
  });
});
