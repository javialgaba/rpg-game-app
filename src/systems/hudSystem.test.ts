import { describe, expect, it } from 'vitest';
import { appendGuildNote, getSkillStatus, isCompactUiViewport, truncateGuildNote } from './hudSystem';

describe('HUD helpers', () => {
  it('detects compact UI from touch state or viewport width', () => {
    expect(isCompactUiViewport(false, 901)).toBe(false);
    expect(isCompactUiViewport(false, 899)).toBe(true);
    expect(isCompactUiViewport(true, 1200)).toBe(true);
  });

  it('truncates guild notes without trailing whitespace', () => {
    expect(truncateGuildNote('Short note', 20)).toBe('Short note');
    expect(truncateGuildNote('Repair the eastern market soon', 18)).toBe('Repair the east...');
  });

  it('formats skill readiness from cooldown state', () => {
    expect(getSkillStatus(1000, 0, 500)).toBe('Ready');
    expect(getSkillStatus(1000, 500, 1800)).toBe('2s');
  });

  it('deduplicates adjacent notes and caps the list', () => {
    expect(appendGuildNote(['A'], 'A')).toEqual(['A']);
    expect(appendGuildNote(['A', 'B', 'C'], 'D', 3)).toEqual(['B', 'C', 'D']);
  });
});
