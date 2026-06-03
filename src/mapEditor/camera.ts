import { AUTHORED_MAP_SIZE } from '../levels/authoredMap';

export interface EditorLevelLike {
  config: { tileSize: number };
  width: number;
  height: number;
}

export interface BoardBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface EditorProjection {
  getIsoMetrics: (generatedLevelActive: boolean, editorLevel: EditorLevelLike) => { tileW: number; tileH: number };
  isoToScreen: (
    x: number,
    y: number,
    z: number,
    generatedLevelActive: boolean,
    editorLevel: EditorLevelLike,
  ) => { x: number; y: number };
}

export function calculateEditorBoardBounds(
  editorLevel: EditorLevelLike,
  projection: EditorProjection,
): BoardBounds {
  const { tileW, tileH } = projection.getIsoMetrics(true, editorLevel);
  const points = [
    projection.isoToScreen(0, 0, 0, true, editorLevel),
    projection.isoToScreen(AUTHORED_MAP_SIZE - 1, 0, 0, true, editorLevel),
    projection.isoToScreen(0, AUTHORED_MAP_SIZE - 1, 0, true, editorLevel),
    projection.isoToScreen(AUTHORED_MAP_SIZE - 1, AUTHORED_MAP_SIZE - 1, 0, true, editorLevel),
  ];
  const left = Math.min(...points.map((point) => point.x)) - tileW;
  const right = Math.max(...points.map((point) => point.x)) + tileW;
  const top = Math.min(...points.map((point) => point.y)) - tileH * 2;
  const bottom = Math.max(...points.map((point) => point.y)) + tileH * 3;
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}
