export const PLAYER_OCCLUDED_SCENERY_ALPHA = 0.42;
export const PLAYER_OCCLUDER_FOOTPRINT_PADDING = 26;

export interface OcclusionBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PlayerOcclusionProbe {
  playerBounds: OcclusionBounds;
  playerDepth: number;
  occluderBounds: OcclusionBounds;
  occluderDepth: number;
  footprintBounds?: Pick<OcclusionBounds, 'left' | 'right'>;
}

export function shouldRegisterPlayerOccluder(render?: { occludesPlayer?: boolean }): boolean {
  return render?.occludesPlayer === true;
}

export function isPlayerOccludedByScenery(probe: PlayerOcclusionProbe): boolean {
  if (probe.occluderDepth <= probe.playerDepth) {
    return false;
  }
  const overlapsVisually = probe.playerBounds.left < probe.occluderBounds.right
    && probe.playerBounds.right > probe.occluderBounds.left
    && probe.playerBounds.top < probe.occluderBounds.bottom
    && probe.playerBounds.bottom > probe.occluderBounds.top;
  if (!overlapsVisually) {
    return false;
  }
  if (!probe.footprintBounds) {
    return true;
  }
  const playerCenterX = (probe.playerBounds.left + probe.playerBounds.right) / 2;
  return playerCenterX >= probe.footprintBounds.left - PLAYER_OCCLUDER_FOOTPRINT_PADDING
    && playerCenterX <= probe.footprintBounds.right + PLAYER_OCCLUDER_FOOTPRINT_PADDING;
}

export function getPlayerOccluderAlpha(baseAlpha: number, occluded: boolean): number {
  return occluded ? Math.min(baseAlpha, PLAYER_OCCLUDED_SCENERY_ALPHA) : baseAlpha;
}
