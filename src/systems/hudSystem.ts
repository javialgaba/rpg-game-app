export function isCompactUiViewport(touchControlsEnabled: boolean, viewportWidth: number): boolean {
  return touchControlsEnabled || viewportWidth < 900;
}

export function truncateGuildNote(note: string, maxLength: number): string {
  if (note.length <= maxLength) {
    return note;
  }
  return `${note.slice(0, maxLength - 3).trimEnd()}...`;
}

export function getSkillStatus(now: number, lastSkill: number, cooldown: number): string {
  const remaining = Math.max(0, lastSkill + cooldown - now);
  return remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : 'Ready';
}

export function appendGuildNote(notes: string[], message: string, maxNotes = 8): string[] {
  if (notes[notes.length - 1] === message) {
    return notes;
  }
  return [...notes, message].slice(-maxNotes);
}
