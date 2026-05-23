import type { LevelConfig } from './levelTypes';
import { DEFAULT_PLAYABLE_BOUNDS } from '../sceneVariants';

export const DEFAULT_VILLAGE_LEVEL: LevelConfig = {
  seed: 'village-001',
  timeOfDay: 'morning',
  tileSize: 44,
  decorationDensity: 0.48,
  difficulty: 1,
  playableBounds: DEFAULT_PLAYABLE_BOUNDS,
  matrix: [
    ['tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree'],
    ['tree', 'tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree', 'tree'],
    ['tree', 'grass', 'decoration', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'decoration', 'grass', 'tree'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree'],
    ['monster-spawn', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'monster-spawn'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree'],
    ['tree', 'grass', 'decoration', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'decoration', 'grass', 'tree'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'house-1', 'grass', 'player-spawn', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'village-center', 'castle', 'village-center', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree'],
    ['tree', 'grass', 'decoration', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'village-center', 'village-center', 'grass', 'grass', 'grass', 'grass', 'grass', 'decoration', 'grass', 'tree'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'house-2', 'grass', 'grass', 'grass', 'grass', 'tree'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree'],
    ['tree', 'grass', 'decoration', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'market', 'grass', 'grass', 'grass', 'grass', 'grass', 'decoration', 'grass', 'tree'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'decoration', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'decoration', 'grass', 'grass', 'grass', 'tree'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'well', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree'],
    ['tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree'],
    ['tree', 'tree', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree', 'tree'],
    ['tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree'],
  ],
};
