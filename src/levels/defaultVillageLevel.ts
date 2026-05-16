import type { LevelConfig } from './levelTypes';

export const DEFAULT_VILLAGE_LEVEL: LevelConfig = {
  seed: 'village-001',
  timeOfDay: 'morning',
  tileSize: 64,
  decorationDensity: 0.35,
  difficulty: 1,
  matrix: [
    ['T', 'T', 'T', 'SP', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'SP', 'T', 'T', 'T'],
    ['T', 'G', 'G', 'P', 'P', 'P', 'G', 'G', 'G', 'P', 'P', 'P', 'G', 'G', 'T'],
    ['T', 'G', 'D', 'P', 'G', 'G', 'G', 'C', 'G', 'G', 'G', 'P', 'D', 'G', 'T'],
    ['SP', 'P', 'P', 'P', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'P', 'P', 'P', 'SP'],
    ['T', 'G', 'G', 'G', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'G', 'G', 'G', 'T'],
    ['T', 'G', 'H1', 'G', 'P', 'G', 'G', 'G', 'G', 'G', 'P', 'G', 'H2', 'G', 'T'],
    ['T', 'G', 'D', 'P', 'P', 'P', 'P', 'PS', 'P', 'P', 'P', 'P', 'D', 'G', 'T'],
    ['T', 'P', 'P', 'P', 'P', 'V', 'V', 'V', 'V', 'V', 'P', 'P', 'P', 'P', 'T'],
    ['T', 'G', 'D', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'D', 'G', 'T'],
    ['T', 'G', 'G', 'G', 'P', 'G', 'G', 'G', 'G', 'G', 'P', 'G', 'G', 'G', 'T'],
    ['T', 'G', 'M', 'G', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'G', 'W', 'G', 'T'],
    ['SP', 'P', 'P', 'P', 'G', 'G', 'G', 'CH', 'G', 'G', 'G', 'P', 'P', 'P', 'SP'],
    ['T', 'G', 'CH', 'P', 'D', 'G', 'G', 'L', 'G', 'G', 'D', 'P', 'CH', 'G', 'T'],
    ['T', 'G', 'G', 'P', 'P', 'P', 'G', 'G', 'G', 'P', 'P', 'P', 'G', 'G', 'T'],
    ['T', 'T', 'T', 'SP', 'T', 'T', 'T', 'T', 'T', 'T', 'T', 'SP', 'T', 'T', 'T'],
  ],
};
