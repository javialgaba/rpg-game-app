import { findGridPath } from './levels/pathfinding';

function getIsoMetrics(scene) {
  return scene.getIsoMetrics();
}

function isoToScreen(scene, x, y, z = 0) {
  return scene.isoToScreen(x, y, z);
}

function drawDebugDiamond(gfx, tileW, tileH, center, color, alpha = 0.18) {
  gfx.fillStyle(color, alpha);
  gfx.lineStyle(1, color, Math.min(1, alpha + 0.22));
  gfx.beginPath();
  gfx.moveTo(center.x, center.y - tileH / 2);
  gfx.lineTo(center.x + tileW / 2, center.y);
  gfx.lineTo(center.x, center.y + tileH / 2);
  gfx.lineTo(center.x - tileW / 2, center.y);
  gfx.closePath();
  gfx.fillPath();
  gfx.strokePath();
}

function getDecorationDebugColor(kind) {
  if (kind === 'fullTree' || kind === 'sapling') {
    return 0x2ed573;
  }
  if (kind === 'treeCluster') {
    return 0x1fa85f;
  }
  if (kind === 'bush') {
    return 0x78d66a;
  }
  if (kind === 'rocks') {
    return 0xd0d5dd;
  }
  if (kind === 'puddle') {
    return 0x7fd8f6;
  }
  if (kind === 'grassPatch') {
    return 0x9be86b;
  }
  if (kind === 'mushrooms') {
    return 0xffaa55;
  }
  if (kind === 'magicPlant') {
    return 0x6af7ff;
  }
  if (kind === 'sparkles') {
    return 0xffffff;
  }
  if (kind === 'lamp') {
    return 0xffe36a;
  }
  if (kind === 'fence' || kind === 'sign') {
    return 0xc7924e;
  }
  return 0xff93d8;
}

function drawDebugPath(scene, gfx, path, color, alpha = 0.56) {
  if (!path?.length) {
    return;
  }
  gfx.lineStyle(2, color, alpha);
  const first = isoToScreen(scene, path[0].x, path[0].y, -5);
  gfx.beginPath();
  gfx.moveTo(first.x, first.y);
  path.slice(1).forEach((cell) => {
    const p = isoToScreen(scene, cell.x, cell.y, -5);
    gfx.lineTo(p.x, p.y);
  });
  gfx.strokePath();
}

export function drawGeneratedLevelDebug(scene) {
  if (!scene.generatedLevel) {
    return;
  }
  scene.levelDebugGraphics?.destroy();
  const gfx = scene.add.graphics().setDepth(0);
  scene.levelDebugGraphics = gfx;
  const { tileW, tileH } = getIsoMetrics(scene);
  for (let y = 0; y < scene.generatedLevel.height; y += 1) {
    for (let x = 0; x < scene.generatedLevel.width; x += 1) {
      const center = isoToScreen(scene, x, y);
      drawDebugDiamond(gfx, tileW, tileH, center, 0xffffff, 0.035);
      if (scene.generatedLevel.roadGrid[y]?.[x]) {
        drawDebugDiamond(gfx, tileW, tileH, center, 0xe8d39c, 0.18);
      }
      if (scene.generatedLevel.blockedGrid[y][x]) {
        drawDebugDiamond(gfx, tileW, tileH, center, 0xff6b6b, 0.22);
      }
    }
  }
  const top = isoToScreen(scene, (scene.generatedLevel.width - 1) / 2, 0, -8);
  const right = isoToScreen(scene, scene.generatedLevel.width - 1, (scene.generatedLevel.height - 1) / 2, -8);
  const bottom = isoToScreen(scene, (scene.generatedLevel.width - 1) / 2, scene.generatedLevel.height - 1, -8);
  const left = isoToScreen(scene, 0, (scene.generatedLevel.height - 1) / 2, -8);
  gfx.lineStyle(3, 0xffffff, 0.38);
  gfx.strokePoints([top, right, bottom, left, top], false, true);
  scene.generatedLevel.spawnPoints.forEach((spawn) => {
    const spawnCenter = isoToScreen(scene, spawn.x, spawn.y);
    drawDebugDiamond(gfx, tileW, tileH, spawnCenter, 0xc678ff, 0.38);
  });
  if (scene.generatedLevel.playerSpawn) {
    const playerSpawnCenter = isoToScreen(scene, scene.generatedLevel.playerSpawn.x, scene.generatedLevel.playerSpawn.y);
    drawDebugDiamond(gfx, tileW, tileH, playerSpawnCenter, 0x68d8ff, 0.42);
  }
  scene.generatedLevel.protectedTargets.forEach((target) => {
    target.cells.forEach((cell) => {
      const cellCenter = isoToScreen(scene, cell.x, cell.y);
      drawDebugDiamond(gfx, tileW, tileH, cellCenter, 0xffdf6a, 0.34);
    });
    target.attackCells.forEach((cell) => {
      const cellCenter = isoToScreen(scene, cell.x, cell.y);
      drawDebugDiamond(gfx, tileW, tileH, cellCenter, 0x7dff9a, 0.18);
    });
  });
  scene.generatedLevel.decorations.forEach((decoration) => {
    const decoCenter = isoToScreen(scene, decoration.grid.x, decoration.grid.y);
    drawDebugDiamond(gfx, tileW, tileH, decoCenter, getDecorationDebugColor(decoration.decorationKind), 0.20);
  });
  const goals = scene.generatedLevel.protectedTargets.flatMap((target) => target.attackCells);
  scene.generatedLevel.spawnPoints.forEach((spawn) => {
    const path = findGridPath(scene.generatedLevel.walkableGrid, spawn, goals);
    path?.forEach((cell) => {
      const cellCenter = isoToScreen(scene, cell.x, cell.y);
      drawDebugDiamond(gfx, tileW, tileH, cellCenter, 0x60ffb2, 0.16);
    });
    drawDebugPath(scene, gfx, path, 0x60ffb2, 0.35);
  });
  scene.enemies
    .filter((enemy) => !enemy.defeated && !enemy.retreating)
    .forEach((enemy) => {
      drawDebugPath(scene, gfx, enemy.path, 0xff5cc6, 0.82);
      const enemyCenter = isoToScreen(scene, enemy.iso.x, enemy.iso.y);
      drawDebugDiamond(gfx, tileW, tileH, enemyCenter, 0xff5cc6, 0.42);
      if (enemy.target?.iso) {
        const targetCenter = isoToScreen(scene, enemy.target.iso.x, enemy.target.iso.y);
        drawDebugDiamond(gfx, tileW, tileH, targetCenter, 0xfff15c, 0.42);
      }
    });
  scene.levelDebugLayer.add(gfx);
}

export function toggleGeneratedLevelDebug(scene) {
  if (!scene.generatedLevel) {
    return;
  }
  scene.levelDebugVisible = !scene.levelDebugVisible;
  try {
    localStorage.setItem('debugLevelOverlay', scene.levelDebugVisible ? '1' : '0');
  } catch {
    // Debug persistence is optional.
  }
  if (scene.levelDebugVisible) {
    drawGeneratedLevelDebug(scene);
    scene.addGuildNote('Level grid debug shown.');
  } else {
    scene.levelDebugGraphics?.destroy();
    scene.levelDebugGraphics = null;
    scene.addGuildNote('Level grid debug hidden.');
  }
  scene.updateDebugOverlay();
}

export function updateGeneratedLevelDebug(scene, time) {
  if (!scene.levelDebugVisible || !scene.generatedLevel) {
    return;
  }
  if (time - scene.levelDebugLastRenderAt < 260) {
    return;
  }
  scene.levelDebugLastRenderAt = time;
  drawGeneratedLevelDebug(scene);
}
