import {
  COLORS, MAP_H, MAP_W, TILE_W, TILE_H,
  GENERATED_BUILDING_SPRITE_ALPHA,
  STATIC_BUILDING_BASE_ALPHA,
  STATIC_BUILDING_SPRITE_ALPHA,
} from './gameConfig';

export function drawDiamond(scene, x, y, w, h, fill, stroke, alpha = 1, strokeAlpha = 0.45) {
  scene.tileGraphics.fillStyle(fill, alpha);
  scene.tileGraphics.lineStyle(1, stroke, strokeAlpha);
  scene.tileGraphics.beginPath();
  scene.tileGraphics.moveTo(x, y - h / 2);
  scene.tileGraphics.lineTo(x + w / 2, y);
  scene.tileGraphics.lineTo(x, y + h / 2);
  scene.tileGraphics.lineTo(x - w / 2, y);
  scene.tileGraphics.closePath();
  scene.tileGraphics.fillPath();
  scene.tileGraphics.strokePath();
}

export function drawMapTiles(scene) {
  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      const center = scene.isoToScreen(x, y);
      const isEdge = x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3;
      const isPath = Math.abs(x - 7) <= 1 || Math.abs(y - 7) <= 1 || (x > 4 && x < 11 && y > 4 && y < 11);
      const isGarden = (x === 4 && y === 10) || (x === 10 && y === 4) || (x === 3 && y === 6);
      let fill = (x + y) % 2 === 0 ? COLORS.grassA : COLORS.grassB;
      let stroke = 0x5dbb65;
      if (isEdge) {
        fill = COLORS.forest;
        stroke = 0x3e965e;
      } else if (isPath) {
        fill = COLORS.path;
        stroke = COLORS.pathEdge;
      } else if (isGarden) {
        fill = COLORS.garden;
        stroke = 0xdf729f;
      }
      drawDiamond(scene, center.x, center.y, TILE_W, TILE_H, fill, stroke, 0.96);
    }
  }
}

export function createPathStones(scene) {
  const stones = scene.add.graphics();
  stones.fillStyle(0xe6d3a6, 0.55);
  if (scene.generatedLevelActive && scene.generatedLevel) {
    scene.generatedLevel.roadGrid.forEach((row, y) => {
      row.forEach((isRoad, x) => {
        if (!isRoad || (x + y) % 2 !== 0) {
          return;
        }
        const p = scene.isoToScreen(x + 0.12 * Math.sin(y * 1.7), y + 0.14 * Math.cos(x * 1.3));
        stones.fillEllipse(p.x, p.y, 8 + ((x + y) % 3) * 2, 4.5, 1);
      });
    });
    stones.setAlpha(0.38);
    if (scene.generatedTerrainMask) {
      stones.setMask(scene.generatedTerrainMask);
    }
    scene.worldLayer.add(stones);
    return;
  }
  for (let y = 3; y < 12; y += 1) {
    for (let x = 6; x <= 8; x += 1) {
      const p = scene.isoToScreen(x + 0.12 * Math.sin(y), y + 0.18 * Math.cos(x));
      stones.fillEllipse(p.x, p.y, 10 + ((x + y) % 3) * 3, 5, 1);
    }
  }
  for (let x = 3; x < 12; x += 1) {
    for (let y = 6; y <= 8; y += 1) {
      const p = scene.isoToScreen(x + 0.15 * Math.cos(y), y + 0.1 * Math.sin(x));
      stones.fillEllipse(p.x, p.y, 9 + ((x * y) % 3) * 2, 5, 1);
    }
  }
  stones.setAlpha(0.42);
  scene.worldLayer.add(stones);
}

export function createForestBorder(scene) {
  const treeSpots = [
    [0.5, 1.2, 1.0], [2.2, 0.6, 0.8], [4.5, 0.7, 0.95], [7.3, 0.4, 1.1], [10.2, 0.7, 0.9], [13.4, 1.0, 1.0],
    [0.4, 4.4, 0.8], [0.8, 9.7, 0.95], [2.0, 13.4, 1.0], [5.4, 14.0, 0.85], [9.2, 13.5, 1.08], [13.0, 12.3, 0.9],
    [14.1, 4.0, 1.0], [13.7, 7.4, 0.85], [14.2, 10.5, 0.95],
  ];
  treeSpots.forEach(([x, y, scale], index) => {
    const p = scene.isoToScreen(x, y, 16);
    addFireflyCluster(scene, p.x, p.y - 34 * scale, index);
  });
}

export function addFireflyCluster(scene, x, y, seed) {
  for (let i = 0; i < 3; i += 1) {
    const dot = scene.add.circle(x + Math.cos(seed + i) * 18, y + Math.sin(seed * 2 + i) * 12, 2.8, 0xfff7a6, 0.85);
    dot.setDepth(y + 30 + i);
    scene.tweens.add({
      targets: dot,
      x: dot.x + Math.sin(seed + i) * 12,
      y: dot.y - 8 - i * 3,
      alpha: 0.35,
      yoyo: true,
      repeat: -1,
      duration: 1500 + i * 230,
      ease: 'Sine.inOut',
    });
    scene.entityLayer.add(dot);
  }
}

export function createBuildings(scene) {
  const buildingData = [
    { name: 'Castle', x: 7, y: 4, hp: 110, max: 110, importance: 100, texture: 'castleTexture', size: [112, 96], reward: 24, footprint: { w: 3, h: 3 } },
    { name: 'Bakery', x: 4, y: 7, hp: 76, max: 76, importance: 50, texture: 'bakeryTexture', size: [80, 70], reward: 16, footprint: { w: 3, h: 2 } },
    { name: 'Cottage', x: 10, y: 7, hp: 74, max: 74, importance: 50, texture: 'cottageTexture', size: [78, 68], reward: 15, footprint: { w: 3, h: 2 } },
    { name: 'Market', x: 7, y: 10, hp: 68, max: 68, importance: 70, texture: 'marketTexture', size: [90, 66], reward: 18, footprint: { w: 3, h: 2 } },
  ];
  scene.buildings = buildingData.map((data) => {
    const p = scene.isoToScreen(data.x, data.y, 18);
    const base = scene.add.graphics();
    base.fillStyle(0x8f7346, STATIC_BUILDING_BASE_ALPHA);
    base.fillEllipse(p.x, p.y + 22, data.size[0] * 0.62, 28);
    const sprite = scene.add.image(p.x, p.y, data.texture)
      .setOrigin(0.5, 0.84)
      .setDisplaySize(data.size[0], data.size[1])
      .setDepth(p.y)
      .setAlpha(STATIC_BUILDING_SPRITE_ALPHA);
    const healthBar = scene.createBuildingHealthBar(
      p.x,
      p.y - data.size[1] * 0.78,
      Math.max(42, Math.min(76, data.size[0] * 0.7)),
      10,
      p.y + 140,
    );
    const footprintCells = scene.getFootprintCells(data.x, data.y, data.footprint);
    scene.entityLayer.add([base, sprite, healthBar.container]);
    const building = {
      ...data,
      iso: { x: data.x, y: data.y },
      footprintCells,
      baseAlpha: STATIC_BUILDING_BASE_ALPHA,
      spriteAlpha: STATIC_BUILDING_SPRITE_ALPHA,
      sprite,
      base,
      healthBar,
      underAttackUntil: 0,
    };
    scene.updateBuildingHealthBar(building);
    return building;
  });
}

export function createProps(scene) {
  const props: Array<[string, number, number, number, number]> = [
    ['wellTexture', 6.1, 8.8, 44, 52], ['lampTexture', 8.8, 5.8, 26, 54], ['signTexture', 3.7, 9.7, 38, 46],
    ['lampTexture', 10.8, 4.8, 26, 54], ['wellTexture', 12.1, 9.3, 42, 46], ['signTexture', 2.9, 3.2, 38, 46],
  ];
  props.forEach(([texture, x, y, w, h]) => {
    const p = scene.isoToScreen(x, y, 7);
    const sprite = scene.add.image(p.x, p.y, texture)
      .setOrigin(0.5, 0.82)
      .setDisplaySize(w, h)
      .setDepth(p.y + 8)
      .setAlpha(0.7);
    scene.entityLayer.add(sprite);
  });
}

export function renderGeneratedBuilding(scene, placement) {
  const render = placement.render ?? {};
  const textureKey = render.textureKey ?? 'cottageTexture';
  const layout = scene.getGeneratedFootprintSpriteLayout(
    placement,
    { ...render, textureKey },
    [80, 70],
  );
  const size = layout.size;
  const sprite = scene.add.image(layout.x, layout.y, textureKey, render.frameKey)
    .setOrigin(0.5, 1)
    .setDisplaySize(size[0], size[1])
    .setDepth(layout.depth)
    .setAlpha(GENERATED_BUILDING_SPRITE_ALPHA);
  const healthBar = scene.createBuildingHealthBar(
    layout.x,
    layout.y - size[1] * 0.78,
    Math.max(42, Math.min(76, size[0] * 0.7)),
    10,
    layout.depth + 140,
  );
  scene.entityLayer.add([sprite, healthBar.container]);
  const building = {
    name: placement.label,
    x: placement.iso.x,
    y: placement.iso.y,
    hp: placement.maxHealth,
    max: placement.maxHealth,
    importance: placement.importance,
    levelPlacementId: placement.id,
    texture: render.textureKey,
    size,
    reward: Math.round(placement.importance / 4),
    iso: { x: placement.iso.x, y: placement.iso.y },
    footprint: placement.footprint,
    footprintCells: placement.cells.map((cell) => ({ ...cell })),
    spriteAlpha: GENERATED_BUILDING_SPRITE_ALPHA,
    sprite,
    healthBar,
    underAttackUntil: 0,
  };
  scene.buildings.push(building);
  scene.updateBuildingHealthBar(building);
}

export function renderGeneratedProp(scene, placement) {
  if (scene.generatedLevelActive && scene.generatedLevel && placement.token === 'tree' && scene.isGeneratedBoardEdgeCell(placement.grid)) {
    return;
  }
  const render = placement.render ?? {};
  const override = scene.getSceneVariantPropTexture(placement);
  const textureKey = override?.textureKey ?? render?.textureKey;
  const frameKey = override?.frameKey ?? render?.frameKey;
  if (!textureKey) {
    return;
  }
  const layout = textureKey === 'buildingsAtlas'
    ? scene.getGeneratedFootprintSpriteLayout(placement, { ...render, textureKey, frameKey }, [42, 42])
    : null;
  const p = layout ?? scene.isoToScreen(placement.iso.x, placement.iso.y, render.z ?? 7);
  const size = layout?.size ?? scene.scaleGeneratedSize(render.displaySize ?? [42, 42]);
  const sprite = scene.add.image(p.x, p.y, textureKey, frameKey)
    .setOrigin(layout ? 0.5 : render.origin?.[0] ?? 0.5, layout ? 1 : render.origin?.[1] ?? 0.82)
    .setDisplaySize(size[0], size[1])
    .setDepth((layout?.depth ?? p.y) + 8)
    .setAlpha(render.alpha ?? 0.72);
  scene.entityLayer.add(sprite);
}

export function renderGeneratedDecoration(scene, placement) {
  const override = scene.getSceneVariantDecorationTexture(placement);
  if (placement.render?.textureKey || override?.textureKey) {
    const render = placement.render;
    const p = scene.isoToScreen(placement.iso.x, placement.iso.y, render.z ?? 8);
    const size = scene.scaleGeneratedSize(render.displaySize ?? [36, 36]);
    const sprite = scene.add.image(
      p.x,
      p.y,
      override?.textureKey ?? render.textureKey,
      override?.frameKey ?? render.frameKey,
    )
      .setOrigin(render.origin?.[0] ?? 0.5, render.origin?.[1] ?? 0.82)
      .setDisplaySize(size[0], size[1])
      .setDepth(p.y + 6)
      .setAlpha(render.alpha ?? 0.76);
    scene.entityLayer.add(sprite);
    return;
  }
  const p = scene.isoToScreen(placement.iso.x + 0.16, placement.iso.y - 0.12, 8);
  const flowers = scene.add.graphics();
  if (placement.decorationKind === 'sparkles') {
    flowers.fillStyle(0xfff3a6, 0.72);
    flowers.fillCircle(p.x - 4, p.y, 2.2);
    flowers.fillStyle(0x91e8ff, 0.62);
    flowers.fillCircle(p.x + 5, p.y - 5, 2.4);
    flowers.lineStyle(1, 0xffffff, 0.45);
    flowers.lineBetween(p.x - 8, p.y - 2, p.x + 7, p.y + 3);
  } else {
    flowers.fillStyle(0xffa8d6, 0.72);
    flowers.fillCircle(p.x - 6, p.y, 3);
    flowers.fillStyle(0xfff49a, 0.75);
    flowers.fillCircle(p.x, p.y - 3, 3);
    flowers.fillStyle(0x8fe287, 0.68);
    flowers.fillCircle(p.x + 6, p.y + 2, 3);
  }
  flowers.setDepth(p.y + 5);
  scene.entityLayer.add(flowers);
}
