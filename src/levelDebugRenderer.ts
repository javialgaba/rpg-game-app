import { findGridPath } from './levels/pathfinding';

const DEBUG_COLORS = {
  grid: 0xffffff,
  road: 0xe8d39c,
  rawBlocked: 0xff5252,
  building: 0xffd43d,
  solidProp: 0xff8c42,
  blockingDecoration: 0xf94144,
  environment: 0x4cc9f0,
  clearance: 0x59c3ff,
  pocket: 0xff2e88,
  attackArea: 0x7dff9a,
  route: 0x60ffb2,
  occluder: 0xffbc42,
  activeOccluder: 0xfff15c,
  scenicBoundary: 0x377c51,
  gateAvenue: 0xd6a14f,
  gateSightline: 0x86e8c6,
  gateStructure: 0xffb340,
  approachingEnemy: 0xff9b45,
  cameraCoverage: 0xa56dff,
};

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

function drawDebugOutline(gfx, tileW, tileH, center, color, alpha = 0.38) {
  gfx.lineStyle(1, color, alpha);
  gfx.beginPath();
  gfx.moveTo(center.x, center.y - tileH / 2 + 2);
  gfx.lineTo(center.x + tileW / 2 - 3, center.y);
  gfx.lineTo(center.x, center.y + tileH / 2 - 2);
  gfx.lineTo(center.x - tileW / 2 + 3, center.y);
  gfx.closePath();
  gfx.strokePath();
}

function addDebugLabel(scene, cell, text, color) {
  const position = isoToScreen(scene, cell.x, cell.y, -8);
  const label = scene.add.text(position.x, position.y - 10, text, {
    color,
    fontFamily: 'Arial, sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    stroke: '#15222b',
    strokeThickness: 3,
  }).setOrigin(0.5, 1).setDepth(1);
  scene.levelDebugLabels.push(label);
  scene.levelDebugLayer.add(label);
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
  scene.levelDebugLabels?.forEach((label) => label.destroy());
  scene.levelDebugLabels = [];
  const gfx = scene.add.graphics().setDepth(0);
  scene.levelDebugGraphics = gfx;
  const { tileW, tileH } = getIsoMetrics(scene);
  const scenicBoundaryKeys = new Set(scene.generatedLevel.scenicTerrain.map((placement) => (
    `${placement.grid.x},${placement.grid.y}`
  )));
  const gateAvenueKeys = new Set(scene.generatedLevel.gates
    .flatMap((gate) => gate.roadCells)
    .map((cell) => `${cell.x},${cell.y}`));
  const gateSightlineKeys = new Set(scene.generatedLevel.gates
    .flatMap((gate) => gate.sightlineCells)
    .map((cell) => `${cell.x},${cell.y}`));
  for (let y = 0; y < scene.generatedLevel.height; y += 1) {
    for (let x = 0; x < scene.generatedLevel.width; x += 1) {
      const center = isoToScreen(scene, x, y);
      const key = `${x},${y}`;
      drawDebugDiamond(gfx, tileW, tileH, center, DEBUG_COLORS.grid, 0.035);
      if (scene.generatedLevel.roadGrid[y]?.[x]) {
        drawDebugDiamond(gfx, tileW, tileH, center, DEBUG_COLORS.road, 0.18);
      }
      if (scene.generatedLevel.playerReachableGrid[y]?.[x]) {
        drawDebugOutline(gfx, tileW, tileH, center, DEBUG_COLORS.clearance, 0.43);
      }
      if (gateAvenueKeys.has(key)) {
        drawDebugDiamond(gfx, tileW, tileH, center, DEBUG_COLORS.gateAvenue, 0.38);
      } else if (gateSightlineKeys.has(key)) {
        drawDebugDiamond(gfx, tileW, tileH, center, DEBUG_COLORS.gateSightline, 0.2);
      } else if (scenicBoundaryKeys.has(key)) {
        drawDebugDiamond(
          gfx,
          tileW,
          tileH,
          center,
          DEBUG_COLORS.scenicBoundary,
          0.24,
        );
      } else if (scene.generatedLevel.blockedGrid[y][x]) {
        drawDebugDiamond(gfx, tileW, tileH, center, DEBUG_COLORS.rawBlocked, 0.16);
      }
    }
  }
  scene.generatedApronDebugCells?.forEach((cell) => {
    const center = isoToScreen(scene, cell.x, cell.y);
    drawDebugDiamond(
      gfx,
      tileW,
      tileH,
      center,
      cell.reason === 'gate-road' ? DEBUG_COLORS.gateAvenue : DEBUG_COLORS.scenicBoundary,
      cell.reason === 'gate-road' ? 0.3 : 0.16,
    );
    if (cell.hasProp) {
      drawDebugOutline(gfx, tileW, tileH, center, DEBUG_COLORS.environment, 0.58);
    }
  });
  scene.generatedLevel.playerPocketCells.forEach((cell) => {
    drawDebugDiamond(gfx, tileW, tileH, isoToScreen(scene, cell.x, cell.y), DEBUG_COLORS.pocket, 0.5);
    addDebugLabel(scene, cell, 'POCKET', '#ff77ad');
  });
  const top = isoToScreen(scene, (scene.generatedLevel.width - 1) / 2, 0, -8);
  const right = isoToScreen(scene, scene.generatedLevel.width - 1, (scene.generatedLevel.height - 1) / 2, -8);
  const bottom = isoToScreen(scene, (scene.generatedLevel.width - 1) / 2, scene.generatedLevel.height - 1, -8);
  const left = isoToScreen(scene, 0, (scene.generatedLevel.height - 1) / 2, -8);
  gfx.lineStyle(3, 0xffffff, 0.38);
  gfx.strokePoints([top, right, bottom, left, top], false, true);
  const cameraBounds = scene.getGeneratedCameraBounds?.();
  if (cameraBounds) {
    gfx.lineStyle(2, DEBUG_COLORS.cameraCoverage, 0.45);
    gfx.strokeRect(cameraBounds.x, cameraBounds.y, cameraBounds.width, cameraBounds.height);
  }
  scene.generatedLevel.spawnPoints.forEach((spawn) => {
    const spawnCenter = isoToScreen(scene, spawn.x, spawn.y);
    drawDebugDiamond(gfx, tileW, tileH, spawnCenter, 0xc678ff, 0.38);
  });
  scene.generatedLevel.gates.forEach((gate) => {
    drawDebugOutline(gfx, tileW, tileH, isoToScreen(scene, gate.threshold.x, gate.threshold.y), DEBUG_COLORS.gateStructure, 0.95);
    addDebugLabel(scene, gate.threshold, `${gate.direction.toUpperCase()} GATE`, '#ffc766');
    const entryCenter = isoToScreen(scene, gate.visualEntry.x, gate.visualEntry.y);
    drawDebugDiamond(gfx, tileW, tileH, entryCenter, DEBUG_COLORS.gateStructure, 0.44);
  });
  if (scene.generatedLevel.playerSpawn) {
    const playerSpawnCenter = isoToScreen(scene, scene.generatedLevel.playerSpawn.x, scene.generatedLevel.playerSpawn.y);
    drawDebugDiamond(gfx, tileW, tileH, playerSpawnCenter, 0x68d8ff, 0.42);
  }
  scene.generatedLevel.protectedTargets.forEach((target) => {
    target.cells.forEach((cell) => {
      const cellCenter = isoToScreen(scene, cell.x, cell.y);
      drawDebugDiamond(gfx, tileW, tileH, cellCenter, DEBUG_COLORS.building, 0.38);
    });
    addDebugLabel(scene, target.grid, target.label.toUpperCase(), '#ffe77d');
    target.attackCells.forEach((cell) => {
      const cellCenter = isoToScreen(scene, cell.x, cell.y);
      drawDebugDiamond(gfx, tileW, tileH, cellCenter, DEBUG_COLORS.attackArea, 0.18);
    });
  });
  scene.generatedLevel.objects
    .filter((placement) => placement.type !== 'building')
    .forEach((placement) => {
      placement.cells.forEach((cell) => {
        drawDebugDiamond(gfx, tileW, tileH, isoToScreen(scene, cell.x, cell.y), DEBUG_COLORS.solidProp, 0.32);
      });
    });
  scene.generatedLevel.scenicObjects.forEach((placement) => {
    placement.cells.forEach((cell) => {
      drawDebugOutline(gfx, tileW, tileH, isoToScreen(scene, cell.x, cell.y), DEBUG_COLORS.scenicBoundary, 0.58);
    });
  });
  scene.generatedLevel.decorations.forEach((decoration) => {
    const color = decoration.blocksMovement ? DEBUG_COLORS.blockingDecoration : DEBUG_COLORS.environment;
    decoration.cells.forEach((cell) => {
      const decoCenter = isoToScreen(scene, cell.x, cell.y);
      drawDebugDiamond(gfx, tileW, tileH, decoCenter, color, decoration.blocksMovement ? 0.4 : 0.25);
      drawDebugOutline(gfx, tileW, tileH, decoCenter, getDecorationDebugColor(decoration.decorationKind), 0.8);
    });
  });
  scene.playerOccluders?.forEach((occluder) => {
    occluder.footprintCells?.forEach((cell) => {
      drawDebugOutline(
        gfx,
        tileW,
        tileH,
        isoToScreen(scene, cell.x, cell.y),
        occluder.occluding ? DEBUG_COLORS.activeOccluder : DEBUG_COLORS.occluder,
        occluder.occluding ? 0.95 : 0.68,
      );
    });
  });
  const goals = scene.generatedLevel.protectedTargets.flatMap((target) => target.attackCells);
  scene.generatedLevel.spawnPoints.forEach((spawn) => {
    const path = findGridPath(scene.generatedLevel.walkableGrid, spawn, goals);
    path?.forEach((cell) => {
      const cellCenter = isoToScreen(scene, cell.x, cell.y);
      drawDebugDiamond(gfx, tileW, tileH, cellCenter, DEBUG_COLORS.route, 0.16);
    });
    drawDebugPath(scene, gfx, path, 0x60ffb2, 0.35);
  });
  scene.enemies
    .filter((enemy) => !enemy.defeated && !enemy.retreating)
    .forEach((enemy) => {
      drawDebugPath(scene, gfx, enemy.path, 0xff5cc6, 0.82);
      const enemyCenter = isoToScreen(scene, enemy.iso.x, enemy.iso.y);
      drawDebugDiamond(
        gfx,
        tileW,
        tileH,
        enemyCenter,
        enemy.entranceState === 'approaching' ? DEBUG_COLORS.approachingEnemy : 0xff5cc6,
        0.42,
      );
      if (enemy.target?.iso) {
        const targetCenter = isoToScreen(scene, enemy.target.iso.x, enemy.target.iso.y);
        drawDebugDiamond(gfx, tileW, tileH, targetCenter, 0xfff15c, 0.42);
      }
    });
  const movementDebug = scene.getPlayerMovementDebugState?.();
  if (movementDebug?.activeIntent && scene.player) {
    const start = isoToScreen(scene, scene.player.iso.x, scene.player.iso.y, -12);
    const intendedEnd = isoToScreen(
      scene,
      scene.player.iso.x + movementDebug.activeIntent.iso.x * 0.8,
      scene.player.iso.y + movementDebug.activeIntent.iso.y * 0.8,
      -12,
    );
    gfx.lineStyle(4, movementDebug.rejectedReason ? DEBUG_COLORS.rawBlocked : DEBUG_COLORS.route, 0.88);
    gfx.beginPath();
    gfx.moveTo(start.x, start.y);
    gfx.lineTo(intendedEnd.x, intendedEnd.y);
    gfx.strokePath();
    const selectedIso = movementDebug.movementResult?.selectedIso;
    if (selectedIso && movementDebug.movementResult?.reason?.endsWith('-slide')) {
      const slideEnd = isoToScreen(
        scene,
        scene.player.iso.x + selectedIso.x * 0.8,
        scene.player.iso.y + selectedIso.y * 0.8,
        -12,
      );
      gfx.lineStyle(5, DEBUG_COLORS.clearance, 0.94);
      gfx.beginPath();
      gfx.moveTo(start.x, start.y);
      gfx.lineTo(slideEnd.x, slideEnd.y);
      gfx.strokePath();
    }
    movementDebug.movementResult?.candidates
      .filter((candidate) => !candidate.accepted)
      .forEach((candidate) => {
        const rejected = isoToScreen(scene, candidate.position.x, candidate.position.y, -13);
        gfx.fillStyle(DEBUG_COLORS.rawBlocked, 0.9);
        gfx.fillCircle(rejected.x, rejected.y, 4);
      });
  }
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
    scene.levelDebugLabels?.forEach((label) => label.destroy());
    scene.levelDebugLabels = [];
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
