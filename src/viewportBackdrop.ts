import type { SceneVariantConfig } from './sceneVariants';

const toCssHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export function getViewportBackdropStyles(variant: SceneVariantConfig) {
  return {
    color: toCssHex(variant.scenicFallbackColor),
    backdropImage: `url("/assets/scene-variants/${variant.key}-bg.png")`,
    frameImage: `url("/assets/scene-variants/${variant.key}-frame.png")`,
  };
}

export function applyViewportBackdrop(variant: SceneVariantConfig) {
  const host = document.getElementById('game');
  if (!host) {
    return;
  }
  const styles = getViewportBackdropStyles(variant);
  host.style.setProperty('--game-backdrop-color', styles.color);
  host.style.setProperty('--game-backdrop-image', styles.backdropImage);
  host.style.setProperty('--game-frame-image', styles.frameImage);
}
