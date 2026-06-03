import { describe, expect, it } from 'vitest';
import {
  getGameOverOverlayLayout,
  getLevelUpOverlayLayout,
  getOverlayContentOffset,
  getSplashOverlayLayout,
  isCompactOverlayLayout,
} from './overlaySystem';

describe('overlay layout helpers', () => {
  it('selects compact layout for narrow, tall, ultra-wide, or touch viewports', () => {
    expect(isCompactOverlayLayout(false, { width: 1280, height: 720 })).toBe(false);
    expect(isCompactOverlayLayout(false, { width: 900, height: 720 })).toBe(true);
    expect(isCompactOverlayLayout(false, { width: 1400, height: 600 })).toBe(true);
    expect(isCompactOverlayLayout(false, { width: 600, height: 900 })).toBe(true);
    expect(isCompactOverlayLayout(true, { width: 1280, height: 720 })).toBe(true);
  });

  it('keeps overlay content centered inside the canvas safe band', () => {
    expect(getOverlayContentOffset(300)).toBe(8);
    expect(getOverlayContentOffset(700)).toBeGreaterThan(0);
  });

  it('returns stable compact and full overlay dimensions', () => {
    expect(getSplashOverlayLayout(false).panelWidth).toBe(880);
    expect(getSplashOverlayLayout(true).panelWidth).toBe(820);
    expect(getLevelUpOverlayLayout(false).cardWidth).toBe(178);
    expect(getGameOverOverlayLayout(true).buttonY).toBe(116);
  });
});
