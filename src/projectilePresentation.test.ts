import { describe, expect, it } from 'vitest';
import { getDirectionalProjectileRotation, getScreenTravelHeading } from './projectilePresentation';

const projectIso = (x: number, y: number) => ({
  x: (x - y) * 32,
  y: (x + y) * 16,
});

describe('directional projectile presentation', () => {
  it('uses projected screen travel rather than grid velocity', () => {
    const heading = getScreenTravelHeading({ x: 2, y: 2 }, { x: 1, y: 0 }, projectIso);
    expect(heading).toBeCloseTo(Math.atan2(16, 32));
  });

  it('aligns the diagonal source arrow with cardinal projected travel', () => {
    const rotation = getDirectionalProjectileRotation('arrow', { x: 0, y: 0 }, { x: 0, y: -1 }, projectIso);
    expect(rotation).toBeCloseTo(Math.atan2(-16, 32) + Math.PI / 4);
  });

  it('changes facing after a reflected velocity reversal', () => {
    const outbound = getDirectionalProjectileRotation('arrow', { x: 0, y: 0 }, { x: 1, y: 1 }, projectIso);
    const reflected = getDirectionalProjectileRotation('arrow', { x: 0, y: 0 }, { x: -1, y: -1 }, projectIso);
    expect(Math.abs((reflected as number) - (outbound as number))).toBeCloseTo(Math.PI);
  });

  it('leaves symmetrical projectile types unrotated', () => {
    expect(getDirectionalProjectileRotation('bolt', { x: 0, y: 0 }, { x: 1, y: 0 }, projectIso)).toBeNull();
  });
});
