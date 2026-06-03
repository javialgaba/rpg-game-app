import { HEIGHT } from '../gameConfig';

export interface ViewportSize {
  width: number;
  height: number;
}

export function isCompactOverlayLayout(
  touchControlsEnabled: boolean,
  viewport: ViewportSize,
): boolean {
  const aspect = viewport.width / Math.max(1, viewport.height);
  return touchControlsEnabled
    || viewport.width < 980
    || viewport.height < 680
    || aspect > 2.05
    || aspect < 1.45;
}

export function getOverlayContentOffset(panelHeight: number, canvasHeight = HEIGHT): number {
  const minCenterY = 78 + panelHeight / 2;
  const maxCenterY = canvasHeight - 28 - panelHeight / 2;
  const targetCenterY = Math.max(minCenterY, Math.min(maxCenterY, canvasHeight / 2 + 8));
  return targetCenterY - canvasHeight / 2;
}

export function getSplashOverlayLayout(compact: boolean) {
  const panelHeight = compact ? 552 : 576;
  return {
    compact,
    panelWidth: compact ? 820 : 880,
    panelHeight,
    offsetY: getOverlayContentOffset(panelHeight),
    decorScale: compact ? 0.48 : 0.54,
    titleY: compact ? -212 : -224,
    titleWidth: compact ? 470 : 520,
    titleTextWidth: compact ? 392 : 440,
    titleHeight: compact ? 54 : 58,
    titleSize: compact ? 26 : 28,
    titleMinSize: compact ? 20 : 22,
    creditY: compact ? -172 : -182,
    promptY: compact ? -139 : -148,
    choiceY: compact ? -111 : -118,
    cardY: compact ? 32 : 38,
    cardX: compact ? 206 : 222,
    cardWidth: compact ? 160 : 172,
    cardHeight: compact ? 252 : 270,
    artY: compact ? -55 : -59,
    artSize: compact ? 150 : 162,
    captionY: compact ? 38 : 42,
    detailY: compact ? 65 : 71,
    startY: compact ? 218 : 236,
    startWidth: compact ? 230 : 242,
    startHeight: compact ? 50 : 52,
  };
}

export function getLevelUpOverlayLayout(compact: boolean) {
  const panelHeight = compact ? 492 : 520;
  return {
    compact,
    panelWidth: compact ? 720 : 780,
    panelHeight,
    offsetY: getOverlayContentOffset(panelHeight),
    decorScale: compact ? 0.48 : 0.54,
    titleY: compact ? -188 : -200,
    titleWidth: compact ? 360 : 390,
    titleTextWidth: compact ? 292 : 318,
    titleHeight: compact ? 66 : 72,
    titleSize: compact ? 30 : 32,
    titleMinSize: compact ? 21 : 23,
    rewardY: compact ? -143 : -154,
    helperY: compact ? -116 : -126,
    cardY: compact ? 36 : 42,
    cardXScale: compact ? 0.88 : 0.94,
    cardWidth: compact ? 166 : 178,
    cardHeight: compact ? 258 : 278,
    iconY: compact ? -56 : -62,
    iconSize: compact ? 116 : 124,
    badgeX: compact ? 52 : 57,
    badgeY: compact ? -98 : -107,
    labelY: compact ? 39 : 43,
    detailY: compact ? 65 : 70,
  };
}

export function getGameOverOverlayLayout(compact: boolean) {
  const panelHeight = compact ? 340 : 360;
  return {
    compact,
    panelWidth: compact ? 600 : 640,
    panelHeight,
    offsetY: getOverlayContentOffset(panelHeight),
    decorScale: compact ? 0.46 : 0.5,
    titleY: compact ? -116 : -126,
    titleWidth: compact ? 300 : 320,
    titleHeight: compact ? 54 : 58,
    titleSize: compact ? 29 : 31,
    reasonY: compact ? -50 : -56,
    statsY: compact ? 28 : 34,
    buttonY: compact ? 116 : 126,
  };
}
