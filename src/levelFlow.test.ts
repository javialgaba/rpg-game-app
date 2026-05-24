import { describe, it, expect } from 'vitest';
import {
  calculateSpawnCount,
  calculateSpawnInterval,
  getCurrentRoundTitle,
  getNextWorldProgressionState,
  checkLevelClearCondition,
  calculateRoundReward,
  buildCountdownSequence,
} from './levelFlow';
import type { DroppedChest } from './gameTypes';

// ---- calculateSpawnCount ----

describe('calculateSpawnCount', () => {
  it('returns 1 for boss round regardless of level', () => {
    expect(calculateSpawnCount(1, true)).toBe(1);
    expect(calculateSpawnCount(10, true)).toBe(1);
  });

  it('scales with level for non-boss rounds', () => {
    // LEVEL_SPAWN_BASE + level * LEVEL_SPAWN_PER_LEVEL
    // Level 1: 3 + 2 = 5
    expect(calculateSpawnCount(1, false)).toBe(5);
    // Level 5: 3 + 10 = 13
    expect(calculateSpawnCount(5, false)).toBe(13);
  });

  it('caps at LEVEL_SPAWN_MAX (22)', () => {
    // Level 10: 3 + 20 = 23 -> capped to 22
    expect(calculateSpawnCount(10, false)).toBe(22);
    expect(calculateSpawnCount(50, false)).toBe(22);
  });
});

// ---- calculateSpawnInterval ----

describe('calculateSpawnInterval', () => {
  it('decreases with level but not below minimum', () => {
    const interval1 = calculateSpawnInterval(1);
    const interval5 = calculateSpawnInterval(5);
    expect(interval5).toBeLessThan(interval1);
  });

  it('does not go below LEVEL_SPAWN_INTERVAL_MIN (300)', () => {
    const interval = calculateSpawnInterval(50);
    expect(interval).toBeGreaterThanOrEqual(300);
  });
});

// ---- getCurrentRoundTitle ----

describe('getCurrentRoundTitle', () => {
  it('returns boss label for boss rounds', () => {
    expect(getCurrentRoundTitle(5, true, 'Spring', 'Spring Boss')).toBe('Spring Boss');
  });

  it('returns "Level N" for normal rounds', () => {
    expect(getCurrentRoundTitle(1, false, 'Spring', 'Spring Boss')).toBe('Level 1');
    expect(getCurrentRoundTitle(7, false, 'Spring', 'Spring Boss')).toBe('Level 7');
  });
});

// ---- getNextWorldProgressionState ----

describe('getNextWorldProgressionState', () => {
  it('increments worldRound for non-boss rounds', () => {
    const result = getNextWorldProgressionState(0, 1, 0);
    expect(result.worldRound).toBe(2);
    expect(result.bossRound).toBe(false);
    expect(result.worldIndex).toBe(0);
    expect(result.worldCycle).toBe(0);
  });

  it('marks bossRound when next round is BOSS_ROUND_INDEX', () => {
    const result = getNextWorldProgressionState(2, 3, 0);
    // worldRound 3 + 1 = 4, 4 === BOSS_ROUND_INDEX (4)
    expect(result.worldRound).toBe(4);
    expect(result.bossRound).toBe(true);
  });

  it('advances to next world after boss round', () => {
    const result = getNextWorldProgressionState(1, 4, 0);
    expect(result.worldIndex).toBe(2);
    expect(result.worldRound).toBe(1);
    expect(result.bossRound).toBe(false);
  });

  it('wraps around and increments worldCycle when advancing past the end', () => {
    // Last world index = 3 (noon_winter)
    const result = getNextWorldProgressionState(3, 4, 0);
    expect(result.worldIndex).toBe(0);
    expect(result.worldRound).toBe(1);
    expect(result.worldCycle).toBe(1);
  });

  it('preserves worldCycle when not looping', () => {
    const result = getNextWorldProgressionState(0, 1, 2);
    expect(result.worldCycle).toBe(2);
  });
});

// ---- checkLevelClearCondition ----

describe('checkLevelClearCondition', () => {
  const makeChest = (opened: boolean, source: 'enemyDrop' = 'enemyDrop'): DroppedChest => ({
    iso: { x: 0, y: 0 },
    sprite: null as any,
    glow: null as any,
    reward: 'bonus-upgrade',
    opened,
    bob: 0,
    source,
    spawnedAt: 0,
    despawnAt: 0,
    blinkAt: 0,
  });

  it('returns true when all conditions met', () => {
    expect(checkLevelClearCondition('playing', false, 5, 5, 0, 5, false, [])).toBe(true);
  });

  it('returns false when phase is not playing', () => {
    expect(checkLevelClearCondition('countdown', false, 5, 5, 0, 5, false, [])).toBe(false);
  });

  it('returns false when already queued', () => {
    expect(checkLevelClearCondition('playing', true, 5, 5, 0, 5, false, [])).toBe(false);
  });

  it('returns false when defeats below required', () => {
    expect(checkLevelClearCondition('playing', false, 3, 5, 0, 5, false, [])).toBe(false);
  });

  it('returns false when spawns still pending', () => {
    expect(checkLevelClearCondition('playing', false, 5, 5, 2, 5, false, [])).toBe(false);
  });

  it('returns false when no real spawns occurred and not boss round', () => {
    expect(checkLevelClearCondition('playing', false, 0, 0, 0, 0, false, [])).toBe(false);
  });

  it('treats boss round as having real spawns even with count 0', () => {
    expect(checkLevelClearCondition('playing', false, 5, 5, 0, 0, true, [])).toBe(true);
  });

  it('returns false when unopened enemy-drop chests exist', () => {
    const chests = [makeChest(false)];
    expect(checkLevelClearCondition('playing', false, 5, 5, 0, 5, false, chests)).toBe(false);
  });

  it('returns true when chests are opened', () => {
    const chests = [makeChest(true)];
    expect(checkLevelClearCondition('playing', false, 5, 5, 0, 5, false, chests)).toBe(true);
  });
});

// ---- calculateRoundReward ----

describe('calculateRoundReward', () => {
  it('gives normal rewards for non-boss rounds', () => {
    // 20 + level * 8
    expect(calculateRoundReward(false, 1, 0, 'day_spring').gold).toBe(28);
    // 20 + level * 8 = 20 + 5 * 8 = 60
    expect(calculateRoundReward(false, 5, 0, 'day_spring').gold).toBe(60);
    // 28 + level * 10 = 28 + 90 = 118, wait that's XP
    expect(calculateRoundReward(false, 9, 0, 'day_spring').xp).toBe(118);
  });
});

// ---- buildCountdownSequence ----

describe('buildCountdownSequence', () => {
  it('builds 5-element sequence starting with round title', () => {
    const seq = buildCountdownSequence('Level 3');
    expect(seq).toEqual(['Level 3', '3', '2', '1', 'Go!']);
  });
});
