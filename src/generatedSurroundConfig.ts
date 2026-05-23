import type { GeneratedSurroundPiece, GeneratedSurroundDepth, GeneratedSurroundTransform } from './gameTypes';

export const GENERATED_SURROUND_DEPTH_WATER = 2;
export const GENERATED_SURROUND_DEPTH_SHADOW = 3;
export const GENERATED_SURROUND_DEPTH_BACKGROUND = 4;
export const GENERATED_SURROUND_DEPTH_FOREGROUND = 5;
export const GENERATED_SURROUND_DEPTH_MIST_NEAR = 16;
export const GENERATED_SURROUND_DEPTH_MIST_FAR = 17;
export const GENERATED_SURROUND_DEPTH_GROUND_MIST = 21;
export const GENERATED_SURROUND_DEPTH_GROUND_FOG = 22;

export const GENERATED_SURROUND_ORIGIN_SHADOW = 0.5;
export const GENERATED_SURROUND_ORIGIN_WATER = 0.58;
export const GENERATED_SURROUND_ORIGIN_FOREST = 0.64;
export const GENERATED_SURROUND_ORIGIN_CLIFF = 0.66;
export const GENERATED_SURROUND_ORIGIN_CLUSTER = 0.74;
export const GENERATED_SURROUND_ORIGIN_FRAME = 0.62;
export const GENERATED_SURROUND_ORIGIN_MIST_FILL = 0.6;
export const GENERATED_SURROUND_ORIGIN_MIST_PATCH = 0.56;
export const GENERATED_SURROUND_ORIGIN_DECOR_CLUSTER = 0.72;
export const GENERATED_SURROUND_ORIGIN_FOG_PATCH = 0.52;
export const GENERATED_SURROUND_ORIGIN_PINE = 0.84;

export const GENERATED_SURROUND_ALPHA = {
  opaque: 1,
  water: {
    soft: 0.92,
    highlight: 0.98,
    recessed: 0.88,
  },
  foliage: {
    highlight: 0.98,
    strong: 0.96,
    primary: 0.94,
    secondary: 0.92,
    tertiary: 0.9,
    distant: 0.88,
  },
  frame: {
    accent: 0.98,
  },
  shadow: {
    large: 0.32,
  },
  mist: {
    near: 0.62,
    side: 0.58,
    far: 0.38,
    ground: 0.36,
    soft: 0.32,
  },
  fog: {
    strong: 0.44,
    medium: 0.42,
    soft: 0.32,
    faint: 0.3,
    ground: 0.28,
  },
  purpleMist: {
    accent: 0.18,
  },
  silhouette: {
    leftPine: 0.22,
    rightPine: 0.2,
  },
} as const;

export const GENERATED_SURROUND_TOP_EDGE_DEPTH: GeneratedSurroundDepth = { edge: 'top', tileOffset: 0.18 };
export const GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_NEAR: GeneratedSurroundDepth = { edge: 'bottom', tileOffset: 0.62 };
export const GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_EDGE: GeneratedSurroundDepth = { edge: 'bottom', tileOffset: 0.98 };
export const GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_FILLER: GeneratedSurroundDepth = { edge: 'bottom', tileOffset: 1.02 };
export const GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_CLUSTER: GeneratedSurroundDepth = { edge: 'bottom', tileOffset: 1.04 };

export const GENERATED_SURROUND_LAYOUT = {
  shadow: {
    bottomCenterBase: { offsetXUnits: 0, offsetYUnits: 0.82, uniformScale: 2.72 },
  },
  water: {
    topLeftWide: { offsetXUnits: -1.86, offsetYUnits: 2.04, uniformScale: 2.04 },
    topLeftInset: { offsetXUnits: 1.36, offsetYUnits: 1.42, uniformScale: 1.36 },
    topRightHighlight: { offsetXUnits: 1.86, offsetYUnits: 1.98, uniformScale: 1.8 },
    topRightRecess: { offsetXUnits: -1.28, offsetYUnits: 1.26, uniformScale: 1.28 },
  },
  forest: {
    topLeftOuter: { offsetXUnits: -3.3, offsetYUnits: 0.96, uniformScale: 1.28 },
    topRightOuter: { offsetXUnits: 3.4, offsetYUnits: 0.18, uniformScale: 1.08 },
    topLeftMid: { offsetXUnits: 2.28, offsetYUnits: 1.78, uniformScale: 0.9 },
    topRightMid: { offsetXUnits: -1.92, offsetYUnits: 1.84, uniformScale: 0.84 },
    topLeftRearRight: { offsetXUnits: 3.24, offsetYUnits: 2.46, uniformScale: 0.78 },
    topLeftRearCenter: { offsetXUnits: 0.82, offsetYUnits: 3.22, uniformScale: 0.74 },
    topLeftRearInner: { offsetXUnits: 1.9, offsetYUnits: 3.56, uniformScale: 0.84 },
    topRightRearLeft: { offsetXUnits: -3.16, offsetYUnits: 2.44, uniformScale: 0.76 },
    topRightRearCenter: { offsetXUnits: -0.92, offsetYUnits: 3.18, uniformScale: 0.74 },
    topRightRearInner: { offsetXUnits: -1.98, offsetYUnits: 3.52, uniformScale: 0.82 },
    rightUpperBackdrop: { offsetXUnits: 1.66, offsetYUnits: -1.16, uniformScale: 0.92 },
    leftLowerBackdrop: { offsetXUnits: -1.28, offsetYUnits: 1.46, uniformScale: 0.88 },
    bottomCenterFill: { offsetXUnits: 0, offsetYUnits: 0.86, uniformScale: 0.9 },
  },
  cliff: {
    topLeftOuter: { offsetXUnits: -3.6, offsetYUnits: 2.44, uniformScale: 0.92 },
    topRightOuter: { offsetXUnits: 3.32, offsetYUnits: 2.38, uniformScale: 0.9 },
    topLeftInner: { offsetXUnits: 2.84, offsetYUnits: 2.84, uniformScale: 0.88 },
    topRightInner: { offsetXUnits: -2.74, offsetYUnits: 2.88, uniformScale: 0.86 },
    topLeftEdge: { offsetXUnits: 4.6, offsetYUnits: 0.38, uniformScale: 0.9 },
    topRightEdge: { offsetXUnits: -4.6, offsetYUnits: 0.52, uniformScale: 0.96 },
    bottomCenterFill: { offsetXUnits: -2.18, offsetYUnits: 0.76, uniformScale: 0.76 },
  },
  cluster: {
    topLeftNear: { offsetXUnits: -0.38, offsetYUnits: 2.76, uniformScale: 1.36 },
    topLeftMid: { offsetXUnits: 1.54, offsetYUnits: 3.08, uniformScale: 1.22 },
    topLeftOuter: { offsetXUnits: -2.28, offsetYUnits: 3.12, uniformScale: 1.46 },
    topRightNear: { offsetXUnits: 0.42, offsetYUnits: 2.92, uniformScale: 1.3 },
    topRightMid: { offsetXUnits: -1.44, offsetYUnits: 3.04, uniformScale: 1.18 },
    topRightOuter: { offsetXUnits: 2.22, offsetYUnits: 3.14, uniformScale: 1.38 },
    bottomCenterAccent: { offsetXUnits: 2.08, offsetYUnits: 0.78, uniformScale: 1.08 },
    bottomLeftBackdrop: { offsetXUnits: -2.12, offsetYUnits: 0.96, uniformScale: 1.02 },
    bottomRightBackdrop: { offsetXUnits: 2.12, offsetYUnits: 0.96, uniformScale: 1.02 },
  },
  frame: {
    topLeftCap: { offsetXUnits: -0.82, offsetYUnits: 1.12, uniformScale: 1.24 },
    topCenterLeftAccent: { offsetXUnits: -1.6, offsetYUnits: 0.74, uniformScale: 1.2 },
    topCenterRightAccent: { offsetXUnits: 1.6, offsetYUnits: 0.74, uniformScale: 1.2 },
    topCenterMain: { offsetXUnits: 0, offsetYUnits: 0.94, uniformScale: 1.3 },
    topRightCap: { offsetXUnits: 0.92, offsetYUnits: 1.06, uniformScale: 1.24 },
    leftUpper: { offsetXUnits: -0.26, offsetYUnits: 1.52, uniformScale: 1.26 },
    rightUpper: { offsetXUnits: 0.3, offsetYUnits: 1.66, uniformScale: 1.28 },
    leftLower: { offsetXUnits: -0.22, offsetYUnits: 0.1, uniformScale: 1.1 },
    rightLower: { offsetXUnits: 0.22, offsetYUnits: 0.1, uniformScale: 1.1 },
    bottomLeft: { offsetXUnits: -0.46, offsetYUnits: 0.54, uniformScale: 0.84 },
    bottomRight: { offsetXUnits: 0.46, offsetYUnits: 0.54, uniformScale: 0.84 },
  },
  mist: {
    topLeftNear: { offsetXUnits: 0.72, offsetYUnits: 1.18, uniformScale: 1.02 },
    topLeftFar: { offsetXUnits: -1.42, offsetYUnits: 2.72, uniformScale: 1.2 },
    topRightNear: { offsetXUnits: -0.52, offsetYUnits: 1.16, uniformScale: 1 },
    topRightGround: { offsetXUnits: 1.38, offsetYUnits: 2.78, uniformScale: 1.14 },
    bottomLeftSoft: { offsetXUnits: 0.44, offsetYUnits: 0.82, uniformScale: 1.02 },
    bottomCenterGround: { offsetXUnits: 0, offsetYUnits: 0.9, uniformScale: 1.16 },
    bottomRightSoft: { offsetXUnits: -0.44, offsetYUnits: 0.82, uniformScale: 1.02 },
  },
  fog: {
    topLeftStrong: { offsetXUnits: 1.46, offsetYUnits: 2.92, uniformScale: 1.54 },
    topLeftSoft: { offsetXUnits: 3.16, offsetYUnits: 2.66, uniformScale: 1.06 },
    topRightMedium: { offsetXUnits: -1.54, offsetYUnits: 2.88, uniformScale: 1.42 },
    topRightFaint: { offsetXUnits: -3.06, offsetYUnits: 2.6, uniformScale: 1.02 },
    bottomLeftGround: { offsetXUnits: 1.72, offsetYUnits: 1.02, uniformScale: 1.26 },
    bottomRightGround: { offsetXUnits: -1.72, offsetYUnits: 1.02, uniformScale: 1.26 },
  },
  purpleMist: {
    topLeftAccent: { offsetXUnits: -0.12, offsetYUnits: 3.26, uniformScale: 1.18 },
    topRightAccent: { offsetXUnits: 0.12, offsetYUnits: 3.22, uniformScale: 1.14 },
  },
  silhouette: {
    topLeftPine: { offsetXUnits: -2.42, offsetYUnits: 3.7, uniformScale: 1.24 },
    topRightPine: { offsetXUnits: 2.46, offsetYUnits: 3.62, uniformScale: 1.2 },
  },
} as const satisfies Record<string, Record<string, GeneratedSurroundTransform>>;

export const GENERATED_SURROUND_PIECES: ReadonlyArray<GeneratedSurroundPiece> = [
  { frame: 'large_shadow', anchor: 'bottomCenter', ...GENERATED_SURROUND_LAYOUT.shadow.bottomCenterBase, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_SHADOW, alpha: GENERATED_SURROUND_ALPHA.shadow.large, originY: GENERATED_SURROUND_ORIGIN_SHADOW },
  { frame: 'surround_water_fill_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.water.topLeftWide, layer: 'background', depth: GENERATED_SURROUND_DEPTH_WATER, alpha: GENERATED_SURROUND_ALPHA.opaque, originY: GENERATED_SURROUND_ORIGIN_WATER },
  { frame: 'surround_water_fill_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.water.topLeftInset, layer: 'background', depth: GENERATED_SURROUND_DEPTH_WATER, alpha: GENERATED_SURROUND_ALPHA.water.soft, originY: GENERATED_SURROUND_ORIGIN_WATER },
  { frame: 'surround_water_fill_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.water.topRightHighlight, layer: 'background', depth: GENERATED_SURROUND_DEPTH_WATER, alpha: GENERATED_SURROUND_ALPHA.water.highlight, originY: GENERATED_SURROUND_ORIGIN_WATER },
  { frame: 'surround_water_fill_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.water.topRightRecess, layer: 'background', depth: GENERATED_SURROUND_DEPTH_WATER, alpha: GENERATED_SURROUND_ALPHA.water.recessed, originY: GENERATED_SURROUND_ORIGIN_WATER },
  { frame: 'surround_forest_mass_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.forest.topLeftOuter, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.highlight, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'surround_forest_mass_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.forest.topRightOuter, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.strong, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'surround_forest_mass_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.forest.topLeftMid, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.primary, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'surround_cliff_filler_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.cliff.topLeftOuter, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.highlight, originY: GENERATED_SURROUND_ORIGIN_CLIFF },
  { frame: 'surround_forest_mass_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.forest.topRightMid, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.secondary, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'surround_cliff_filler_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.cliff.topRightOuter, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.highlight, originY: GENERATED_SURROUND_ORIGIN_CLIFF },
  { frame: 'forest_cluster_back', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.cluster.topLeftNear, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.primary, originY: GENERATED_SURROUND_ORIGIN_CLUSTER },
  { frame: 'forest_cluster_back', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.cluster.topLeftMid, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.secondary, originY: GENERATED_SURROUND_ORIGIN_CLUSTER },
  { frame: 'forest_cluster_back', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.cluster.topLeftOuter, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.tertiary, originY: GENERATED_SURROUND_ORIGIN_CLUSTER },
  { frame: 'surround_cliff_filler_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.cliff.topLeftInner, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.highlight, originY: GENERATED_SURROUND_ORIGIN_CLIFF },
  { frame: 'surround_forest_mass_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.forest.topLeftRearRight, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.primary, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'surround_forest_mass_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.forest.topLeftRearCenter, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.tertiary, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'surround_forest_mass_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.forest.topLeftRearInner, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.distant, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'forest_cluster_back', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.cluster.topRightNear, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.primary, originY: GENERATED_SURROUND_ORIGIN_CLUSTER },
  { frame: 'forest_cluster_back', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.cluster.topRightMid, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.secondary, originY: GENERATED_SURROUND_ORIGIN_CLUSTER },
  { frame: 'forest_cluster_back', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.cluster.topRightOuter, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.tertiary, originY: GENERATED_SURROUND_ORIGIN_CLUSTER },
  { frame: 'surround_cliff_filler_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.cliff.topRightInner, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.highlight, originY: GENERATED_SURROUND_ORIGIN_CLIFF },
  { frame: 'surround_forest_mass_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.forest.topRightRearLeft, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.primary, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'surround_forest_mass_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.forest.topRightRearCenter, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.tertiary, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'surround_forest_mass_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.forest.topRightRearInner, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.distant, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'surround_top_left_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.frame.topLeftCap, layer: 'background', depth: GENERATED_SURROUND_DEPTH_FOREGROUND, alpha: GENERATED_SURROUND_ALPHA.opaque, originY: GENERATED_SURROUND_ORIGIN_FRAME },
  { frame: 'surround_top_center_01', anchor: 'topCenter', ...GENERATED_SURROUND_LAYOUT.frame.topCenterLeftAccent, layer: 'background', depth: GENERATED_SURROUND_DEPTH_FOREGROUND, alpha: GENERATED_SURROUND_ALPHA.frame.accent, originY: GENERATED_SURROUND_ORIGIN_FRAME },
  { frame: 'surround_top_center_01', anchor: 'topCenter', ...GENERATED_SURROUND_LAYOUT.frame.topCenterRightAccent, layer: 'background', depth: GENERATED_SURROUND_DEPTH_FOREGROUND, alpha: GENERATED_SURROUND_ALPHA.frame.accent, originY: GENERATED_SURROUND_ORIGIN_FRAME },
  { frame: 'surround_top_center_01', anchor: 'topCenter', ...GENERATED_SURROUND_LAYOUT.frame.topCenterMain, layer: 'background', depth: GENERATED_SURROUND_DEPTH_FOREGROUND, alpha: GENERATED_SURROUND_ALPHA.opaque, originY: GENERATED_SURROUND_ORIGIN_FRAME },
  { frame: 'surround_top_right_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.frame.topRightCap, layer: 'background', depth: GENERATED_SURROUND_DEPTH_FOREGROUND, alpha: GENERATED_SURROUND_ALPHA.opaque, originY: GENERATED_SURROUND_ORIGIN_FRAME },
  { frame: 'surround_left_upper_01', anchor: 'leftUpper', ...GENERATED_SURROUND_LAYOUT.frame.leftUpper, layer: 'background', depth: GENERATED_SURROUND_DEPTH_FOREGROUND, alpha: GENERATED_SURROUND_ALPHA.opaque, originY: GENERATED_SURROUND_ORIGIN_FRAME },
  { frame: 'surround_right_upper_01', anchor: 'rightUpper', ...GENERATED_SURROUND_LAYOUT.frame.rightUpper, layer: 'background', depth: GENERATED_SURROUND_DEPTH_FOREGROUND, alpha: GENERATED_SURROUND_ALPHA.opaque, originY: GENERATED_SURROUND_ORIGIN_FRAME },
  { frame: 'surround_cliff_filler_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.cliff.topLeftEdge, layer: 'edge', depth: GENERATED_SURROUND_TOP_EDGE_DEPTH, alpha: GENERATED_SURROUND_ALPHA.opaque },
  { frame: 'surround_cliff_filler_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.cliff.topRightEdge, layer: 'edge', depth: GENERATED_SURROUND_TOP_EDGE_DEPTH, alpha: GENERATED_SURROUND_ALPHA.opaque },
  { frame: 'surround_mist_fill_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.mist.topLeftNear, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_NEAR, alpha: GENERATED_SURROUND_ALPHA.mist.near, originY: GENERATED_SURROUND_ORIGIN_MIST_FILL },
  { frame: 'surround_mist_fill_01', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.mist.topLeftFar, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_FAR, alpha: GENERATED_SURROUND_ALPHA.mist.far, originY: GENERATED_SURROUND_ORIGIN_WATER },
  { frame: 'fog_patch', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.fog.topLeftStrong, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_FAR, alpha: GENERATED_SURROUND_ALPHA.fog.strong, originY: GENERATED_SURROUND_ORIGIN_MIST_PATCH },
  { frame: 'fog_patch', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.fog.topLeftSoft, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_FAR, alpha: GENERATED_SURROUND_ALPHA.fog.soft, originY: GENERATED_SURROUND_ORIGIN_MIST_PATCH },
  { frame: 'purple_mist_patch', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.purpleMist.topLeftAccent, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_FAR, alpha: GENERATED_SURROUND_ALPHA.purpleMist.accent, originY: GENERATED_SURROUND_ORIGIN_MIST_PATCH },
  { frame: 'surround_mist_fill_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.mist.topRightNear, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_NEAR, alpha: GENERATED_SURROUND_ALPHA.mist.side, originY: GENERATED_SURROUND_ORIGIN_MIST_FILL },
  { frame: 'surround_mist_fill_01', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.mist.topRightGround, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_FAR, alpha: GENERATED_SURROUND_ALPHA.mist.ground, originY: GENERATED_SURROUND_ORIGIN_WATER },
  { frame: 'fog_patch', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.fog.topRightMedium, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_FAR, alpha: GENERATED_SURROUND_ALPHA.fog.medium, originY: GENERATED_SURROUND_ORIGIN_MIST_PATCH },
  { frame: 'fog_patch', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.fog.topRightFaint, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_FAR, alpha: GENERATED_SURROUND_ALPHA.fog.faint, originY: GENERATED_SURROUND_ORIGIN_MIST_PATCH },
  { frame: 'purple_mist_patch', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.purpleMist.topRightAccent, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_MIST_FAR, alpha: GENERATED_SURROUND_ALPHA.purpleMist.accent, originY: GENERATED_SURROUND_ORIGIN_MIST_PATCH },
  { frame: 'surround_left_lower_01', anchor: 'leftLower', ...GENERATED_SURROUND_LAYOUT.frame.leftLower, layer: 'decor', depth: GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_NEAR, alpha: GENERATED_SURROUND_ALPHA.opaque },
  { frame: 'surround_right_lower_01', anchor: 'rightLower', ...GENERATED_SURROUND_LAYOUT.frame.rightLower, layer: 'decor', depth: GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_NEAR, alpha: GENERATED_SURROUND_ALPHA.opaque },
  { frame: 'surround_bottom_left_01', anchor: 'bottomLeft', ...GENERATED_SURROUND_LAYOUT.frame.bottomLeft, layer: 'decor', depth: GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_EDGE, alpha: GENERATED_SURROUND_ALPHA.opaque },
  { frame: 'surround_cliff_filler_01', anchor: 'bottomCenter', ...GENERATED_SURROUND_LAYOUT.cliff.bottomCenterFill, layer: 'decor', depth: GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_FILLER, alpha: GENERATED_SURROUND_ALPHA.opaque },
  { frame: 'surround_forest_mass_01', anchor: 'bottomCenter', ...GENERATED_SURROUND_LAYOUT.forest.bottomCenterFill, layer: 'decor', depth: GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_FILLER, alpha: GENERATED_SURROUND_ALPHA.foliage.highlight, originY: GENERATED_SURROUND_ORIGIN_FOREST },
  { frame: 'forest_cluster_back', anchor: 'bottomCenter', ...GENERATED_SURROUND_LAYOUT.cluster.bottomCenterAccent, layer: 'decor', depth: GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_CLUSTER, alpha: GENERATED_SURROUND_ALPHA.foliage.strong, originY: GENERATED_SURROUND_ORIGIN_DECOR_CLUSTER },
  { frame: 'surround_bottom_right_01', anchor: 'bottomRight', ...GENERATED_SURROUND_LAYOUT.frame.bottomRight, layer: 'decor', depth: GENERATED_SURROUND_BOTTOM_DECOR_DEPTH_EDGE, alpha: GENERATED_SURROUND_ALPHA.opaque },
  { frame: 'surround_mist_fill_01', anchor: 'bottomLeft', ...GENERATED_SURROUND_LAYOUT.mist.bottomLeftSoft, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_GROUND_MIST, alpha: GENERATED_SURROUND_ALPHA.mist.soft, originY: GENERATED_SURROUND_ORIGIN_MIST_PATCH },
  { frame: 'surround_mist_fill_01', anchor: 'bottomCenter', ...GENERATED_SURROUND_LAYOUT.mist.bottomCenterGround, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_GROUND_FOG, alpha: GENERATED_SURROUND_ALPHA.mist.ground, originY: GENERATED_SURROUND_ORIGIN_MIST_PATCH },
  { frame: 'surround_mist_fill_01', anchor: 'bottomRight', ...GENERATED_SURROUND_LAYOUT.mist.bottomRightSoft, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_GROUND_MIST, alpha: GENERATED_SURROUND_ALPHA.mist.soft, originY: GENERATED_SURROUND_ORIGIN_MIST_PATCH },
  { frame: 'fog_patch', anchor: 'bottomLeft', ...GENERATED_SURROUND_LAYOUT.fog.bottomLeftGround, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_GROUND_FOG, alpha: GENERATED_SURROUND_ALPHA.fog.ground, originY: GENERATED_SURROUND_ORIGIN_FOG_PATCH },
  { frame: 'fog_patch', anchor: 'bottomRight', ...GENERATED_SURROUND_LAYOUT.fog.bottomRightGround, layer: 'shadow', depth: GENERATED_SURROUND_DEPTH_GROUND_FOG, alpha: GENERATED_SURROUND_ALPHA.fog.ground, originY: GENERATED_SURROUND_ORIGIN_FOG_PATCH },
  { frame: 'surround_forest_mass_01', anchor: 'rightUpper', ...GENERATED_SURROUND_LAYOUT.forest.rightUpperBackdrop, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.primary },
  { frame: 'surround_forest_mass_01', anchor: 'leftLower', ...GENERATED_SURROUND_LAYOUT.forest.leftLowerBackdrop, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.primary },
  { frame: 'forest_cluster_back', anchor: 'bottomLeft', ...GENERATED_SURROUND_LAYOUT.cluster.bottomLeftBackdrop, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.secondary, originY: GENERATED_SURROUND_ORIGIN_DECOR_CLUSTER },
  { frame: 'forest_cluster_back', anchor: 'bottomRight', ...GENERATED_SURROUND_LAYOUT.cluster.bottomRightBackdrop, layer: 'background', depth: GENERATED_SURROUND_DEPTH_BACKGROUND, alpha: GENERATED_SURROUND_ALPHA.foliage.secondary, originY: GENERATED_SURROUND_ORIGIN_DECOR_CLUSTER },
  { frame: 'pine_silhouette_tall', anchor: 'topLeft', ...GENERATED_SURROUND_LAYOUT.silhouette.topLeftPine, layer: 'background', depth: GENERATED_SURROUND_DEPTH_SHADOW, alpha: GENERATED_SURROUND_ALPHA.silhouette.leftPine, originY: GENERATED_SURROUND_ORIGIN_PINE },
  { frame: 'pine_silhouette_tall', anchor: 'topRight', ...GENERATED_SURROUND_LAYOUT.silhouette.topRightPine, layer: 'background', depth: GENERATED_SURROUND_DEPTH_SHADOW, alpha: GENERATED_SURROUND_ALPHA.silhouette.rightPine, originY: GENERATED_SURROUND_ORIGIN_PINE },
];
