import { describe, expect, it } from 'vitest';
import {
  buildCountdownSequence,
  calculateRoundReward,
  calculateSpawnCount,
  calculateSpawnInterval,
  checkLevelClearCondition,
  createRunResumeSnapshot,
  getCurrentRoundTitle,
  getNextWorldProgressionState,
} from './levelFlow';

describe('wave scheduling', () => {
  it('spawns a single seasonal guardian on boss rounds', () => {
    expect(calculateSpawnCount(1, true)).toBe(1);
    expect(calculateSpawnCount(10, true)).toBe(1);
  });

  it('uses the budgeted level-one Sproutling wave', () => {
    expect(calculateSpawnCount(1, false, 'warrior')).toBe(6);
    expect(calculateSpawnCount(1, false, 'archer')).toBe(6);
  });

  it('maintains a minimum spawn interval', () => {
    expect(calculateSpawnInterval(5)).toBeLessThan(calculateSpawnInterval(1));
    expect(calculateSpawnInterval(50)).toBeGreaterThanOrEqual(300);
  });
});

describe('world flow', () => {
  it('shows guardian titles on guardian rounds', () => {
    expect(getCurrentRoundTitle(5, true, 'Spring', 'Spring Guardian')).toBe('Spring Guardian');
    expect(getCurrentRoundTitle(2, false, 'Spring', 'Spring Guardian')).toBe('Level 2');
  });

  it('reaches the fourth-round guardian and then advances the season', () => {
    expect(getNextWorldProgressionState(0, 3, 0).bossRound).toBe(true);
    const nextSeason = getNextWorldProgressionState(1, 4, 0);
    expect(nextSeason.worldIndex).toBe(2);
    expect(nextSeason.worldRound).toBe(1);
  });

  it('carries class, cards, and building health into a seasonal resume', () => {
    const state = {
      health: 3,
      gold: 44,
      level: 4,
      villageSafety: 70,
      equipped: 'Bow Shot',
      gameOverReason: '',
    } as any;
    const next = getNextWorldProgressionState(0, 4, 0);
    const snapshot = createRunResumeSnapshot({}, state, 'archer', { swiftBoots: 1 }, next, 'Summer rises.', [
      { id: 'bakery', name: 'Bakery', hp: 32, max: 115 },
    ]);
    expect(snapshot.heroClass).toBe('archer');
    expect(snapshot.cardTiers.swiftBoots).toBe(1);
    expect(snapshot.buildings[0]).toEqual({ id: 'bakery', name: 'Bakery', hp: 32, max: 115 });
  });
});

describe('resolved wave completion', () => {
  it('clears only after all spawned resolutions complete', () => {
    expect(checkLevelClearCondition('playing', false, 5, 5, 0, 5, false)).toBe(true);
    expect(checkLevelClearCondition('playing', false, 4, 5, 0, 5, false)).toBe(false);
    expect(checkLevelClearCondition('playing', false, 5, 5, 1, 5, false)).toBe(false);
  });

  it('allows a resolved guardian round to finish', () => {
    expect(checkLevelClearCondition('playing', false, 1, 1, 0, 1, true)).toBe(true);
  });
});

describe('round rewards', () => {
  it('credits gold only and never reports XP', () => {
    const reward = calculateRoundReward(false, 5, 0, 'day_spring');
    expect(reward.gold).toBe(60);
    expect(reward).not.toHaveProperty('xp');
  });

  it('builds the countdown sequence', () => {
    expect(buildCountdownSequence('Level 3')).toEqual(['Level 3', '3', '2', '1', 'Go!']);
  });
});
