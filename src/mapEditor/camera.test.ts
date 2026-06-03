import { describe, expect, it } from 'vitest';
import { calculateEditorBoardBounds } from './camera';
import { CAMERA_MAX_ZOOM, CAMERA_MIN_ZOOM, OBJECT_RENDERING } from './editorConfig';

describe('map editor helpers', () => {
  it('calculates board bounds around the authored map diamond', () => {
    const bounds = calculateEditorBoardBounds({
      config: { tileSize: 60 },
      width: 29,
      height: 29,
    }, {
      getIsoMetrics: () => ({ tileW: 120, tileH: 60 }),
      isoToScreen: (x, y) => ({ x: (x - y) * 60, y: (x + y) * 30 }),
    });
    expect(bounds.width).toBeGreaterThan(1700);
    expect(bounds.height).toBeGreaterThan(900);
    expect(bounds.centerX).toBeCloseTo(0);
  });

  it('keeps object rendering metadata available outside the scene', () => {
    expect(OBJECT_RENDERING.castle?.atlas).toBe('sceneVariantBuildingsAtlas');
    expect(OBJECT_RENDERING.gate_w?.atlas).toBe('sceneVariantPropsAtlas');
  });

  it('defines a valid zoom range', () => {
    expect(CAMERA_MIN_ZOOM).toBeLessThan(CAMERA_MAX_ZOOM);
  });
});
