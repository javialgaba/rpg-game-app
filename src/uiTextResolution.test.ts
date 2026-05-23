import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculateUiTextResolution,
  createUiText,
  refreshUiTextResolution,
} from './uiFactory';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UI text resolution policy', () => {
  it('keeps standard-density, unscaled text at native resolution', () => {
    expect(calculateUiTextResolution(1, 1)).toBe(1);
  });

  it('raises text resolution for Retina displays or enlarged canvases', () => {
    expect(calculateUiTextResolution(2, 1)).toBe(2);
    expect(calculateUiTextResolution(1, 1.4)).toBe(2);
  });

  it('caps very high display requirements to protect texture memory', () => {
    expect(calculateUiTextResolution(4, 4)).toBe(3);
  });
});

describe('tracked high-resolution UI text', () => {
  it('refreshes existing persistent labels when the resolution tier changes', () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    const text = {
      active: true,
      once: vi.fn(),
      setResolution: vi.fn(),
    };
    const scene = {
      add: { text: vi.fn(() => text) },
      game: {
        canvas: {
          getBoundingClientRect: () => ({ width: 1280, height: 720 }),
        },
      },
      scale: { gameSize: { width: 1280, height: 720 } },
    };

    createUiText(scene, 0, 0, 'Ready', { color: '#fff' });
    expect(scene.add.text).toHaveBeenCalledWith(0, 0, 'Ready', {
      color: '#fff',
      resolution: 2,
    });

    vi.stubGlobal('window', { devicePixelRatio: 3 });
    expect(refreshUiTextResolution(scene)).toBe(true);
    expect(text.setResolution).toHaveBeenCalledWith(3);
    expect(refreshUiTextResolution(scene)).toBe(false);
  });
});
