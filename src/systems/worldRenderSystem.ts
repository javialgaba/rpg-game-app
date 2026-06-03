import type { GeneratedGate, GridPoint, PlayableBounds } from '../levels/levelTypes';

export interface GeneratedLevelBoundsInput {
  width: number;
  height: number;
}

export interface GeneratedWorldBounds {
  top: GridPoint;
  right: GridPoint;
  bottom: GridPoint;
  left: GridPoint;
  centerX: number;
  centerY: number;
  boardWidth: number;
  boardHeight: number;
}

export function getGeneratedTerrainApronOutsideDistance(
  x: number,
  y: number,
  level: GeneratedLevelBoundsInput | null,
): number {
  if (!level) {
    return Infinity;
  }
  const distanceX = x < 0 ? -x : (x >= level.width ? x - level.width + 1 : 0);
  const distanceY = y < 0 ? -y : (y >= level.height ? y - level.height + 1 : 0);
  return Math.max(distanceX, distanceY);
}

export function isGeneratedTerrainApronGateSightline(
  x: number,
  y: number,
  level: (GeneratedLevelBoundsInput & { gates: GeneratedGate[] }) | null,
): boolean {
  if (!level) {
    return false;
  }
  return level.gates.some((gate) => {
    if (gate.direction === 'north') {
      return y < 0 && Math.abs(x - gate.threshold.x) <= 3;
    }
    if (gate.direction === 'south') {
      return y >= level.height && Math.abs(x - gate.threshold.x) <= 3;
    }
    if (gate.direction === 'west') {
      return x < 0 && Math.abs(y - gate.threshold.y) <= 3;
    }
    return x >= level.width && Math.abs(y - gate.threshold.y) <= 3;
  });
}

export function shouldRenderGeneratedCellCliff(grid: GridPoint, bounds: PlayableBounds | null): boolean {
  if (!bounds) {
    return false;
  }
  const { minX, minY, maxX, maxY } = bounds;
  const isCorner = (
    (grid.x === minX && grid.y === minY)
    || (grid.x === maxX && grid.y === minY)
    || (grid.x === maxX && grid.y === maxY)
    || (grid.x === minX && grid.y === maxY)
  );
  if (isCorner || grid.y === maxY) {
    return true;
  }
  if (grid.y === minY) {
    return false;
  }
  if (grid.x === minX || grid.x === maxX) {
    return grid.y >= Math.max(minY + 4, minY + Math.floor((maxY - minY) * 0.28));
  }
  return false;
}

export function getGeneratedWorldCliffFrame(grid: GridPoint, bounds: PlayableBounds | null): string | null {
  if (!bounds) {
    return null;
  }
  const { minX, minY, maxX, maxY } = bounds;
  if (grid.x === minX && grid.y === minY) {return 'edge_corner_n_01';}
  if (grid.x === maxX && grid.y === minY) {return 'edge_corner_e_01';}
  if (grid.x === maxX && grid.y === maxY) {return 'edge_corner_s_01';}
  if (grid.x === minX && grid.y === maxY) {return 'edge_corner_w_01';}
  if (grid.y === minY) {return 'edge_cliff_nw_01';}
  if (grid.x === maxX) {return 'edge_cliff_ne_01';}
  if (grid.y === maxY) {return 'edge_cliff_se_01';}
  if (grid.x === minX) {return 'edge_cliff_sw_01';}
  return null;
}

export function getGeneratedWorldCliffOffset(
  grid: GridPoint,
  tileW: number,
  tileH: number,
  bounds: PlayableBounds | null,
): GridPoint {
  if (!bounds) {
    return { x: 0, y: 0 };
  }
  const { minX, minY, maxX, maxY } = bounds;
  if (grid.x === minX && grid.y === minY) {return { x: 0, y: tileH * 0.72 };}
  if (grid.x === maxX && grid.y === minY) {return { x: tileW * 0.54, y: tileH * 0.92 };}
  if (grid.x === maxX && grid.y === maxY) {return { x: 0, y: tileH * 1.46 };}
  if (grid.x === minX && grid.y === maxY) {return { x: -tileW * 0.54, y: tileH * 0.92 };}
  if (grid.y === minY) {return { x: tileW * 0.16, y: tileH * 0.52 };}
  if (grid.x === maxX) {return { x: tileW * 0.48, y: tileH * 0.92 };}
  if (grid.y === maxY) {return { x: -tileW * 0.16, y: tileH * 1.3 };}
  if (grid.x === minX) {return { x: -tileW * 0.48, y: tileH * 0.92 };}
  return { x: 0, y: 0 };
}

export function isGeneratedBoardEdgeCell(grid: GridPoint, bounds: PlayableBounds | null): boolean {
  if (!bounds) {
    return false;
  }
  const { minX, minY, maxX, maxY } = bounds;
  return grid.x === minX || grid.y === minY || grid.x === maxX || grid.y === maxY;
}

export function getGeneratedWorldBounds(
  level: GeneratedLevelBoundsInput | null,
  tileW: number,
  tileH: number,
  isoToScreen: (x: number, y: number) => GridPoint,
): GeneratedWorldBounds | null {
  if (!level) {
    return null;
  }
  const minX = 0;
  const minY = 0;
  const maxX = level.width - 1;
  const maxY = level.height - 1;
  const top = isoToScreen(minX, minY);
  const right = isoToScreen(maxX, minY);
  const bottom = isoToScreen(maxX, maxY);
  const left = isoToScreen(minX, maxY);
  return {
    top,
    right,
    bottom,
    left,
    centerX: (left.x + right.x) / 2,
    centerY: (top.y + bottom.y) / 2,
    boardWidth: Math.abs(right.x - left.x) + tileW * 2.55,
    boardHeight: Math.abs(bottom.y - top.y) + tileH * 2.55,
  };
}
