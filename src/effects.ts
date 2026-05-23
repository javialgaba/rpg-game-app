import * as Phaser from 'phaser';
import type { SceneAPI } from './sceneAPI';

export function spawnSparkleBurst(scene: SceneAPI, x: number, y: number, color = 0xfff1a7, count = 10, scale = 1) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.2, 0.2);
    const radius = Phaser.Math.FloatBetween(15, 44) * scale;
    const particle = scene.add.circle(x, y, Phaser.Math.FloatBetween(2.4, 5.2) * scale, color, 0.9);
    particle.setDepth(y + 260 + i);
    scene.fxLayer.add(particle);
    scene.tweens.add({
      targets: particle,
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius - Phaser.Math.Between(8, 24),
      alpha: 0,
      scale: 0.2,
      duration: Phaser.Math.Between(360, 720),
      ease: 'Cubic.easeOut',
      onComplete: () => particle.destroy(),
    });
  }
}

export function spawnSpellBloom(scene: SceneAPI, x: number, y: number, scale = 1) {
  const ring = scene.add.circle(x, y, 18, 0x9eefff, 0.16).setStrokeStyle(3, 0xd9fbff, 0.85);
  const burst = scene.add.image(x, y, 'spellIconTexture')
    .setOrigin(0.5)
    .setDisplaySize(92 * scale, 92 * scale)
    .setAlpha(0.92)
    .setDepth(y + 300);
  ring.setDepth(y + 299);
  scene.fxLayer.add([ring, burst]);
  spawnSparkleBurst(scene, x, y, 0xa5efff, 18, scale);
  scene.tweens.add({
    targets: [ring, burst],
    scale: 2.8 * scale,
    alpha: 0,
    rotation: Math.PI,
    duration: 620,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      ring.destroy();
      burst.destroy();
    },
  });
}

export function spawnShieldGlow(scene: SceneAPI) {
  const glow = scene.add.circle(scene.player.sprite.x, scene.player.sprite.y - 24, 34, 0x8ef6c0, 0.16)
    .setStrokeStyle(3, 0xd7ffe5, 0.8)
    .setDepth(scene.player.sprite.depth + 20);
  scene.fxLayer.add(glow);
  scene.tweens.add({
    targets: glow,
    scale: 1.8,
    alpha: 0,
    duration: 900,
    ease: 'Cubic.easeOut',
    onUpdate: () => glow.setPosition(scene.player.sprite.x, scene.player.sprite.y - 24),
    onComplete: () => glow.destroy(),
  });
}

export function spawnRepairToolEffect(scene: SceneAPI, building: any, amount: number) {
  const toolX = (scene.player.sprite.x + building.sprite.x) / 2;
  const toolY = (scene.player.sprite.y + building.sprite.y) / 2 - 24;
  const tool = scene.add.image(toolX, toolY, 'repairTool')
    .setOrigin(0.5)
    .setDisplaySize(56, 56)
    .setDepth(building.sprite.depth + 260)
    .setAngle(-12);
  const plus = scene.add.text(toolX + 34, toolY - 26, `+${amount}`, {
    ...scene.uiTextStyle(15, '#28784a'),
    strokeThickness: 3,
  }).setOrigin(0.5);
  scene.fxLayer.add([tool, plus]);
  scene.tweens.add({
    targets: tool,
    y: toolY - 20,
    angle: 18,
    scale: 1.18,
    alpha: 0,
    duration: 620,
    ease: 'Back.easeOut',
    onComplete: () => tool.destroy(),
  });
  scene.tweens.add({
    targets: plus,
    y: toolY - 52,
    alpha: 0,
    duration: 680,
    ease: 'Cubic.easeOut',
    onComplete: () => plus.destroy(),
  });
}

export function updateEffects(scene: SceneAPI, dt: number) {
  scene.effects = scene.effects.filter((effect: any) => {
    effect.life -= dt;
    if (effect.life <= 0) {
      effect.sprite.destroy();
      return false;
    }
    return true;
  });
}
