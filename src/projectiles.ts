import * as Phaser from 'phaser';
import type { SceneAPI } from './sceneAPI';

interface CombatProjectile {
  owner: 'player' | 'enemy';
  type: 'arrow' | 'bolt' | 'spit' | 'guardian';
  iso: { x: number; y: number };
  velocity: { x: number; y: number };
  power: number;
  range: number;
  distance: number;
  sprite: Phaser.GameObjects.GameObject & {
    setPosition: (x: number, y: number) => unknown;
    destroy: () => void;
  };
  targetBuilding?: any;
}

export function addProjectile(scene: SceneAPI, projectile: CombatProjectile) {
  scene.projectiles.push(projectile);
}

export function fireEnemyProjectile(scene: SceneAPI, enemy: any, targetBuilding: any, power: number, type: 'spit' | 'guardian') {
  const from = enemy.iso;
  const target = targetBuilding.iso;
  const distance = Math.max(0.01, Math.hypot(target.x - from.x, target.y - from.y));
  const speed = type === 'guardian' ? 4.4 : 3.6;
  const p = scene.isoToScreen(from.x, from.y, 30);
  const color = type === 'guardian' ? 0xf49b65 : 0x8eda7b;
  const sprite = scene.add.circle(p.x, p.y, type === 'guardian' ? 10 : 7, color, 0.95)
    .setStrokeStyle(2, 0xffffff, 0.72)
    .setDepth(p.y + 160);
  scene.fxLayer.add(sprite);
  addProjectile(scene, {
    owner: 'enemy',
    type,
    iso: { ...from },
    velocity: { x: ((target.x - from.x) / distance) * speed, y: ((target.y - from.y) / distance) * speed },
    power,
    range: distance + 1,
    distance: 0,
    sprite,
    targetBuilding,
  });
}

function isFrontalGuardBlock(scene: SceneAPI, projectile: CombatProjectile) {
  if (scene.heroClass !== 'warrior' || scene.time.now > scene.guardUntil) {
    return false;
  }
  const towardThreat = {
    x: projectile.iso.x - scene.player.iso.x,
    y: projectile.iso.y - scene.player.iso.y,
  };
  const length = Math.max(0.01, Math.hypot(towardThreat.x, towardThreat.y));
  const dot = (towardThreat.x / length) * scene.player.facing.x + (towardThreat.y / length) * scene.player.facing.y;
  return dot > 0.25;
}

export function updateProjectiles(scene: SceneAPI, dt: number) {
  scene.projectiles.slice().forEach((projectile: CombatProjectile) => {
    projectile.iso.x += projectile.velocity.x * dt;
    projectile.iso.y += projectile.velocity.y * dt;
    projectile.distance += Math.hypot(projectile.velocity.x * dt, projectile.velocity.y * dt);
    const p = scene.isoToScreen(projectile.iso.x, projectile.iso.y, 24);
    projectile.sprite.setPosition(p.x, p.y - 8);
    if (projectile.owner === 'player') {
      const target = scene.enemies.find((enemy: any) => !enemy.defeated && Phaser.Math.Distance.Between(
        projectile.iso.x, projectile.iso.y, enemy.iso.x, enemy.iso.y,
      ) < 0.54);
      if (target) {
        scene.damageEnemy(target, projectile.power, projectile.type);
        destroyProjectile(scene, projectile);
      } else if (projectile.distance > projectile.range) {
        destroyProjectile(scene, projectile);
      }
      return;
    }
    const playerDistance = Phaser.Math.Distance.Between(projectile.iso.x, projectile.iso.y, scene.player.iso.x, scene.player.iso.y);
    if (playerDistance < 0.62 && isFrontalGuardBlock(scene, projectile)) {
      if (scene.state.level >= 9) {
        projectile.owner = 'player';
        projectile.velocity.x *= -1;
        projectile.velocity.y *= -1;
        projectile.distance = 0;
        projectile.range = 8;
        projectile.power = projectile.type === 'guardian' ? 5 : 2;
      } else {
        destroyProjectile(scene, projectile);
      }
      scene.spawnSparkleBurst(scene.player.sprite.x, scene.player.sprite.y - 24, 0xa8f3ff, 10, 0.7);
      return;
    }
    const building = projectile.targetBuilding;
    if (building && Phaser.Math.Distance.Between(projectile.iso.x, projectile.iso.y, building.iso.x, building.iso.y) < 0.68) {
      scene.damageProtectedBuilding(building, projectile.power);
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

export function awardGold(scene: SceneAPI, x: number, y: number, amount: number) {
  scene.state.gold += amount;
  const p = scene.isoToScreen(x, y, 20);
  const coin = scene.add.image(p.x, p.y - 22, 'coinTexture').setDisplaySize(30, 30).setDepth(p.y + 150);
  const label = scene.add.text(p.x + 20, p.y - 30, `+${amount}`, scene.uiTextStyle(15, '#805013')).setOrigin(0.5);
  scene.fxLayer.add([coin, label]);
  scene.tweens.add({
    targets: [coin, label],
    y: '-=30',
    alpha: 0,
    duration: 650,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      coin.destroy();
      label.destroy();
    },
  });
}
