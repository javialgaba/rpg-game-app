import { describe, it, expect } from 'vitest';
import {
  pickWeighted,
  getEnemyArchetype,
  getEnemyVariant,
  getEnemyDisplayName,
  getEnemyFrameKey,
  getWorldEliteVisual,
  getBossVisual,
  calculateEnemyStats,
  calculateBossStats,
  calculateLevelBonus,
} from './enemySpawning';

// ---- pickWeighted ----

describe('pickWeighted', () => {
  it('returns null for empty array', () => {
    expect(pickWeighted([], 0)).toBeNull();
  });

  it('returns the only item when roll is 0', () => {
    const items = [{ weight: 10, name: 'only' }];
    expect(pickWeighted(items, 0)).toEqual({ weight: 10, name: 'only' });
  });

  it('returns the only item regardless of roll', () => {
    const items = [{ weight: 10, name: 'only' }];
    expect(pickWeighted(items, 0.99)).toEqual({ weight: 10, name: 'only' });
  });

  it('selects first item when roll is near 0', () => {
    const items = [
      { weight: 5, name: 'common' },
      { weight: 1, name: 'rare' },
    ];
    // roll=0 => r = 0, starts at 5 - 5 = 0, returns first
    expect(pickWeighted(items, 0)).toEqual({ weight: 5, name: 'common' });
  });

  it('selects second item when roll exceeds first weight ratio', () => {
    const items = [
      { weight: 3, name: 'a' },
      { weight: 7, name: 'b' },
    ];
    // total = 10, roll=0.5 => r = 5, 5 - 3 = 2 -> doesn't return a, 2 - 7 = -5 -> returns b
    expect(pickWeighted(items, 0.5)).toEqual({ weight: 7, name: 'b' });
  });

  it('selects last item when roll is near max', () => {
    const items = [
      { weight: 1, name: 'first' },
      { weight: 1, name: 'second' },
    ];
    // total = 2, roll = 0.99 => r = 1.98, 1.98 - 1 = 0.98 -> not first, 0.98 - 1 = -0.02 -> second
    expect(pickWeighted(items, 0.99)).toEqual({ weight: 1, name: 'second' });
  });

  it('falls through to last item if roll exceeds total', () => {
    const items = [
      { weight: 2, name: 'a' },
      { weight: 3, name: 'b' },
    ];
    // total = 5, roll = 1 => r = 5, 5 - 2 = 3, 3 - 3 = 0 -> technically <=0 so returns b
    expect(pickWeighted(items, 1)).toEqual({ weight: 3, name: 'b' });
  });
});

// ---- getEnemyArchetype ----

describe('getEnemyArchetype', () => {
  it('returns an archetype with unlockLevel ≤ given level', () => {
    const result = getEnemyArchetype(1, [], 0);
    // At level 1, only blob, sprite, mushroom are available (unlockLevel=1)
    expect(result.unlockLevel).toBeLessThanOrEqual(1);
  });

  it('preferred archetypes get extra weight but not guaranteed', () => {
    const result = getEnemyArchetype(1, ['blob'], 0);
    expect(result.key).toBe('blob'); // blob has highest weight + preference
  });

  it('returns lizard at level 2+ with high roll', () => {
    const result = getEnemyArchetype(2, [], 0.99);
    // At level 2: blob(4), sprite(3), mushroom(3), lizard(2). total=12.
    // roll=0.99 => r=11.88. 11.88-4=7.88, 7.88-3=4.88, 4.88-3=1.88, 1.88-2=-0.12 => lizard
    expect(result.key).toBe('lizard');
  });

  it('returns acorn at level 3+', () => {
    const result = getEnemyArchetype(3, [], 0.99);
    expect(result.key).toBe('acorn'); // acorn has unlockLevel 3
  });
});

// ---- getEnemyVariant ----

describe('getEnemyVariant', () => {
  it('returns normal at level 1', () => {
    const result = getEnemyVariant(1, 0);
    expect(result.key).toBe('normal');
  });

  it('returns bright at level 2 with high roll', () => {
    const result = getEnemyVariant(2, 0.99);
    // total weight at level 2: normal(7) + bright(3) = 10
    // roll=0.99 => r=9.9, 9.9-7=2.9, 2.9-3=-0.1 -> bright
    expect(result.key).toBe('bright');
  });

  it('returns elder at level 4+ with high roll', () => {
    const result = getEnemyVariant(4, 0.99);
    expect(result.key).toBe('elder');
  });

  it('prefers normal with low roll', () => {
    const result = getEnemyVariant(4, 0);
    expect(result.key).toBe('normal');
  });
});

// ---- getEnemyDisplayName ----

describe('getEnemyDisplayName', () => {
  it('joins variant and archetype labels', () => {
    expect(getEnemyDisplayName('bright', 'forest blob')).toBe('bright forest blob');
  });

  it('omits empty variant label', () => {
    expect(getEnemyDisplayName('', 'forest blob')).toBe('forest blob');
  });
});

// ---- getEnemyFrameKey ----

describe('getEnemyFrameKey', () => {
  it('builds frame key from prefix, row, column', () => {
    expect(getEnemyFrameKey('monster', 2, 3)).toBe('monster-2-3');
  });

  it('works with custom prefix', () => {
    expect(getEnemyFrameKey('elite_spring', 0, 1)).toBe('elite_spring-0-1');
  });
});

// ---- getWorldEliteVisual ----

describe('getWorldEliteVisual', () => {
  const alwaysExists = () => true;
  const neverExists = () => false;

  it('returns basic visual when level < 2', () => {
    const result = getWorldEliteVisual(1, 'normal', 0.5, 'elite_key', 'elite', [0, 1], 7, 1.2, 1.3, null, null, alwaysExists, 0.1);
    expect(result.frameSheetKey).toBe('monsterSheet');
    expect(result.framePrefix).toBe('monster');
  });

  it('returns basic visual when texture missing', () => {
    const result = getWorldEliteVisual(2, 'normal', 0.5, 'elite_key', 'elite', [0, 1], 7, 1.2, 1.3, null, null, neverExists, 0.1);
    expect(result.frameSheetKey).toBe('monsterSheet');
  });

  it('returns elite visual when conditions met', () => {
    const result = getWorldEliteVisual(2, 'bright', 0.5, 'elite_key', 'elite', [0, 1], 7, 1.2, 1.3, 0xffe7f4, null, alwaysExists, 0.1);
    expect(result.frameSheetKey).toBe('elite_key');
    expect(result.framePrefix).toBe('elite');
    expect(result.frameRow).toBe(0);
  });

  it('applies ambient tint when variant has no tint', () => {
    const result = getWorldEliteVisual(2, 'normal', 0.5, 'elite_key', 'elite', [0, 1], 7, 1.2, 1.3, 0xffe7f4, null, alwaysExists, 0);
    expect(result.tint).toBe(0xffe7f4);
  });
});

// ---- getBossVisual ----

describe('getBossVisual', () => {
  it('returns boss asset when texture exists', () => {
    const result = getBossVisual('boss_key', 'boss_fp', 0xff0000, () => true);
    expect(result.frameSheetKey).toBe('boss_key');
    expect(result.framePrefix).toBe('boss_fp');
  });

  it('falls back to monster sheet when texture missing', () => {
    const result = getBossVisual('boss_key', 'boss_fp', 0xff0000, () => false);
    expect(result.frameSheetKey).toBe('monsterSheet');
    expect(result.framePrefix).toBe('monster');
  });
});

// ---- calculateLevelBonus ----

describe('calculateLevelBonus', () => {
  it('returns 0 for level 1', () => expect(calculateLevelBonus(1)).toBe(0));
  it('returns 1 for level 2', () => expect(calculateLevelBonus(2)).toBe(1));
  it('returns 4 for level 5', () => expect(calculateLevelBonus(5)).toBe(4));
});

// ---- calculateEnemyStats ----

describe('calculateEnemyStats', () => {
  const blobArchetype = {
    key: 'blob', label: 'forest blob', row: 0, unlockLevel: 1, weight: 4,
    hp: 2, speed: 0.76, buildingDamage: 4, contactDamage: 1, size: 52,
    rewardGold: [6, 13] as [number, number], rewardXp: 13,
  };
  const normalVariant = {
    key: 'normal', label: '', unlockLevel: 1, weight: 7, tint: null,
    scale: 1, hp: 1, speed: 1, buildingDamage: 1, contactDamage: 1, reward: 1,
  };

  it('calculates base stats at level 1', () => {
    const stats = calculateEnemyStats(1, blobArchetype, normalVariant, 1, 1, false);
    expect(stats.maxHp).toBe(2);
    expect(stats.contactDamage).toBe(1);
    expect(stats.speed).toBeLessThanOrEqual(1.72);
  });

  it('scales stats with level', () => {
    const stats = calculateEnemyStats(5, blobArchetype, normalVariant, 1, 1, false);
    // levelBonus = 4, hp = round((2 + floor(4/2)) * 1) = round(4) = 4
    expect(stats.maxHp).toBe(4);
    // buildingDamage = max(1, round((4 + floor(4/3)) * 1)) = max(1, round(5)) = 5
    expect(stats.buildingDamage).toBe(5);
  });

  it('capped speed at 1.72', () => {
    const fastArchetype = { ...blobArchetype, speed: 10 };
    const stats = calculateEnemyStats(10, fastArchetype, normalVariant, 1, 1, false);
    expect(stats.speed).toBe(1.72);
  });
});

// ---- calculateBossStats ----

describe('calculateBossStats', () => {
  it('calculates boss stats with level and cycle bonuses', () => {
    const stats = calculateBossStats(1, 0, 0, 15, 72, 0.52, 8, 2, [30, 42] as [number, number], 40);
    expect(stats.maxHp).toBeGreaterThan(10);
    expect(stats.size).toBe(72);
    expect(stats.rewardGold[0]).toBe(30);
    expect(stats.rewardGold[1]).toBe(42);
  });

  it('scales with world index and cycle', () => {
    const stats = calculateBossStats(5, 2, 3, 15, 72, 0.52, 8, 2, [30, 42] as [number, number], 40);
    expect(stats.maxHp).toBeGreaterThan(30);
    expect(stats.size).toBeGreaterThan(80);
    expect(stats.rewardGold[0]).toBeGreaterThan(36);
  });
});
