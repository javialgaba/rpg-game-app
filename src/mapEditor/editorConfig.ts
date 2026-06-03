import type {
  AuthoredMarkerRole,
  AuthoredObjectRole,
} from '../levels/levelTypes';

export const DEFAULT_CSV_KEY = 'mapEditorDefaultCsv';
export const EDITOR_LEVEL_ID = 'map-editor-draft';
export const EDITOR_TILE_SIZE = 60;
export const CAMERA_MIN_ZOOM = 0.45;
export const CAMERA_MAX_ZOOM = 1.45;
export const CAMERA_WHEEL_STEP = 0.0012;
export const BOARD_PADDING = 360;
export const MARKER_COLOR = 0x22324a;
export const MARKER_FILL_ALPHA = 0.84;
export const HOVER_COLOR = 0xffffff;
export const DRAG_HOVER_COLOR = 0x66fff0;
export const SELECTED_FOOTPRINT_COLOR = 0xffd166;
export const VALID_DROP_FOOTPRINT_COLOR = 0x66fff0;
export const INVALID_DROP_FOOTPRINT_COLOR = 0xff6b6b;

export const MARKER_LABELS: Record<AuthoredMarkerRole, string> = {
  player_spawn: 'P',
  enemy_threshold_n: 'N',
  enemy_threshold_e: 'E',
  enemy_threshold_s: 'S',
  enemy_threshold_w: 'W',
};

export const BUILDING_ROLE_BY_OBJECT: Partial<Record<AuthoredObjectRole, 'castle' | 'house-1' | 'house-2' | 'market' | 'well'>> = {
  castle: 'castle',
  cottage: 'house-1',
  bakery: 'house-2',
  market: 'market',
  well: 'well',
};

export const PROP_FRAME_SUFFIX: Partial<Record<AuthoredObjectRole, string>> = {
  tree_broadleaf: 'broadleaf_01',
  tree_conifer: 'conifer_01',
  rock_large: 'rocks_large_01',
  pond: 'pond_01',
  bush: 'bush_01',
  flowers: 'flowers_01',
  grass_tuft: 'grass_tuft_01',
  magic_patch: 'magic_patch_01',
  lamp: 'lamp_01',
  fence: 'fence_01',
  sign: 'sign_01',
};

export const GATE_SUFFIX: Partial<Record<AuthoredObjectRole, string>> = {
  gate_n: 'gate_n_01',
  gate_e: 'gate_e_01',
  gate_s: 'gate_s_01',
  gate_w: 'gate_w_01',
};

export const OBJECT_RENDERING: Partial<Record<AuthoredObjectRole, {
  size: [number, number];
  origin: [number, number];
  z: number;
  atlas: 'sceneVariantPropsAtlas' | 'sceneVariantBuildingsAtlas';
}>> = {
  castle: { size: [310, 260], origin: [0.5, 1], z: 18, atlas: 'sceneVariantBuildingsAtlas' },
  cottage: { size: [230, 190], origin: [0.5, 1], z: 18, atlas: 'sceneVariantBuildingsAtlas' },
  bakery: { size: [230, 190], origin: [0.5, 1], z: 18, atlas: 'sceneVariantBuildingsAtlas' },
  market: { size: [238, 184], origin: [0.5, 1], z: 18, atlas: 'sceneVariantBuildingsAtlas' },
  well: { size: [164, 142], origin: [0.5, 1], z: 8, atlas: 'sceneVariantBuildingsAtlas' },
  gate_n: { size: [166, 144], origin: [0.5, 0.86], z: 9, atlas: 'sceneVariantPropsAtlas' },
  gate_e: { size: [166, 144], origin: [0.5, 0.86], z: 9, atlas: 'sceneVariantPropsAtlas' },
  gate_s: { size: [166, 144], origin: [0.5, 0.86], z: 9, atlas: 'sceneVariantPropsAtlas' },
  gate_w: { size: [166, 144], origin: [0.5, 0.86], z: 9, atlas: 'sceneVariantPropsAtlas' },
  tree_broadleaf: { size: [204, 175], origin: [0.5, 0.84], z: 12, atlas: 'sceneVariantPropsAtlas' },
  tree_conifer: { size: [204, 175], origin: [0.5, 0.84], z: 12, atlas: 'sceneVariantPropsAtlas' },
  rock_large: { size: [142, 124], origin: [0.5, 0.84], z: 8, atlas: 'sceneVariantPropsAtlas' },
  pond: { size: [138, 110], origin: [0.5, 0.72], z: 3, atlas: 'sceneVariantPropsAtlas' },
  bush: { size: [162, 128], origin: [0.5, 0.84], z: 9, atlas: 'sceneVariantPropsAtlas' },
  flowers: { size: [150, 118], origin: [0.5, 0.84], z: 7, atlas: 'sceneVariantPropsAtlas' },
  grass_tuft: { size: [148, 114], origin: [0.5, 0.84], z: 7, atlas: 'sceneVariantPropsAtlas' },
  magic_patch: { size: [119, 115], origin: [0.5, 0.86], z: 8, atlas: 'sceneVariantPropsAtlas' },
  lamp: { size: [108, 158], origin: [0.5, 0.86], z: 9, atlas: 'sceneVariantPropsAtlas' },
  fence: { size: [150, 116], origin: [0.5, 0.84], z: 8, atlas: 'sceneVariantPropsAtlas' },
  sign: { size: [136, 156], origin: [0.5, 0.86], z: 9, atlas: 'sceneVariantPropsAtlas' },
};
