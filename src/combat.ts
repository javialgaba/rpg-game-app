import * as Phaser from 'phaser';
import type { SceneAPI } from './sceneAPI';
import { ARCHER_TRAP } from './gameConfig';
import { spawnSparkleBurst, spawnSpellBloom } from './effects';
import { addProjectile, awardGold, awardHeart } from './projectiles';
import { getSkillMilestoneConfig } from './progression';
import { getHeartDropHealAmount } from './rewardDrops';
import { getNearestCombatTarget } from './combatTargeting';

function startProjectile(
  scene: SceneAPI,
  type: 'arrow' | 'bolt',
  targetIso: { x: number; y: number },
  speed: number,
  splash = false,
) {
  const start = scene.player.iso;
  const length = Math.max(0.01, Math.hypot(targetIso.x - start.x, targetIso.y - start.y));
  const direction = { x: (targetIso.x - start.x) / length, y: (targetIso.y - start.y) / length };
  scene.player.facing = direction;
  const p = scene.isoToScreen(start.x, start.y, 18);
  const sprite = type === 'arrow'
    ? scene.add.image(p.x, p.y - 24, 'effectsAtlas', 'arrow_01').setDisplaySize(38, 38).setDepth(p.y + 120)
    : scene.add.circle(p.x, p.y - 24, 8, 0x9be7ff, 0.94).setStrokeStyle(2, 0xffffff, 0.72).setDepth(p.y + 120);
  scene.fxLayer.add(sprite);
  addProjectile(scene, {
    owner: 'player',
    type,
    iso: { x: start.x + direction.x * 0.4, y: start.y + direction.y * 0.4 },
    velocity: { x: direction.x * speed, y: direction.y * speed },
    power: scene.playerStats.attackDamage,
    range: scene.playerStats.attackRange,
    distance: 0,
    sprite,
    splash,
  } as any);
}

export function useMainAttack(scene: SceneAPI, time: number, targetIso: { x: number; y: number }) {
  if (time - scene.player.lastAttack < scene.playerStats.attackCooldown) {
    return;
  }
  scene.ensureAudio();
  scene.player.lastAttack = time;
  scene.player.actionLockUntil = time + 300;
  scene.state.equipped = scene.getHeroConfig().mainAttack;
  scene.player.sprite.play(`${scene.player.animPrefix}-melee`, true);
  if (scene.heroClass === 'archer') {
    scene.playTone('bow');
    const target = getNearestCombatTarget(scene.enemies, scene.player.iso, scene.playerStats.attackRange);
    startProjectile(scene, 'arrow', target?.iso ?? targetIso, 8.8);
    return;
  }
  if (scene.heroClass === 'sorcerer') {
    scene.playTone('level');
    const target = getNearestCombatTarget(scene.enemies, scene.player.iso, scene.playerStats.attackRange);
    startProjectile(scene, 'bolt', target?.iso ?? targetIso, 6.5, true);
    return;
  }
  scene.playTone('sparkle');
  const center = {
    x: scene.player.iso.x + scene.player.facing.x * 0.8,
    y: scene.player.iso.y + scene.player.facing.y * 0.8,
  };
  const screen = scene.isoToScreen(center.x, center.y, 20);
  spawnSparkleBurst(scene, screen.x, screen.y, 0xfff0a2, 9, 0.75);
  scene.enemies.forEach((enemy: any) => {
    if (enemy.entranceState === 'approaching') {
      return;
    }
    const distance = Phaser.Math.Distance.Between(center.x, center.y, enemy.iso.x, enemy.iso.y);
    const enemyVector = { x: enemy.iso.x - scene.player.iso.x, y: enemy.iso.y - scene.player.iso.y };
    const enemyLength = Math.max(0.01, Math.hypot(enemyVector.x, enemyVector.y));
    const facingDot = (enemyVector.x / enemyLength) * scene.player.facing.x + (enemyVector.y / enemyLength) * scene.player.facing.y;
    if (distance <= scene.playerStats.attackRange && facingDot > -0.1) {
      damageEnemy(scene, enemy, scene.playerStats.attackDamage, 'slash');
      enemy.iso.x += scene.player.facing.x * 0.24;
      enemy.iso.y += scene.player.facing.y * 0.24;
    }
  });
}

export function useClassSkill(scene: SceneAPI, time: number) {
  const level = scene.state.level;
  const config = scene.getSkillConfig();
  if (time - scene.player.lastSkill < config.cooldown) {
    return;
  }
  scene.ensureAudio();
  scene.player.lastSkill = time;
  scene.player.actionLockUntil = time + 380;
  scene.player.sprite.play(`${scene.player.animPrefix}-special`, true);
  if (scene.heroClass === 'warrior') {
    scene.guardUntil = time + config.duration;
    scene.enemies.forEach((enemy: any) => {
      if (enemy.entranceState === 'approaching') {
        return;
      }
      const distance = Phaser.Math.Distance.Between(enemy.iso.x, enemy.iso.y, scene.player.iso.x, scene.player.iso.y);
      if (distance < 1.35) {
        const dx = enemy.iso.x - scene.player.iso.x;
        const dy = enemy.iso.y - scene.player.iso.y;
        const length = Math.max(0.01, Math.hypot(dx, dy));
        enemy.iso.x += (dx / length) * config.pushback;
        enemy.iso.y += (dy / length) * config.pushback;
      }
    });
    scene.spawnShieldGlow();
    scene.addGuildNote(level >= 9 ? 'Shield Guard reflects frontal shots!' : 'Shield Guard raised!');
    return;
  }
  if (scene.heroClass === 'archer') {
    while (scene.traps.length >= config.maxActive) {
      scene.traps.shift()?.sprite.destroy();
    }
    const p = scene.isoToScreen(scene.player.iso.x, scene.player.iso.y, 4);
    const sprite = scene.add.image(p.x, p.y, 'effectsAtlas', 'trap_ground_01')
      .setDisplaySize(52, 52)
      .setAlpha(0.92)
      .setDepth(p.y + 8);
    scene.effectsLayer.add(sprite);
    scene.traps.push({ iso: { ...scene.player.iso }, expiresAt: time + ARCHER_TRAP.lifetime, sprite });
    scene.addGuildNote('A slowing trap is set.');
    return;
  }
  const building = scene.getNearestDamagedBuilding();
  const shield = {
    hp: building ? config.buildingAbsorb : config.heroAbsorb,
    expiresAt: time + config.duration,
    target: building ?? scene.player,
    isBuilding: Boolean(building),
  };
  scene.setMagicShield(shield);
  spawnSpellBloom(scene, scene.player.sprite.x, scene.player.sprite.y - 20, 0.7);
  scene.addGuildNote(building ? `${building.name} is shielded!` : 'Magic Shield surrounds you!');
}

export function updateClassEffects(scene: SceneAPI, time: number) {
  scene.traps = scene.traps.filter((trap: any) => {
    if (time >= trap.expiresAt) {
      trap.sprite.destroy();
      return false;
    }
    const victim = scene.enemies.find((enemy: any) => !enemy.defeated
      && enemy.entranceState !== 'approaching'
      && Phaser.Math.Distance.Between(trap.iso.x, trap.iso.y, enemy.iso.x, enemy.iso.y) <= scene.getSkillConfig().radius);
    if (!victim) {
      return true;
    }
    victim.slowedUntil = time + scene.getSkillConfig().slowDuration;
    const trapX = trap.sprite.x;
    const trapY = trap.sprite.y;
    trap.sprite.destroy();
    scene.spawnSparkleBurst(trapX, trapY, 0xa6dc75, 9, 0.6);
    return false;
  });
  scene.updateMagicShield(time);
}

export function damageEnemy(scene: SceneAPI, enemy: any, amount: number, reason: string) {
  if (!scene.enemies.includes(enemy) || enemy.defeated || enemy.entranceState === 'approaching') {
    return;
  }
  let remaining = amount;
  if (enemy.ward > 0) {
    const blocked = Math.min(enemy.ward, remaining);
    enemy.ward -= blocked;
    remaining -= blocked;
  }
  if (remaining <= 0) {
    return;
  }
  enemy.hp -= remaining;
  enemy.dazedUntil = Math.max(enemy.dazedUntil, scene.time.now + 240);
  enemy.sprite.setTint(reason === 'bolt' ? 0xbdf6ff : 0xfff3a0);
  scene.time.delayedCall(120, () => {
    if (!enemy.sprite?.active || enemy.defeated) {
      return;
    }
    if (enemy.variantTint) {
      enemy.sprite.setTint(enemy.variantTint);
    } else {
      enemy.sprite.clearTint();
    }
  });
  spawnSparkleBurst(scene, enemy.sprite.x, enemy.sprite.y - 18, reason === 'bolt' ? 0x9be7ff : 0xffed95, 7, 0.56);
  if (reason === 'bolt') {
    scene.enemies.forEach((splashTarget: any) => {
      if (splashTarget !== enemy && !splashTarget.defeated && splashTarget.entranceState !== 'approaching'
        && Phaser.Math.Distance.Between(enemy.iso.x, enemy.iso.y, splashTarget.iso.x, splashTarget.iso.y) <= 0.65) {
        damageEnemy(scene, splashTarget, 1, 'splash');
      }
    });
  }
  scene.playTone('hit');
  if (enemy.hp > 0) {
    return;
  }
  enemy.defeated = true;
  if (!enemy.countedDefeat) {
    enemy.countedDefeat = true;
    scene.levelDefeatsThisRound += 1;
    scene.runStats.enemiesDefeated += 1;
  }
  scene.levelEnemiesRemaining = Math.max(0, scene.levelRequiredDefeats - scene.levelDefeatsThisRound);
  enemy.retreating = true;
  enemy.sprite.setFrame(scene.getEnemyFrameKey(enemy, enemy.defeatFrame ?? 7));
  enemy.sprite.setTint(0xffffff);
  enemy.speed += 0.55;
  const amountGold = Phaser.Math.Between(enemy.rewardGold[0], enemy.rewardGold[1]);
  awardGold(scene, enemy.iso.x, enemy.iso.y, amountGold);
  scene.heartDropDefeatStreak = (scene.heartDropDefeatStreak ?? 0) + 1;
  const heartHeal = getHeartDropHealAmount({
    currentHealth: scene.state.health,
    maxHealth: scene.playerStats.maxHealth,
    defeatedSinceLastHeart: scene.heartDropDefeatStreak,
    enemyRole: enemy.archetype.key,
    isBoss: Boolean(enemy.isBoss),
    random: () => Phaser.Math.FloatBetween(0, 1),
  });
  const healed = heartHeal > 0 ? awardHeart(scene, enemy.iso.x, enemy.iso.y, heartHeal) : 0;
  if (healed > 0) {
    scene.heartDropDefeatStreak = 0;
  }
  scene.playTone('daze');
  const heartText = healed > 0 ? `, +${healed} heart` : '';
  scene.addGuildNote(enemy.isBoss ? scene.getCurrentWorldTheme().bossDefeat : `${enemy.archetype.label} retreats! +${amountGold} gold${heartText}`);
  scene.checkLevelClear();
}

export function removeEnemy(scene: SceneAPI, enemy: any, animate = true) {
  scene.enemies = scene.enemies.filter((candidate: any) => candidate !== enemy);
  if (!animate) {
    enemy.sprite.destroy();
    enemy.shadow.destroy();
    return;
  }
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
}

export function getClassSkillConfig(scene: SceneAPI) {
  return getSkillMilestoneConfig(scene.heroClass, scene.state.level);
}
