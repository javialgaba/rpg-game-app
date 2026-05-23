import * as Phaser from 'phaser';
import type { SceneAPI } from './sceneAPI';
import { spawnSparkleBurst } from './effects';
import { spawnSpellBloom } from './effects';
import { dropReward } from './projectiles';
import { spawnChest } from './chests';

export function swingSword(scene: SceneAPI, time: number) {
  if (time - scene.player.lastAttack < 430) {return;}
  scene.ensureAudio();
  scene.player.lastAttack = time;
  scene.player.actionLockUntil = time + 300;
  scene.setRepairMode(false, false);
  scene.state.equipped = 'Wooden Sword';
  scene.player.sprite.play(`${scene.player.animPrefix}-melee`, true);
  scene.playTone('sparkle');
  const reach = 1.48;
  const center = {
    x: scene.player.iso.x + scene.player.facing.x * 0.85,
    y: scene.player.iso.y + scene.player.facing.y * 0.85,
  };
  const screen = scene.isoToScreen(center.x, center.y, 20);
  spawnSparkleBurst(scene, screen.x, screen.y, 0xfff0a2, 9, 0.75);
  scene.enemies.forEach((enemy: any) => {
    const dist = Phaser.Math.Distance.Between(center.x, center.y, enemy.iso.x, enemy.iso.y);
    if (dist <= reach) {
      damageEnemy(scene, enemy, scene.playerStats.swordPower, 'bonk');
      enemy.iso.x += scene.player.facing.x * 0.24;
      enemy.iso.y += scene.player.facing.y * 0.24;
    }
  });
}

export function fireBow(scene: SceneAPI, time: number, targetIso: { x: number; y: number }) {
  if (time - scene.player.lastBow < scene.playerStats.bowCooldown) {return;}
  scene.ensureAudio();
  scene.player.lastBow = time;
  scene.player.actionLockUntil = time + 260;
  scene.setRepairMode(false, false);
  scene.state.equipped = 'Guild Bow';
  scene.player.sprite.play(`${scene.player.animPrefix}-special`, true);
  scene.playTone('bow');
  const startIso = { x: scene.player.iso.x, y: scene.player.iso.y };
  const target = targetIso;
  let vx = target.x - startIso.x;
  let vy = target.y - startIso.y;
  const len = Math.max(0.01, Math.hypot(vx, vy));
  vx /= len;
  vy /= len;
  scene.player.facing = { x: vx, y: vy };
  const p = scene.isoToScreen(startIso.x, startIso.y, 18);
  const evolvedBow = Boolean(scene.playerStats.bowEvolved);
  const arrow = scene.add.container(p.x, p.y - 24).setDepth(p.y + 120);
  const shaft = scene.add.rectangle(0, 0, evolvedBow ? 38 : 32, evolvedBow ? 6 : 5, evolvedBow ? 0xfff0a4 : 0xffe6a3, 1)
    .setStrokeStyle(1, evolvedBow ? 0x4ca6c9 : 0x9d6d3f, 1);
  const tip = scene.add.triangle(evolvedBow ? 21 : 18, 0, 0, -6, 0, 6, 10, 0, evolvedBow ? 0xffdf75 : 0x82d5ff, 1);
  arrow.add([shaft, tip]);
  const screenDir = scene.isoToScreen(startIso.x + vx, startIso.y + vy, 18);
  arrow.rotation = Phaser.Math.Angle.Between(p.x, p.y, screenDir.x, screenDir.y);
  scene.projectiles.push({
    type: 'arrow',
    iso: { x: startIso.x + vx * 0.45, y: startIso.y + vy * 0.45 },
    velocity: { x: vx * (evolvedBow ? 9.2 : 8.2), y: vy * (evolvedBow ? 9.2 : 8.2) },
    power: scene.playerStats.bowPower,
    range: 6.8 + scene.state.level * 0.35 + (evolvedBow ? 1.2 : 0),
    distance: 0,
    sprite: arrow,
  });
  scene.fxLayer.add(arrow);
}

export function castSpell(scene: SceneAPI, time: number, targetIso: { x: number; y: number }) {
  if (time - scene.player.lastSpell < 780 || scene.state.mana < scene.playerStats.spellCost) {
    if (scene.state.mana < scene.playerStats.spellCost) {
      scene.addGuildNote('Mana is refilling with sparkles.');
    }
    return;
  }
  scene.ensureAudio();
  scene.player.lastSpell = time;
  scene.state.mana -= scene.playerStats.spellCost;
  scene.player.actionLockUntil = time + 430;
  scene.setRepairMode(false, false);
  scene.state.equipped = 'Sparkle Spell';
  scene.player.sprite.play(`${scene.player.animPrefix}-special`, true);
  scene.playTone('level');
  const center = {
    x: Phaser.Math.Clamp(targetIso.x, scene.player.iso.x - 4.2, scene.player.iso.x + 4.2),
    y: Phaser.Math.Clamp(targetIso.y, scene.player.iso.y - 4.2, scene.player.iso.y + 4.2),
  };
  const p = scene.isoToScreen(center.x, center.y, 16);
  spawnSpellBloom(scene, p.x, p.y - 8, 1 + scene.playerStats.spellPower * 0.08);
  scene.enemies.forEach((enemy: any) => {
    const dist = Phaser.Math.Distance.Between(center.x, center.y, enemy.iso.x, enemy.iso.y);
    if (dist < 2.05) {
      damageEnemy(scene, enemy, scene.playerStats.spellPower, 'sparkles');
      enemy.dazedUntil = time + 750;
    }
  });
}

export function damageEnemy(scene: SceneAPI, enemy: any, amount: number, reason: string) {
  if (!scene.enemies.includes(enemy) || enemy.defeated) {return;}
  enemy.hp -= amount;
  enemy.dazedUntil = Math.max(enemy.dazedUntil, scene.time.now + 240);
  enemy.sprite.setTint(reason === 'sparkles' ? 0xbdf6ff : 0xfff3a0);
  scene.time.delayedCall(120, () => {
    if (!enemy.sprite?.active || enemy.defeated) {return;}
    if (enemy.variantTint) {enemy.sprite.setTint(enemy.variantTint);}
    else {enemy.sprite.clearTint();}
  });
  spawnSparkleBurst(scene, enemy.sprite.x, enemy.sprite.y - 18, reason === 'sparkles' ? 0x9be7ff : 0xffed95, 7, 0.56);
  scene.playTone('hit');
  if (enemy.hp <= 0) {
    enemy.defeated = true;
    if (!enemy.countedDefeat) {
      enemy.countedDefeat = true;
      scene.levelDefeatsThisRound += 1;
    }
    scene.levelEnemiesRemaining = Math.max(0, scene.levelRequiredDefeats - scene.levelDefeatsThisRound);
    enemy.retreating = true;
    enemy.sprite.setFrame(scene.getEnemyFrameKey(enemy, enemy.defeatFrame ?? 7));
    enemy.sprite.setTint(0xffffff);
    enemy.speed += 0.55;
    scene.gainXp(enemy.rewardXp);
    dropReward(scene, enemy.iso.x, enemy.iso.y, enemy);
    maybeSpawnChestDrop(scene, enemy);
    scene.playTone('daze');
    if (enemy.isBoss) {
      scene.addGuildNote(scene.getCurrentWorldTheme().bossDefeat);
    } else {
      scene.addGuildNote(Phaser.Math.RND.pick([
        'A forest critter scampered home dazed.',
        'Sparkles solved that little mix-up.',
        'The village cheers your gentle defense!',
      ]));
    }
    scene.checkLevelClear();
  }
}

function maybeSpawnChestDrop(scene: SceneAPI, enemy: any) {
  const baseChance = enemy.isBoss ? 0.78 : enemy.variant?.key === 'elder' ? 0.34 : enemy.variant?.key === 'bright' ? 0.22 : 0.12;
  if (Phaser.Math.FloatBetween(0, 1) >= baseChance) {
    return;
  }
  const chestIso = {
    x: enemy.iso.x + Phaser.Math.FloatBetween(-0.22, 0.22),
    y: enemy.iso.y + Phaser.Math.FloatBetween(-0.22, 0.22),
  };
  spawnChest(scene, chestIso.x, chestIso.y, 'bonus-upgrade', { source: 'enemyDrop', lifetimeMs: 5000 });
  scene.addGuildNote(enemy.isBoss ? 'A guardian chest lands beside the battle!' : 'A chest tumbles free from the skirmish!');
}

export function removeEnemy(scene: SceneAPI, enemy: any, animate = true) {
  scene.enemies = scene.enemies.filter((candidate: any) => candidate !== enemy);
  if (animate) {
    scene.tweens.add({
      targets: [enemy.sprite, enemy.shadow],
      alpha: 0,
      scale: 0.4,
      duration: 420,
      ease: 'Back.easeIn',
      onComplete: () => {
        enemy.sprite.destroy();
        enemy.shadow.destroy();
      },
    });
  } else {
    enemy.sprite.destroy();
    enemy.shadow.destroy();
  }
}
