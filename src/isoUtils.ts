import * as Phaser from 'phaser';
import type { GridPoint } from './levels/levelTypes';
import type { ScreenFootprintBounds } from './gameTypes';
import { isFootprintWalkable } from './levels/playerFootprint';
import { TILE_W, TILE_H, ORIGIN, MAP_W, MAP_H } from './gameConfig';

export interface IsoMetrics {
  origin: { x: number; y: number };
  tileW: number;
  tileH: number;
  scale: number;
  mapW: number;
  mapH: number;
}

export function getIsoMetrics(
  generatedLevelActive: boolean,
  generatedLevel: { config: { tileSize: number }; width: number; height: number } | null,
): IsoMetrics {
  const generated = generatedLevelActive && generatedLevel;
  const scale = generated ? generatedLevel!.config.tileSize / 64 : 1;
  const tileW = TILE_W * scale;
  const tileH = TILE_H * scale;
  const mapW = generated ? generatedLevel!.width : MAP_W;
  const mapH = generated ? generatedLevel!.height : MAP_H;
  const defaultCenterY = ORIGIN.y + ((MAP_W - 1 + MAP_H - 1) * TILE_H) / 4;
  const origin = generated
    ? {
      x: ORIGIN.x,
      y: defaultCenterY - ((mapW - 1 + mapH - 1) * tileH) / 4,
    }
    : ORIGIN;
  return { origin, tileW, tileH, scale, mapW, mapH };
}

export function scaleGeneratedSize(
  size: [number, number],
  generatedLevelActive: boolean,
  generatedLevel: { config: { tileSize: number } } | null,
): [number, number] {
  const scale = generatedLevelActive && generatedLevel ? generatedLevel.config.tileSize / 64 : 1;
  return [size[0] * scale, size[1] * scale];
}

export function getFootprintScreenBounds(
  footprintCells: GridPoint[],
  generatedLevelActive: boolean,
  generatedLevel: { config: { tileSize: number }; width: number; height: number } | null,
): ScreenFootprintBounds {
  const { tileW, tileH } = getIsoMetrics(generatedLevelActive, generatedLevel);
  const halfW = tileW / 2;
  const halfH = tileH / 2;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  footprintCells.forEach((cell) => {
    const center = isoToScreen(cell.x, cell.y, 0, generatedLevelActive, generatedLevel);
    left = Math.min(left, center.x - halfW);
    right = Math.max(right, center.x + halfW);
    top = Math.min(top, center.y - halfH);
    bottom = Math.max(bottom, center.y + halfH);
  });

  if (!Number.isFinite(left) || !Number.isFinite(right) || !Number.isFinite(top) || !Number.isFinite(bottom)) {
    const center = isoToScreen(0, 0, 0, generatedLevelActive, generatedLevel);
    left = center.x - halfW;
    right = center.x + halfW;
    top = center.y - halfH;
    bottom = center.y + halfH;
  }

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    bottomCenterX: (left + right) / 2,
    bottomCenterY: bottom,
  };
}

export function isoToScreen(
  x: number,
  y: number,
  z: number = 0,
  generatedLevelActive: boolean,
  generatedLevel: { config: { tileSize: number }; width: number; height: number } | null,
): { x: number; y: number } {
  const { origin, tileW, tileH, scale } = getIsoMetrics(generatedLevelActive, generatedLevel);
  return {
    x: origin.x + (x - y) * (tileW / 2),
    y: origin.y + (x + y) * (tileH / 2) - z * scale,
  };
}

export function isoToGroundedEntityScreen(
  x: number,
  y: number,
  z: number = 18,
  generatedLevelActive: boolean,
  generatedLevel: { config: { tileSize: number }; width: number; height: number } | null,
): { x: number; y: number } {
  const point = isoToScreen(x, y, generatedLevelActive ? 0 : z, generatedLevelActive, generatedLevel);
  if (!generatedLevelActive) {
    return point;
  }
  const { tileH } = getIsoMetrics(generatedLevelActive, generatedLevel);
  return { x: point.x, y: point.y + tileH / 2 };
}

export function screenToIso(
  x: number,
  y: number,
  generatedLevelActive: boolean,
  generatedLevel: { config: { tileSize: number }; width: number; height: number } | null,
): { x: number; y: number } {
  const { origin, tileW, tileH } = getIsoMetrics(generatedLevelActive, generatedLevel);
  const sx = x - origin.x;
  const sy = y - origin.y;
  return {
    x: sy / tileH + sx / tileW,
    y: sy / tileH - sx / tileW,
  };
}

export function clampIso(
  point: { x: number; y: number },
  padding: number,
  generatedLevelActive: boolean,
  generatedLevel: { playableBounds: { minX: number; minY: number; maxX: number; maxY: number }; width: number; height: number } | null,
): { x: number; y: number } {
  if (generatedLevelActive && generatedLevel) {
    const { minX, minY, maxX, maxY } = generatedLevel.playableBounds;
    point.x = Phaser.Math.Clamp(point.x, minX, maxX);
    point.y = Phaser.Math.Clamp(point.y, minY, maxY);
    return point;
  }
  const maxX = (generatedLevelActive && generatedLevel ? generatedLevel.width : MAP_W) - 1 - padding;
  const maxY = (generatedLevelActive && generatedLevel ? generatedLevel.height : MAP_H) - 1 - padding;
  point.x = Phaser.Math.Clamp(point.x, padding, maxX);
  point.y = Phaser.Math.Clamp(point.y, padding, maxY);
  return point;
}

export function isGeneratedIsoWalkable(
  iso: { x: number; y: number },
  generatedLevelActive: boolean,
  generatedLevel: { walkableGrid: boolean[][]; playableBounds: { minX: number; minY: number; maxX: number; maxY: number } } | null,
): boolean {
  if (!generatedLevelActive || !generatedLevel) {
    return true;
  }
  return isFootprintWalkable(
    generatedLevel.walkableGrid,
    iso,
    generatedLevel.playableBounds,
  );
}
