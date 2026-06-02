import { describe, expect, it } from 'vitest';
import {
  calculateBossStats,
  calculateEnemyStats,
  getBossVisual,
  getEnemyArchetype,
  getEnemyDisplayName,
  getEnemyFrameKey,
  getEnemyVariant,
} from './enemySpawning';

describe('enemy roles', () => {
  it('looks up readable combat roles with their budget costs', () => {
    expect(getEnemyArchetype('sproutling').cost).toBe(1);
    expect(getEnemyArchetype('mushroomBrute').cost).toBe(4);
    expect(getEnemyArchetype('bombBud').label).toBe('Bomb Bud');
  });

  it('keeps visual variant progression for ordinary enemies', () => {
    expect(getEnemyVariant(1, 0.99).key).toBe('normal');
    expect(getEnemyVariant(2, 0.99).key).toBe('bright');
    expect(getEnemyVariant(4, 0.99).key).toBe('elder');
  });

  it('formats role names and atlas frame keys', () => {
    expect(getEnemyDisplayName('bright', 'Sproutling')).toBe('bright Sproutling');
    expect(getEnemyFrameKey('monster', 2, 3)).toBe('monster-2-3');
  });
});

describe('enemy combat stats', () => {
  it('scales ordinary enemies without an XP reward channel', () => {
    const stats = calculateEnemyStats(
      5,
      getEnemyArchetype('sproutling'),
      getEnemyVariant(1, 0),
      1,
      1,
      false,
    );
    expect(stats.maxHp).toBe(3);
    expect(stats.buildingDamage).toBe(5);
    expect(stats.rewardGold).toEqual([10, 17]);
    expect(stats).not.toHaveProperty('rewardXp');
  });

  it('scales guardian stats using gold rewards only', () => {
    const stats = calculateBossStats(5, 2, 3, 15, 72, 0.52, 8, 2, [30, 42]);
    expect(stats.maxHp).toBe(47);
    expect(stats.speed).toBeCloseTo(0.958);
    expect(stats.buildingDamage).toBe(12);
    expect(stats.rewardGold[0]).toBe(46);
    expect(stats).not.toHaveProperty('rewardXp');
  });
});

describe('boss visuals', () => {
  it('uses the seasonal guardian sheet when present', () => {
    const visual = getBossVisual('boss_key', 'boss_fp', 0xff0000, () => true);
    expect(visual.frameSheetKey).toBe('boss_key');
    expect(visual.framePrefix).toBe('boss_fp');
  });

  it('falls back to the ordinary sheet if an asset is unavailable', () => {
    expect(getBossVisual('missing', 'boss_fp', null, () => false).frameSheetKey).toBe('monsterSheet');
  });
});
