import * as Phaser from 'phaser';
import type { SceneAPI } from './sceneAPI';
import type { DroppedChest } from './gameTypes';

export function spawnChest(
  scene: SceneAPI,
  x: number,
  y: number,
  reward = 'bonus-upgrade',
  options: { source?: 'enemyDrop'; lifetimeMs?: number } = {},
) {
  const p = scene.isoToScreen(x, y, 10);
  const chestTexture = scene.generatedLevelActive ? 'worldTilesAtlas' : 'chestTexture';
  const chestFrame = scene.generatedLevelActive ? 'chest_closed_01' : undefined;
  const chestSize = scene.generatedLevelActive ? scene.scaleGeneratedSize([101, 103]) : [58, 58];
  const sprite = scene.add.image(p.x, p.y, chestTexture, chestFrame)
    .setOrigin(0.5, 0.78)
    .setDisplaySize(chestSize[0], chestSize[1])
    .setDepth(p.y + 60);
  const glow = scene.add.circle(p.x, p.y - 22, 19 * (chestSize[0] / 58), 0xfff2a4, 0.14).setDepth(p.y + 50);
  scene.tweens.add({
    targets: glow,
    scale: 1.35,
    alpha: 0.34,
    yoyo: true,
    repeat: -1,
    duration: 1050,
    ease: 'Sine.inOut',
  });
  scene.entityLayer.add([glow, sprite]);
  const lifetimeMs = options.lifetimeMs ?? 5000;
  const spawnedAt = scene.time.now;
  scene.chests.push({
    iso: { x, y },
    sprite,
    glow,
    reward,
    opened: false,
    bob: Math.random() * 1000,
    source: 'enemyDrop',
    spawnedAt,
    despawnAt: spawnedAt + lifetimeMs,
    blinkAt: spawnedAt + Math.max(2500, lifetimeMs - 1800),
  } satisfies DroppedChest);
}

function doOpenChest(scene: SceneAPI, chest: DroppedChest) {
  if (!chest || chest.opened) {
    return;
  }
  chest.opened = true;
  scene.playTone('chest');
  chest.sprite.setTint(0xfff2a4);
  scene.tweens.add({
    targets: [chest.sprite, chest.glow],
    y: '-=22',
    alpha: 0,
    scale: 1.22,
    duration: 760,
    ease: 'Back.easeOut',
    onComplete: () => {
      chest.sprite.destroy();
      chest.glow.destroy();
    },
  });
  const p = scene.isoToScreen(chest.iso.x, chest.iso.y, 18);
  scene.spawnSparkleBurst(p.x, p.y - 22, 0xfff0a4, 20, 1.1);
  scene.chests = scene.chests.filter((candidate) => candidate !== chest);
  if (chest.reward === 'bonus-upgrade') {
    pauseRoundForChestBonus(scene);
    return;
  }
  grantChestReward(scene, chest.reward);
}

function grantChestReward(scene: SceneAPI, reward: string) {
  if (reward === 'mana') {
    scene.state.mana = scene.playerStats.maxMana;
    scene.addGuildNote('You found a blue mana orb!');
  } else if (reward === 'xp') {
    scene.gainXp(38);
    scene.addGuildNote('You found a swirl of XP stars!');
  } else if (reward === 'heart') {
    scene.state.health = Math.min(scene.playerStats.maxHealth, scene.state.health + 2);
    scene.addGuildNote('A heart charm patched you up.');
  } else if (reward === 'buff') {
    scene.playerStats.speed += 0.45;
    scene.time.delayedCall(8500, () => {
      scene.playerStats.speed -= 0.45;
      scene.addGuildNote('The quick-step sparkle faded.');
    });
    scene.addGuildNote('Temporary quick-step sparkle!');
  } else {
    const amount = Phaser.Math.Between(22, 42);
    scene.state.gold += amount;
    scene.addGuildNote(`You found ${amount} gold!`);
  }
}

function pauseRoundForChestBonus(scene: SceneAPI) {
  if (scene.state.phase !== 'playing') {
    return;
  }
  scene.upgradePauseContext = 'chestBonus';
  scene.state.phase = 'levelUp';
  scene.state.inventoryOpen = false;
  scene.setRepairMode(false, false);
  scene.inventoryPanel?.setVisible(false);
  scene.levelTimers.forEach((timer: any) => { timer.paused = true; });
  scene.showLevelUpScreen('chestBonus');
}

export function updateChests(scene: SceneAPI, time: number) {
  (scene.chests as DroppedChest[]).slice().forEach((chest) => {
    if (chest.opened) {return;}
    if (chest.despawnAt && time >= chest.despawnAt) {
      chest.opened = true;
      scene.tweens.add({
        targets: [chest.sprite, chest.glow],
        alpha: 0,
        scale: 0.55,
        duration: 180,
        onComplete: () => {
          chest.sprite.destroy();
          chest.glow.destroy();
        },
      });
      scene.chests = scene.chests.filter((candidate) => candidate !== chest);
      scene.checkLevelClear();
      return;
    }
    const p = scene.isoToScreen(chest.iso.x, chest.iso.y, 10 + Math.sin(time / 450 + chest.bob) * 2.5);
    chest.sprite.setPosition(p.x, p.y);
    chest.glow.setPosition(p.x, p.y - 20);
    if (chest.blinkAt && time >= chest.blinkAt) {
      const pulse = 0.45 + Math.abs(Math.sin(time / 65)) * 0.55;
      chest.sprite.setAlpha(pulse);
      chest.glow.setAlpha(0.12 + pulse * 0.24);
    } else {
      chest.sprite.setAlpha(1);
      chest.glow.setAlpha(0.18);
    }
    if (Phaser.Math.Distance.Between(chest.iso.x, chest.iso.y, scene.player.iso.x, scene.player.iso.y) < 0.95) {
      doOpenChest(scene, chest);
    }
  });
}

export function tryOpenChest(scene: SceneAPI) {
  if (scene.state.phase !== 'playing') {return;}
  const chest = scene.chests.find((candidate: DroppedChest) => !candidate.opened && Phaser.Math.Distance.Between(
    candidate.iso.x,
    candidate.iso.y,
    scene.player.iso.x,
    scene.player.iso.y,
  ) < 1.35);
  if (!chest) {
    scene.addGuildNote('No chest close enough yet.');
    return;
  }
  doOpenChest(scene, chest);
}

export function resumeRoundAfterChestBonus(scene: SceneAPI) {
  scene.upgradePauseContext = 'roundClear';
  scene.levelTimers.forEach((timer: any) => {
    if (timer && !timer.hasDispatched) {
      timer.paused = false;
    }
  });
  scene.state.phase = 'playing';
  scene.levelUpOverlay?.setVisible(false);
  scene.addGuildNote('The chest blessing settles in. Back to the defense!');
  scene.checkLevelClear();
}
