import * as Phaser from 'phaser';
import { isTimeOfDay, TIME_OF_DAY_PROFILES } from './levels/timeOfDay';
import { WIDTH, HEIGHT } from './gameConfig';

export function getActiveTimeOfDay(scene) {
  if (scene.timeOfDayOverride) {
    return scene.timeOfDayOverride;
  }
  const paramValue = new URLSearchParams(window.location.search).get('timeOfDay');
  if (isTimeOfDay(paramValue)) {
    return paramValue;
  }
  return scene.generatedLevel?.config.timeOfDay ?? 'morning';
}

export function cycleTimeOfDay(scene) {
  const order = ['morning', 'noon', 'afternoon', 'night'];
  const current = getActiveTimeOfDay(scene);
  const next = order[(order.indexOf(current) + 1) % order.length];
  scene.timeOfDayOverride = next;
  createTimeOfDayLayer(scene);
  scene.addGuildNote(`Time preview: ${next}.`);
  scene.updateDebugOverlay();
}

export function getLampGlowIsoPoints(scene) {
  if (scene.generatedLevelActive && scene.generatedLevel) {
    return [
      ...scene.generatedLevel.objects
        .filter((placement) => placement.token === 'lamp')
        .map((placement) => placement.iso),
      ...scene.generatedLevel.decorations
        .filter((placement) => placement.decorationKind === 'magicPlant')
        .map((placement) => placement.iso),
    ];
  }
  return [
    { x: 8.8, y: 5.8 },
    { x: 10.8, y: 4.8 },
    { x: 3.7, y: 9.7 },
  ];
}

export function createTimeOfDayLayer(scene) {
  scene.timeOfDayOverlay?.destroy();
  scene.timeOfDayMist?.destroy();
  scene.lampGlowGraphics?.destroy();
  scene.timeOfDayOverlay = null;
  scene.timeOfDayMist = null;
  scene.lampGlowGraphics = null;
  if (scene.generatedLevelActive && scene.sceneVariant) {
    return;
  }
  const profile = TIME_OF_DAY_PROFILES[getActiveTimeOfDay(scene)];
  const layerItems = [];

  if (profile.overlayAlpha > 0) {
    scene.timeOfDayOverlay = scene.add.rectangle(
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH,
      HEIGHT,
      profile.overlayColor,
      profile.overlayAlpha,
    ).setScrollFactor(0);
    layerItems.push(scene.timeOfDayOverlay);
  }

  if (profile.mistAlpha > 0) {
    const mist = scene.add.graphics();
    mist.fillStyle(0xffffff, profile.mistAlpha);
    [
      [190, 184, 210, 34],
      [612, 156, 260, 42],
      [1050, 196, 220, 36],
    ].forEach(([x, y, w, h]) => mist.fillEllipse(x, y, w, h));
    scene.timeOfDayMist = mist;
    layerItems.push(mist);
  }

  if (profile.glowAlpha > 0) {
    const glow = scene.add.graphics();
    glow.setBlendMode(Phaser.BlendModes.ADD);
    getLampGlowIsoPoints(scene).forEach((iso) => {
      const p = scene.isoToScreen(iso.x, iso.y, 20);
      glow.fillStyle(profile.glowColor, profile.glowAlpha);
      glow.fillCircle(p.x, p.y, 34);
      glow.fillStyle(profile.glowColor, profile.glowAlpha * 0.42);
      glow.fillCircle(p.x, p.y, 58);
    });
    scene.lampGlowGraphics = glow;
    layerItems.push(glow);
  }

  if (layerItems.length > 0) {
    scene.lightingLayer.add(layerItems);
  }
}
