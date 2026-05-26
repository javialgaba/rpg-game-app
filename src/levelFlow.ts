import type { SceneAPI } from './sceneAPI';
import type { GameState } from './gameTypes';
import {
  LEVEL_FIRST_SPAWN_DELAY,
  LEVEL_SPAWN_INTERVAL_BASE,
  LEVEL_SPAWN_INTERVAL_STEP,
  LEVEL_SPAWN_INTERVAL_MIN,
  BOSS_ROUND_INDEX,
  WORLD_SEQUENCE,
  BOSS_CONFIGS,
  type EnemyRoleKey,
  type HeroClass,
} from './gameConfig';
import type { SeasonPreset } from './sceneVariants';
import { buildWaveRoster } from './progression';

// ---- Pure helper functions (testable without scene) ----

export interface RoundTitleResult {
  roundTitle: string;
  subTitle: string;
}

export interface WorldProgressionState {
  worldIndex: number;
  worldKey: string;
  worldRound: number;
  bossRound: boolean;
  worldCycle: number;
}

export function calculateSpawnCount(level: number, isBossRound: boolean, heroClass: HeroClass = 'warrior'): number {
  if (isBossRound) {
    return 1;
  }
  return buildWaveRoster(heroClass, level, () => 0).length;
}

export function calculateSpawnInterval(level: number): number {
  return Math.max(
    LEVEL_SPAWN_INTERVAL_MIN,
    LEVEL_SPAWN_INTERVAL_BASE - level * LEVEL_SPAWN_INTERVAL_STEP,
  );
}

export function getCurrentRoundTitle(level: number, bossRound: boolean, themeLabel: string, bossLabel: string): string {
  if (bossRound) {
    return bossLabel;
  }
  return `Level ${level}`;
}

export function getNextWorldProgressionState(
  worldIndex: number,
  worldRound: number,
  worldCycle: number,
): WorldProgressionState {
  if (worldRound < BOSS_ROUND_INDEX) {
    return {
      worldIndex,
      worldKey: WORLD_SEQUENCE[worldIndex],
      worldRound: worldRound + 1,
      bossRound: worldRound + 1 === BOSS_ROUND_INDEX,
      worldCycle,
    };
  }
  const nextIndex = (worldIndex + 1) % WORLD_SEQUENCE.length;
  const looped = nextIndex === 0;
  return {
    worldIndex: nextIndex,
    worldKey: WORLD_SEQUENCE[nextIndex],
    worldRound: 1,
    bossRound: false,
    worldCycle: worldCycle + (looped ? 1 : 0),
  };
}

export function createRunResumeSnapshot(
  playerStats: any,
  state: GameState,
  heroClass: HeroClass,
  cardTiers: Record<string, number>,
  nextProgression: WorldProgressionState,
  note: string,
  buildings: Array<{ id?: string; name: string; hp: number; max: number }> = [],
  authoredMapId?: string,
): any {
  return {
    playerStats: { ...playerStats },
    state: {
      health: state.health,
      gold: state.gold,
      level: state.level,
      villageSafety: 100,
      equipped: state.equipped,
      gameOverReason: '',
      ...nextProgression,
    },
    buildings: buildings.map((building) => ({ ...building })),
    heroClass,
    cardTiers,
    authoredMapId,
    note,
  };
}

export function checkLevelClearCondition(
  phase: string,
  levelClearQueued: boolean,
  levelResolvedEnemies: number,
  levelRequiredResolutions: number,
  levelSpawnsPending: number,
  levelSpawnedCount: number,
  bossRound: boolean,
): boolean {
  if (phase !== 'playing' || levelClearQueued) {
    return false;
  }
  const resolved = levelResolvedEnemies >= levelRequiredResolutions;
  const hadRealSpawns = levelSpawnedCount > 0 || bossRound;
  return levelSpawnsPending <= 0 && resolved && hadRealSpawns;
}

export interface RoundReward {
  gold: number;
}

export function calculateRoundReward(
  bossRound: boolean,
  level: number,
  worldCycle: number,
  worldKey: string,
): RoundReward {
  if (bossRound) {
    const bossConfig = BOSS_CONFIGS[worldKey as SeasonPreset];
    return {
      gold: bossConfig.clearGold + worldCycle * 10 + level * 4,
    };
  }
  return {
    gold: 20 + level * 8,
  };
}

export function buildCountdownSequence(roundTitle: string): string[] {
  return [roundTitle, '3', '2', '1', 'Go!'];
}

// ---- Scene-interaction functions (wire into Phaser scene) ----

export function clearLevelTimers(scene: SceneAPI): void {
  scene.levelTimers.forEach((timer: any) => timer.remove(false));
  scene.levelTimers = [];
}

export function addLevelTimer(scene: SceneAPI, delay: number, callback: () => void): any {
  const timer = scene.time.delayedCall(delay, callback);
  scene.levelTimers.push(timer);
  return timer;
}

export function showCountdownLabel(
  scene: SceneAPI,
  label: string,
  roundTitle: string,
): void {
  if (!scene.countdownOverlay) {
    return;
  }
  scene.countdownLevelText.setText(label === roundTitle ? roundTitle : roundTitle);
  scene.countdownNumberText.setText(label === roundTitle ? '' : label);
  scene.countdownNumberText.setScale(label === 'Go!' ? 0.82 : 1);
  scene.countdownOverlay.setAlpha(0.98);
  scene.tweens.add({
    targets: scene.countdownNumberText,
    scale: label === 'Go!' ? 1.05 : 1.18,
    yoyo: true,
    duration: 220,
    ease: 'Sine.easeOut',
  });
}

export function resetLevelRoundState(scene: SceneAPI, level: number, bossRound: boolean, heroClass: HeroClass): number {
  const roster: Array<EnemyRoleKey | 'boss'> = bossRound ? ['boss'] : buildWaveRoster(heroClass, level);
  scene.roundEnemyQueue = roster;
  const count = roster.length;
  scene.levelSpawnsPending = count;
  scene.levelEnemiesRemaining = count;
  scene.levelRequiredDefeats = count;
  scene.levelDefeatsThisRound = 0;
  scene.levelSpawnFailures = 0;
  scene.levelSpawnedCount = 0;
  return count;
}

export function spawnEnemyTimerCallback(
  scene: SceneAPI,
  level: number,
  isBossRound: boolean,
): void {
  if (scene.state.phase !== 'playing') {
    return;
  }
  scene.levelSpawnsPending = Math.max(0, scene.levelSpawnsPending - 1);
  const role = scene.roundEnemyQueue.shift();
  const spawned = scene.spawnRoundEnemy(level, role);
  if (!spawned) {
    scene.levelSpawnFailures += 1;
    if (!isBossRound) {
      scene.levelRequiredDefeats = Math.max(0, scene.levelRequiredDefeats - 1);
      scene.levelEnemiesRemaining = Math.max(
        0,
        scene.levelRequiredDefeats - scene.levelDefeatsThisRound,
      );
    }
    if (scene.generatedLevelActive) {
      console.warn('Generated spawn skipped because no protected target route was available.');
      if (scene.levelSpawnedCount === 0 && scene.levelSpawnsPending === 0) {
        scene.addGuildNote('The scouts lost the route. The wave is waiting for a clear path.');
      }
    }
  }
  scene.checkLevelClear();
}

export function scheduleLevelSpawns(
  scene: SceneAPI,
  level: number,
  count: number,
  isBossRound: boolean,
): void {
  for (let i = 0; i < count; i += 1) {
    const spawnInterval = calculateSpawnInterval(level);
    addLevelTimer(scene, LEVEL_FIRST_SPAWN_DELAY + i * spawnInterval, () => {
      spawnEnemyTimerCallback(scene, level, isBossRound);
    });
  }
}
