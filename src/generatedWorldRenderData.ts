export interface WorldBounds {
  centerX: number;
  centerY: number;
  top: { y: number };
  bottom: { y: number };
  left: { x: number };
  right: { x: number };
  boardWidth: number;
  boardHeight: number;
}

export interface WorldRenderFogPiece {
  frame: string;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
}

export interface WorldRenderBackdropPiece {
  frame: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorldEdgeClusterPiece {
  frame: string;
  x: number;
  y: number;
  depth: number;
}

export function getWorldFogPieces(bounds: WorldBounds, tileW: number, tileH: number): WorldRenderFogPiece[] {
  return [
    {
      frame: 'edge_fog_n_01',
      x: bounds.centerX,
      y: bounds.top.y - tileH * 3.3,
      width: bounds.boardWidth * 2.42,
      height: tileH * 22.4,
      alpha: 0.42,
    },
    {
      frame: 'edge_fog_n_01',
      x: bounds.centerX - bounds.boardWidth * 0.38,
      y: bounds.top.y - tileH * 1.3,
      width: bounds.boardWidth * 1.24,
      height: tileH * 16.6,
      alpha: 0.32,
    },
    {
      frame: 'edge_fog_n_01',
      x: bounds.centerX + bounds.boardWidth * 0.38,
      y: bounds.top.y - tileH * 1.3,
      width: bounds.boardWidth * 1.24,
      height: tileH * 16.6,
      alpha: 0.32,
    },
    {
      frame: 'edge_fog_e_01',
      x: bounds.right.x + tileW * 4.9,
      y: bounds.centerY + tileH * 0.12,
      width: tileW * 18.4,
      height: bounds.boardHeight * 1.62,
      alpha: 0.28,
    },
    {
      frame: 'edge_fog_s_01',
      x: bounds.centerX,
      y: bounds.bottom.y + tileH * 3.85,
      width: bounds.boardWidth * 1.88,
      height: tileH * 15.6,
      alpha: 0.3,
    },
    {
      frame: 'edge_fog_w_01',
      x: bounds.left.x - tileW * 4.9,
      y: bounds.centerY + tileH * 0.12,
      width: tileW * 18.4,
      height: bounds.boardHeight * 1.62,
      alpha: 0.28,
    },
  ];
}

export function getWorldBackdropPieces(bounds: WorldBounds, tileW: number, tileH: number): WorldRenderBackdropPiece[] {
  return [
    {
      frame: 'edge_backdrop_n_01',
      x: bounds.centerX,
      y: bounds.top.y - tileH * 1.62,
      width: bounds.boardWidth * 2.38,
      height: tileH * 29.4,
    },
    {
      frame: 'edge_backdrop_n_01',
      x: bounds.centerX - bounds.boardWidth * 0.44,
      y: bounds.top.y - tileH * 0.58,
      width: bounds.boardWidth * 1.28,
      height: tileH * 20.8,
    },
    {
      frame: 'edge_backdrop_n_01',
      x: bounds.centerX + bounds.boardWidth * 0.44,
      y: bounds.top.y - tileH * 0.58,
      width: bounds.boardWidth * 1.28,
      height: tileH * 20.8,
    },
    {
      frame: 'edge_backdrop_n_01',
      x: bounds.centerX - bounds.boardWidth * 0.16,
      y: bounds.top.y - tileH * 0.02,
      width: bounds.boardWidth * 0.96,
      height: tileH * 15.8,
    },
    {
      frame: 'edge_backdrop_n_01',
      x: bounds.centerX + bounds.boardWidth * 0.16,
      y: bounds.top.y - tileH * 0.02,
      width: bounds.boardWidth * 0.96,
      height: tileH * 15.8,
    },
    {
      frame: 'edge_backdrop_n_01',
      x: bounds.centerX,
      y: bounds.top.y + tileH * 0.58,
      width: bounds.boardWidth * 1.14,
      height: tileH * 13.2,
    },
    {
      frame: 'edge_backdrop_w_01',
      x: bounds.left.x - tileW * 6.4,
      y: bounds.centerY - tileH * 1.45,
      width: tileW * 17.2,
      height: bounds.boardHeight * 1.26,
    },
    {
      frame: 'edge_backdrop_w_01',
      x: bounds.left.x - tileW * 6.3,
      y: bounds.centerY + tileH * 2.35,
      width: tileW * 17.4,
      height: bounds.boardHeight * 1.18,
    },
    {
      frame: 'edge_backdrop_e_01',
      x: bounds.right.x + tileW * 6.4,
      y: bounds.centerY - tileH * 1.45,
      width: tileW * 17.2,
      height: bounds.boardHeight * 1.26,
    },
    {
      frame: 'edge_backdrop_e_01',
      x: bounds.right.x + tileW * 6.3,
      y: bounds.centerY + tileH * 2.35,
      width: tileW * 17.4,
      height: bounds.boardHeight * 1.18,
    },
    {
      frame: 'edge_backdrop_s_01',
      x: bounds.centerX,
      y: bounds.bottom.y + tileH * 5.1,
      width: bounds.boardWidth * 1.96,
      height: tileH * 18.4,
    },
    {
      frame: 'edge_backdrop_nw_01',
      x: bounds.left.x - tileW * 4.7,
      y: bounds.top.y - tileH * 0.66,
      width: tileW * 21.4,
      height: tileH * 25.2,
    },
    {
      frame: 'edge_backdrop_ne_01',
      x: bounds.right.x + tileW * 4.7,
      y: bounds.top.y - tileH * 0.66,
      width: tileW * 21.4,
      height: tileH * 25.2,
    },
    {
      frame: 'edge_backdrop_sw_01',
      x: bounds.left.x - tileW * 5.8,
      y: bounds.bottom.y + tileH * 4.35,
      width: tileW * 15.8,
      height: tileH * 18.4,
    },
    {
      frame: 'edge_backdrop_se_01',
      x: bounds.right.x + tileW * 5.8,
      y: bounds.bottom.y + tileH * 4.35,
      width: tileW * 15.8,
      height: tileH * 18.4,
    },
  ];
}

export function getWorldEdgeClusters(bounds: WorldBounds, tileW: number, tileH: number): WorldEdgeClusterPiece[] {
  return [
    {
      frame: 'edge_cluster_nw_01',
      x: bounds.left.x - tileW * 2.9,
      y: bounds.top.y + tileH * 1.15,
      depth: bounds.top.y + tileH * 0.34,
    },
    {
      frame: 'edge_cluster_ne_01',
      x: bounds.right.x + tileW * 2.9,
      y: bounds.top.y + tileH * 1.15,
      depth: bounds.top.y + tileH * 0.34,
    },
    {
      frame: 'edge_cluster_nw_01',
      x: bounds.centerX - bounds.boardWidth * 0.3,
      y: bounds.top.y - tileH * 0.08,
      depth: bounds.top.y + tileH * 0.18,
    },
    {
      frame: 'edge_cluster_ne_01',
      x: bounds.centerX + bounds.boardWidth * 0.3,
      y: bounds.top.y - tileH * 0.08,
      depth: bounds.top.y + tileH * 0.18,
    },
    {
      frame: 'edge_cluster_nw_01',
      x: bounds.centerX - tileW * 1.9,
      y: bounds.top.y - tileH * 0.42,
      depth: bounds.top.y + tileH * 0.08,
    },
    {
      frame: 'edge_cluster_ne_01',
      x: bounds.centerX + tileW * 1.9,
      y: bounds.top.y - tileH * 0.42,
      depth: bounds.top.y + tileH * 0.08,
    },
    {
      frame: 'edge_cluster_nw_01',
      x: bounds.left.x - tileW * 4.25,
      y: bounds.centerY - tileH * 2.75,
      depth: bounds.centerY - tileH * 2.15,
    },
    {
      frame: 'edge_cluster_ne_01',
      x: bounds.right.x + tileW * 4.25,
      y: bounds.centerY - tileH * 2.75,
      depth: bounds.centerY - tileH * 2.15,
    },
    {
      frame: 'edge_cluster_sw_01',
      x: bounds.left.x - tileW * 4.25,
      y: bounds.centerY + tileH * 3.05,
      depth: bounds.centerY + tileH * 2.2,
    },
    {
      frame: 'edge_cluster_se_01',
      x: bounds.right.x + tileW * 4.25,
      y: bounds.centerY + tileH * 3.05,
      depth: bounds.centerY + tileH * 2.2,
    },
    {
      frame: 'edge_cluster_sw_01',
      x: bounds.left.x - tileW * 2.9,
      y: bounds.bottom.y + tileH * 3.15,
      depth: bounds.bottom.y + tileH * 1.72,
    },
    {
      frame: 'edge_cluster_se_01',
      x: bounds.right.x + tileW * 2.9,
      y: bounds.bottom.y + tileH * 3.15,
      depth: bounds.bottom.y + tileH * 1.72,
    },
    {
      frame: 'edge_cluster_sw_01',
      x: bounds.centerX - bounds.boardWidth * 0.2,
      y: bounds.bottom.y + tileH * 3.55,
      depth: bounds.bottom.y + tileH * 1.84,
    },
    {
      frame: 'edge_cluster_se_01',
      x: bounds.centerX + bounds.boardWidth * 0.2,
      y: bounds.bottom.y + tileH * 3.55,
      depth: bounds.bottom.y + tileH * 1.84,
    },
  ];
}
