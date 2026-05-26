import { describe, expect, it } from 'vitest';
import { HEART_DROP_REWARD } from './gameConfig';
import { getHeartDropHealAmount } from './rewardDrops';

describe('automatic heart rewards', () => {
  it('does not heal a full-health hero', () => {
    expect(getHeartDropHealAmount({
      currentHealth: 4,
      maxHealth: 4,
      defeatedSinceLastHeart: 20,
      enemyRole: 'mushroomBrute',
      random: () => 0,
    })).toBe(0);
  });

  it('uses normal and priority enemy chances for damaged heroes', () => {
    expect(getHeartDropHealAmount({
      currentHealth: 2,
      maxHealth: 4,
      defeatedSinceLastHeart: 1,
      enemyRole: 'sproutling',
      random: () => HEART_DROP_REWARD.normalChance - 0.001,
    })).toBe(1);
    expect(getHeartDropHealAmount({
      currentHealth: 2,
      maxHealth: 4,
      defeatedSinceLastHeart: 1,
      enemyRole: 'sproutling',
      random: () => HEART_DROP_REWARD.normalChance + 0.001,
    })).toBe(0);
    expect(getHeartDropHealAmount({
      currentHealth: 2,
      maxHealth: 4,
      defeatedSinceLastHeart: 1,
      enemyRole: 'spitter',
      random: () => HEART_DROP_REWARD.priorityChance - 0.001,
    })).toBe(1);
  });

  it('guarantees recovery from bosses and low-health pity', () => {
    expect(getHeartDropHealAmount({
      currentHealth: 3,
      maxHealth: 4,
      defeatedSinceLastHeart: 0,
      isBoss: true,
      random: () => 0.99,
    })).toBe(1);
    expect(getHeartDropHealAmount({
      currentHealth: 1,
      maxHealth: 4,
      defeatedSinceLastHeart: HEART_DROP_REWARD.lowHealthPityDefeats,
      enemyRole: 'sproutling',
      random: () => 0.99,
    })).toBe(1);
  });
});
