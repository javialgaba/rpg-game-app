import { describe, expect, it } from 'vitest';
import { SCENE_VARIANTS } from './sceneVariants';
import { getViewportBackdropStyles } from './viewportBackdrop';

describe('viewport backdrop', () => {
  it('builds season-specific CSS values from the active scene variant', () => {
    expect(getViewportBackdropStyles(SCENE_VARIANTS.noon_winter)).toEqual({
      color: '#b9d2db',
      backdropImage: 'url("/assets/scene-variants/noon_winter-bg.png")',
      frameImage: 'url("/assets/scene-variants/noon_winter-frame.png")',
    });
  });
});
