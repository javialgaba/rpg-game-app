import * as Phaser from 'phaser';
import type { SceneAPI } from './sceneAPI';

export function updateProjectiles(scene: SceneAPI, dt: number) {
  scene.projectiles.slice().forEach((projectile: any) => {
    projectile.iso.x += projectile.velocity.x * dt;
    projectile.iso.y += projectile.velocity.y * dt;
    projectile.distance += Math.hypot(projectile.velocity.x * dt, projectile.velocity.y * dt);
    const p = scene.isoToScreen(projectile.iso.x, projectile.iso.y, 24);
    projectile.sprite.setPosition(p.x, p.y - 8);
    const target = scene.enemies.find((enemy: any) => Phaser.Math.Distance.Between(
      projectile.iso.x,
      projectile.iso.y,
      enemy.iso.x,
      enemy.iso.y,
    ) < 0.54);
    if (target) {
      scene.damageEnemy(target, projectile.power, 'arrow');
      destroyProjectile(scene, projectile);
    } else if (projectile.distance > projectile.range) {
      destroyProjectile(scene, projectile);
    }
  });
}

export function destroyProjectile(scene: SceneAPI, projectile: any) {
  scene.projectiles = scene.projectiles.filter((candidate: any) => candidate !== projectile);
  scene.tweens.add({
    targets: projectile.sprite,
    alpha: 0,
    scale: 0.45,
    duration: 150,
    onComplete: () => projectile.sprite.destroy(),
  });
}

export function clearProjectiles(scene: SceneAPI) {
  scene.projectiles.splice(0).forEach((projectile: any) => projectile.sprite.destroy());
}

export function dropReward(scene: SceneAPI, x: number, y: number, enemy: any = null) {
  const roll = Phaser.Math.Between(0, 100);
  const type = roll < 58 ? 'gold' : roll < 76 ? 'mana' : roll < 90 ? 'heart' : 'xp';
  const texture = type === 'gold' ? 'coinTexture' : type === 'heart' ? 'heartTexture' : type === 'mana' ? 'manaTexture' : 'xpTexture';
  const p = scene.isoToScreen(x, y, 12);
  const sprite = scene.add.image(p.x, p.y - 16, texture)
    .setOrigin(0.5)
    .setDisplaySize(32, 32)
    .setDepth(p.y + 120);
  const goldRange = enemy?.rewardGold || [6, 15];
  const value = type === 'gold'
    ? Phaser.Math.Between(goldRange[0], goldRange[1])
    : type === 'xp'
      ? Math.max(12, Math.round((enemy?.rewardXp || 20) * 0.8))
      : 1;
  scene.pickups.push({ type, iso: { x, y }, sprite, age: 0, value });
  scene.fxLayer.add(sprite);
}

export function updatePickups(scene: SceneAPI, dt: number) {
  scene.pickups.slice().forEach((pickup: any) => {
    pickup.age += dt;
    const p = scene.isoToScreen(pickup.iso.x, pickup.iso.y, 22 + Math.sin(pickup.age * 5) * 5);
    pickup.sprite.setPosition(p.x, p.y - 18);
    pickup.sprite.rotation += dt * 1.4;
    const close = Phaser.Math.Distance.Between(pickup.iso.x, pickup.iso.y, scene.player.iso.x, scene.player.iso.y) < 1.05;
    if (close || pickup.age > 8) {
      collectPickup(scene, pickup);
    }
  });
}

export function collectPickup(scene: SceneAPI, pickup: any) {
  scene.pickups = scene.pickups.filter((candidate: any) => candidate !== pickup);
  if (pickup.type === 'gold') {
    scene.state.gold += pickup.value;
    if (Phaser.Math.Between(0, 4) === 0) {scene.addGuildNote(`You found ${pickup.value} gold!`);}
  } else if (pickup.type === 'heart') {
    scene.state.health = Math.min(scene.playerStats.maxHealth, scene.state.health + 1);
  } else if (pickup.type === 'mana') {
    scene.state.mana = Math.min(scene.playerStats.maxMana, scene.state.mana + 22);
  } else {
    scene.gainXp(pickup.value);
  }
  scene.playTone('sparkle');
  scene.tweens.add({
    targets: pickup.sprite,
    y: pickup.sprite.y - 32,
    alpha: 0,
    scale: 1.4,
    duration: 280,
    onComplete: () => pickup.sprite.destroy(),
  });
}
