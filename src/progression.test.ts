import { describe, expect, it } from 'vitest';
import { ENEMY_ARCHETYPES, HERO_CLASSES } from './gameConfig';
import {
  applyCardStats,
  buildWaveRoster,
  canOfferMagicRepair,
  chooseCardOffer,
  createEmptyCardTiers,
  getAvailableEnemyRoles,
  getSkillMilestoneConfig,
  getWaveBudget,
  percentageForTiers,
} from './progression';

describe('classes and persistent cards', () => {
  it('defines distinct fair starting class stats', () => {
    expect(HERO_CLASSES.warrior.maxHealth).toBe(4);
    expect(HERO_CLASSES.archer.attackRange).toBe(9);
    expect(HERO_CLASSES.sorcerer.attackCooldown).toBe(620);
  });

  it('applies percentage card tiers to class base stats and caps at tier V', () => {
    const tiers = { ...createEmptyCardTiers(), swiftBoots: 5, strongerStrikes: 1, quickHands: 5, toughHeart: 2 };
    const stats = applyCardStats('warrior', tiers);
    expect(percentageForTiers('swiftBoots', 8)).toBe(0.36);
    expect(stats.maxHealth).toBe(6);
    expect(stats.attackDamage).toBeCloseTo(2.3);
    expect(stats.attackCooldown).toBeLessThan(HERO_CLASSES.warrior.attackCooldown);
  });
});

describe('card offers', () => {
  const healthy = [{ hp: 100, max: 100 }];
  const damaged = [{ hp: 50, max: 100 }];

  it('only offers Magic Repair for critically damaged surviving buildings and not twice consecutively', () => {
    expect(canOfferMagicRepair(damaged as any, null)).toBe(true);
    expect(canOfferMagicRepair(healthy as any, null)).toBe(false);
    expect(canOfferMagicRepair(damaged as any, 'magicRepair')).toBe(false);
  });

  it('offers one offense or mobility card and one survival or village card', () => {
    const offer = chooseCardOffer(createEmptyCardTiers(), healthy as any, null, [], () => 0);
    expect(offer.map((card) => card.key)).toEqual(['strongerStrikes', 'toughHeart']);
  });
});

describe('skill milestones and wave curves', () => {
  it('resolves skill growth at levels 3, 5, 7, and 9', () => {
    expect(getSkillMilestoneConfig('warrior', 3).pushback).toBe(0.65);
    expect(getSkillMilestoneConfig('archer', 9).maxActive).toBe(2);
    expect(getSkillMilestoneConfig('sorcerer', 7).cooldown).toBe(7000);
  });

  it('unlocks class-specific pressure and builds exact budget waves', () => {
    expect(getAvailableEnemyRoles('archer', 3)).toContain('leafSneak');
    expect(getAvailableEnemyRoles('warrior', 4)).not.toContain('spitter');
    expect(getWaveBudget(10)).toBe(46);
    const roster = buildWaveRoster('sorcerer', 4, () => 0.99);
    const costs = new Map(ENEMY_ARCHETYPES.map((enemy) => [enemy.key, enemy.cost]));
    expect(roster.reduce((sum, enemy) => sum + (costs.get(enemy) ?? 0), 0)).toBe(getWaveBudget(4));
  });
});
