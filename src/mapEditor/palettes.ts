import type { AuthoredMarkerRole, AuthoredObjectRole, AuthoredTerrainRole } from '../levels/levelTypes';

export interface EditorPaletteOption<T extends string> {
  value: T;
  label: string;
}

export const TERRAIN_OPTIONS: Array<EditorPaletteOption<AuthoredTerrainRole>> = [
  { value: 'grass', label: 'Grass' },
  { value: 'flower_grass', label: 'Flower Grass' },
  { value: 'stone_road', label: 'Stone Road' },
  { value: 'plaza', label: 'Plaza' },
  { value: 'forest_floor', label: 'Forest Floor' },
  { value: 'gate_road', label: 'Gate Road' },
];

export const OBJECT_OPTIONS: Array<EditorPaletteOption<AuthoredObjectRole>> = [
  { value: 'castle', label: 'Castle' },
  { value: 'cottage', label: 'Cottage' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'market', label: 'Market' },
  { value: 'well', label: 'Well' },
  { value: 'gate_n', label: 'North Gate' },
  { value: 'gate_e', label: 'East Gate' },
  { value: 'gate_s', label: 'South Gate' },
  { value: 'gate_w', label: 'West Gate' },
  { value: 'tree_broadleaf', label: 'Broadleaf' },
  { value: 'tree_conifer', label: 'Conifer' },
  { value: 'rock_large', label: 'Rock' },
  { value: 'pond', label: 'Pond' },
  { value: 'bush', label: 'Bush' },
  { value: 'flowers', label: 'Flowers' },
  { value: 'grass_tuft', label: 'Grass Tuft' },
  { value: 'magic_patch', label: 'Magic Patch' },
  { value: 'lamp', label: 'Lamp' },
  { value: 'fence', label: 'Fence' },
  { value: 'sign', label: 'Sign' },
];

export const MARKER_OPTIONS: Array<EditorPaletteOption<AuthoredMarkerRole>> = [
  { value: 'player_spawn', label: 'Player Spawn' },
  { value: 'enemy_threshold_n', label: 'North Threshold' },
  { value: 'enemy_threshold_e', label: 'East Threshold' },
  { value: 'enemy_threshold_s', label: 'South Threshold' },
  { value: 'enemy_threshold_w', label: 'West Threshold' },
];

export const UNIQUE_BUILDING_OBJECT_ROLES = new Set<AuthoredObjectRole>([
  'castle',
  'cottage',
  'bakery',
  'market',
  'well',
]);

export const UNIQUE_GATE_OBJECT_ROLES = new Set<AuthoredObjectRole>([
  'gate_n',
  'gate_e',
  'gate_s',
  'gate_w',
]);

export const UNIQUE_OBJECT_ROLES = new Set<AuthoredObjectRole>([
  ...UNIQUE_BUILDING_OBJECT_ROLES,
  ...UNIQUE_GATE_OBJECT_ROLES,
]);

export const getObjectLabel = (role: AuthoredObjectRole) => (
  OBJECT_OPTIONS.find((option) => option.value === role)?.label ?? role
);
