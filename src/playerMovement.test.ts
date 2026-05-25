import { describe, expect, it } from 'vitest';
import {
  projectIsoMovementToScreen,
  resolvePlayerMovement,
  screenDirectionToIsoMovement,
} from './playerMovement';

const metrics = { tileW: 88, tileH: 44 };

describe('screen-relative isometric movement', () => {
  it('maps visible cardinal controls to matching projected travel', () => {
    [
      { input: { x: 0, y: -1 }, expected: { x: 0, y: -1 } },
      { input: { x: 0, y: 1 }, expected: { x: 0, y: 1 } },
      { input: { x: -1, y: 0 }, expected: { x: -1, y: 0 } },
      { input: { x: 1, y: 0 }, expected: { x: 1, y: 0 } },
    ].forEach(({ input, expected }) => {
      const isoMovement = screenDirectionToIsoMovement(input, metrics);
      const screenMovement = projectIsoMovementToScreen(isoMovement, metrics);
      const length = Math.hypot(screenMovement.x, screenMovement.y);
      expect(screenMovement.x / length).toBeCloseTo(expected.x);
      expect(screenMovement.y / length).toBeCloseTo(expected.y);
    });
  });

  it('keeps projected movement speed equal across visible directions', () => {
    const speeds = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ].map((direction) => {
      const projected = projectIsoMovementToScreen(screenDirectionToIsoMovement(direction, metrics), metrics);
      return Math.hypot(projected.x, projected.y);
    });
    speeds.forEach((speed) => expect(speed).toBeCloseTo(speeds[0]));
  });

  it('preserves partial joystick tilt as partial visible speed', () => {
    const full = projectIsoMovementToScreen(screenDirectionToIsoMovement({ x: 0, y: -1 }, metrics), metrics);
    const partial = projectIsoMovementToScreen(screenDirectionToIsoMovement({ x: 0, y: -0.4 }, metrics), metrics);
    expect(Math.hypot(partial.x, partial.y)).toBeCloseTo(Math.hypot(full.x, full.y) * 0.4);
  });
});

describe('continuous movement resolution', () => {
  it('allows an open screen-vertical escape beside a blocked neighbor', () => {
    const movement = screenDirectionToIsoMovement({ x: 0, y: -1 }, metrics);
    const result = resolvePlayerMovement({ x: 4, y: 4 }, movement, 0.2, (point) => (
      point.x < 4 || point.y < 4
    ));
    expect(result.moved).toBe(true);
    expect(result.position.x).toBeLessThan(4);
    expect(result.position.y).toBeLessThan(4);
  });

  it('slides along a corner without accepting the blocked diagonal destination', () => {
    const result = resolvePlayerMovement({ x: 2, y: 2 }, { x: 1, y: 1 }, 0.2, (point) => (
      point.x <= 2 && point.y <= 2.2
    ));
    expect(result).toEqual({
      position: { x: 2, y: 2.2 },
      moved: true,
      blocked: false,
    });
  });

  it('does not cross a fully blocking footprint', () => {
    const result = resolvePlayerMovement({ x: 2, y: 2 }, { x: 1, y: 0 }, 0.2, () => false);
    expect(result).toEqual({
      position: { x: 2, y: 2 },
      moved: false,
      blocked: true,
    });
  });
});
