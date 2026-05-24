import type { SeasonPreset } from './sceneVariants';

export const WIDTH = 1280;
export const HEIGHT = 720;
export const TILE_W = 92;
export const TILE_H = 46;
export const MAP_W = 15;
export const MAP_H = 15;
export const ORIGIN = { x: WIDTH / 2, y: 108 };

export const PLAYER_BASE = {
  maxHealth: 3,
  maxMana: 90,
  speed: 3.15,
  swordPower: 1,
  bowPower: 1,
  bowEvolved: false,
  spellPower: 2,
  bowCooldown: 560,
  spellCost: 28,
};

export const LEVEL_UP_CARD_XS = [-210, 0, 210];
export const LEVEL_UP_MAX_PIPS = 5;
export const BOW_EVOLUTION_POWER_BONUS = 2;
export const BOW_EVOLVED_PROGRESS_BASELINE = PLAYER_BASE.bowPower + LEVEL_UP_MAX_PIPS + BOW_EVOLUTION_POWER_BONUS;

export interface LevelUpProgressStats {
  bowPower: number;
  bowEvolved: boolean;
  swordPower: number;
  spellPower: number;
}

export const clampLevelUpProgress = (value: number) => Math.min(LEVEL_UP_MAX_PIPS, Math.max(0, value));

export const getBowLevelUpProgress = (stats: Pick<LevelUpProgressStats, 'bowPower' | 'bowEvolved'>) => (
  stats.bowEvolved
    ? clampLevelUpProgress(stats.bowPower - BOW_EVOLVED_PROGRESS_BASELINE)
    : clampLevelUpProgress(stats.bowPower - PLAYER_BASE.bowPower)
);

export const isBowEvolutionReadyForStats = (stats: Pick<LevelUpProgressStats, 'bowPower' | 'bowEvolved'>) => (
  !stats.bowEvolved && getBowLevelUpProgress(stats) >= LEVEL_UP_MAX_PIPS
);

export const getRangeLevelUpPresentationForStats = (stats: Pick<LevelUpProgressStats, 'bowPower' | 'bowEvolved'>) => {
  if (stats.bowEvolved) {
    return {
      label: 'Evolved Bow',
      detail: '+1 master bow',
      evolved: true,
    };
  }
  if (isBowEvolutionReadyForStats(stats)) {
    return {
      label: 'Bow Evolution',
      detail: 'Improved bow',
      evolved: true,
    };
  }
  return {
    label: 'Range Damage',
    detail: '+1 bow',
    evolved: false,
  };
};

export const getLevelUpProgressForStat = (
  stats: LevelUpProgressStats,
  stat: 'swordPower' | 'bowPower' | 'spellPower',
) => {
  if (stat === 'bowPower') {
    return getBowLevelUpProgress(stats);
  }
  return clampLevelUpProgress(stats[stat] - PLAYER_BASE[stat]);
};

export const REPAIR_COST = 5;
export const REPAIR_AMOUNT = 16;
export const REPAIR_RANGE = 1.55;
export const REPAIR_COOLDOWN = 650;
export const REPAIR_OUTLINE_COLORS = {
  perfect: 0x42d46b,
  repairable: 0xffffff,
  unaffordable: 0xff4f57,
} as const;
export const REPAIR_OUTLINE_BACKING_COLOR = 0x203047;
export const REPAIR_OUTLINE_BACKING_WIDTH = 10;
export const REPAIR_OUTLINE_STROKE_WIDTH = 7;
export const REPAIR_OUTLINE_FILL_ALPHA = 0.12;

export const LEVEL_SPAWN_BASE = 3;
export const LEVEL_SPAWN_PER_LEVEL = 2;
export const LEVEL_SPAWN_MAX = 22;
export const LEVEL_FIRST_SPAWN_DELAY = 740;
export const LEVEL_SPAWN_INTERVAL_BASE = 820;
export const LEVEL_SPAWN_INTERVAL_STEP = 28;
export const LEVEL_SPAWN_INTERVAL_MIN = 300;
export const ROUNDS_PER_WORLD = 4;
export const BOSS_ROUND_INDEX = 4;

export const COMPACT_NOTES_MAX_VISIBLE = 2;
export const DESKTOP_NOTES_MAX_VISIBLE = 3;
export const COMPACT_NOTE_MAX_CHARS = 62;

export interface EnemyArchetypeConfig {
  key: string;
  label: string;
  row: number;
  unlockLevel: number;
  weight: number;
  hp: number;
  speed: number;
  buildingDamage: number;
  contactDamage: number;
  size: number;
  rewardGold: [number, number];
  rewardXp: number;
}

export const ENEMY_ARCHETYPES: EnemyArchetypeConfig[] = [
  {
    key: 'blob',
    label: 'forest blob',
    row: 0,
    unlockLevel: 1,
    weight: 4,
    hp: 2,
    speed: 0.76,
    buildingDamage: 4,
    contactDamage: 1,
    size: 52,
    rewardGold: [6, 13],
    rewardXp: 13,
  },
  {
    key: 'sprite',
    label: 'leafy sprite',
    row: 1,
    unlockLevel: 1,
    weight: 3,
    hp: 2,
    speed: 0.88,
    buildingDamage: 3,
    contactDamage: 1,
    size: 50,
    rewardGold: [7, 14],
    rewardXp: 14,
  },
  {
    key: 'mushroom',
    label: 'mushroom sprite',
    row: 2,
    unlockLevel: 1,
    weight: 3,
    hp: 3,
    speed: 0.68,
    buildingDamage: 5,
    contactDamage: 1,
    size: 60,
    rewardGold: [8, 16],
    rewardXp: 16,
  },
  {
    key: 'lizard',
    label: 'leafy lizard',
    row: 3,
    unlockLevel: 2,
    weight: 2,
    hp: 3,
    speed: 0.96,
    buildingDamage: 4,
    contactDamage: 1,
    size: 58,
    rewardGold: [9, 17],
    rewardXp: 18,
  },
  {
    key: 'acorn',
    label: 'acorn critter',
    row: 4,
    unlockLevel: 3,
    weight: 2,
    hp: 4,
    speed: 0.78,
    buildingDamage: 6,
    contactDamage: 1,
    size: 62,
    rewardGold: [10, 20],
    rewardXp: 20,
  },
];

export interface EnemyVariantConfig {
  key: string;
  label: string;
  unlockLevel: number;
  weight: number;
  tint: number | null;
  scale: number;
  hp: number;
  speed: number;
  buildingDamage: number;
  contactDamage: number;
  reward: number;
}

export const ENEMY_VARIANTS: EnemyVariantConfig[] = [
  {
    key: 'normal',
    label: '',
    unlockLevel: 1,
    weight: 7,
    tint: null,
    scale: 1,
    hp: 1,
    speed: 1,
    buildingDamage: 1,
    contactDamage: 1,
    reward: 1,
  },
  {
    key: 'bright',
    label: 'bright',
    unlockLevel: 2,
    weight: 3,
    tint: 0xd9ff8f,
    scale: 1.08,
    hp: 1.25,
    speed: 1.08,
    buildingDamage: 1.12,
    contactDamage: 1,
    reward: 1.22,
  },
  {
    key: 'elder',
    label: 'elder',
    unlockLevel: 4,
    weight: 2,
    tint: 0xffc878,
    scale: 1.22,
    hp: 1.65,
    speed: 0.92,
    buildingDamage: 1.45,
    contactDamage: 1,
    reward: 1.55,
  },
];

export const WORLD_SEQUENCE: SeasonPreset[] = [
  'day_spring',
  'afternoon_summer',
  'night_spring',
  'noon_winter',
];

export const WORLD_ENEMY_THEMES: Record<SeasonPreset, {
  label: string;
  bossLabel: string;
  bossIntro: string;
  bossDefeat: string;
  frameCount: number;
  eliteCellSize: number;
  bossCellSize: number;
  safeBorderPx: number;
  eliteAssetKey: string;
  eliteFramePrefix: string;
  eliteIdleFrames: number[];
  eliteDefeatFrame: number;
  eliteDisplayScaleX: number;
  eliteDisplayScaleY: number;
  bossAssetKey: string;
  bossFramePrefix: string;
  bossIdleFrames: number[];
  bossDefeatFrame: number;
  bossDisplayScaleX: number;
  bossDisplayScaleY: number;
  eliteSpawnChance: number;
  preferredArchetypes: string[];
  ambientTint: number | null;
}> = {
  day_spring: {
    label: 'Spring',
    bossLabel: 'Spring Boss',
    bossIntro: 'The Blossom Guardian appears!',
    bossDefeat: 'Spring is safe. Summer stirs beyond the clouds!',
    frameCount: 8,
    eliteCellSize: 256,
    bossCellSize: 384,
    safeBorderPx: 16,
    eliteAssetKey: 'worldElite_day_spring',
    eliteFramePrefix: 'world-elite-day-spring',
    eliteIdleFrames: [0, 1, 2, 3],
    eliteDefeatFrame: 7,
    eliteDisplayScaleX: 1,
    eliteDisplayScaleY: 1,
    bossAssetKey: 'worldBoss_day_spring',
    bossFramePrefix: 'world-boss-day-spring',
    bossIdleFrames: [0, 1, 2, 3],
    bossDefeatFrame: 7,
    bossDisplayScaleX: 1,
    bossDisplayScaleY: 1,
    eliteSpawnChance: 0.34,
    preferredArchetypes: ['sprite', 'blob', 'mushroom'],
    ambientTint: 0xffe7f4,
  },
  afternoon_summer: {
    label: 'Summer',
    bossLabel: 'Summer Boss',
    bossIntro: 'A Sun-Bramble Guardian charges from the grove!',
    bossDefeat: 'Summer bows out. Twilight settles over the village!',
    frameCount: 8,
    eliteCellSize: 256,
    bossCellSize: 384,
    safeBorderPx: 16,
    eliteAssetKey: 'worldElite_afternoon_summer',
    eliteFramePrefix: 'world-elite-afternoon-summer',
    eliteIdleFrames: [0, 1, 2, 3],
    eliteDefeatFrame: 7,
    eliteDisplayScaleX: 1,
    eliteDisplayScaleY: 1,
    bossAssetKey: 'worldBoss_afternoon_summer',
    bossFramePrefix: 'world-boss-afternoon-summer',
    bossIdleFrames: [0, 1, 2, 3],
    bossDefeatFrame: 7,
    bossDisplayScaleX: 1,
    bossDisplayScaleY: 1,
    eliteSpawnChance: 0.38,
    preferredArchetypes: ['lizard', 'blob', 'acorn'],
    ambientTint: 0xffe2a6,
  },
  night_spring: {
    label: 'Twilight',
    bossLabel: 'Twilight Boss',
    bossIntro: 'A Moonlit Guardian drifts into the lantern glow!',
    bossDefeat: 'The twilight guardian fades. Winter winds answer next.',
    frameCount: 8,
    eliteCellSize: 256,
    bossCellSize: 384,
    safeBorderPx: 16,
    eliteAssetKey: 'worldElite_night_spring',
    eliteFramePrefix: 'world-elite-night-spring',
    eliteIdleFrames: [0, 1, 2, 3],
    eliteDefeatFrame: 7,
    eliteDisplayScaleX: 1,
    eliteDisplayScaleY: 1,
    bossAssetKey: 'worldBoss_night_spring',
    bossFramePrefix: 'world-boss-night-spring',
    bossIdleFrames: [0, 1, 2, 3],
    bossDefeatFrame: 7,
    bossDisplayScaleX: 1,
    bossDisplayScaleY: 1,
    eliteSpawnChance: 0.42,
    preferredArchetypes: ['sprite', 'mushroom', 'acorn'],
    ambientTint: 0xb8c7ff,
  },
  noon_winter: {
    label: 'Winter',
    bossLabel: 'Winter Boss',
    bossIntro: 'The Frost Guardian stomps across the snow!',
    bossDefeat: 'Winter is quiet again. Spring will bloom once more.',
    frameCount: 8,
    eliteCellSize: 256,
    bossCellSize: 384,
    safeBorderPx: 16,
    eliteAssetKey: 'worldElite_noon_winter',
    eliteFramePrefix: 'world-elite-noon-winter',
    eliteIdleFrames: [0, 1, 2, 3],
    eliteDefeatFrame: 7,
    eliteDisplayScaleX: 1,
    eliteDisplayScaleY: 1,
    bossAssetKey: 'worldBoss_noon_winter',
    bossFramePrefix: 'world-boss-noon-winter',
    bossIdleFrames: [0, 1, 2, 3],
    bossDefeatFrame: 7,
    bossDisplayScaleX: 1,
    bossDisplayScaleY: 1,
    eliteSpawnChance: 0.42,
    preferredArchetypes: ['mushroom', 'acorn', 'blob'],
    ambientTint: 0xe6f7ff,
  },
};

export const BOSS_CONFIGS: Record<SeasonPreset, {
  name: string;
  hp: number;
  speed: number;
  size: number;
  buildingDamage: number;
  contactDamage: number;
  rewardGold: [number, number];
  rewardXp: number;
  clearGold: number;
  clearXp: number;
  tint: number | null;
}> = {
  day_spring: {
    name: 'Blossom Guardian',
    hp: 22,
    speed: 0.56,
    size: 118,
    buildingDamage: 11,
    contactDamage: 1,
    rewardGold: [22, 34],
    rewardXp: 52,
    clearGold: 58,
    clearXp: 72,
    tint: null,
  },
  afternoon_summer: {
    name: 'Sun-Bramble Guardian',
    hp: 26,
    speed: 0.62,
    size: 124,
    buildingDamage: 12,
    contactDamage: 1,
    rewardGold: [26, 39],
    rewardXp: 60,
    clearGold: 66,
    clearXp: 84,
    tint: 0xffd385,
  },
  night_spring: {
    name: 'Moonlit Guardian',
    hp: 30,
    speed: 0.58,
    size: 130,
    buildingDamage: 13,
    contactDamage: 1,
    rewardGold: [30, 44],
    rewardXp: 72,
    clearGold: 74,
    clearXp: 96,
    tint: 0xd5deff,
  },
  noon_winter: {
    name: 'Frost Guardian',
    hp: 34,
    speed: 0.54,
    size: 138,
    buildingDamage: 14,
    contactDamage: 1,
    rewardGold: [34, 48],
    rewardXp: 84,
    clearGold: 84,
    clearXp: 108,
    tint: 0xe7ffff,
  },
};

export const COLORS = {
  skyTop: 0x8bd6ff,
  skyBottom: 0xd7f6ff,
  grassA: 0x91dd78,
  grassB: 0x79cf70,
  forest: 0x59b66f,
  path: 0xd6bc87,
  pathEdge: 0xb99763,
  garden: 0xf5a6c7,
  water: 0x7fd8f6,
  uiInk: '#25324a',
};

export interface UpgradeDef {
  name: string;
  detail: string;
  cost: number;
  level: number;
  icon: string;
  apply: (scene: any) => void;
}

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    name: 'Sword',
    detail: '+1 soft bonk',
    cost: 55,
    level: 0,
    icon: 'swordIconTexture',
    apply: (scene) => {
      scene.playerStats.swordPower += 1;
      scene.addGuildNote('Your wooden sword feels braver!');
    },
  },
];

export const GENERATED_BUILDING_SPRITE_ALPHA = 1;
export const STATIC_BUILDING_BASE_ALPHA = 0.14;
export const STATIC_BUILDING_SPRITE_ALPHA = 0.74;

export interface LevelUpChoiceDef {
  key: string;
  label: string;
  detail: string;
  icon: { texture: string; frame: string };
  stat: string;
  color: number;
  stageColor: number;
  stageAccent: number;
  apply: (scene: any) => void;
}

export const LEVEL_UP_CHOICE_DEFS: LevelUpChoiceDef[] = [
  {
    key: 'melee',
    label: 'Melee Damage',
    detail: '+1 sword power',
    icon: { texture: 'uiAtlas', frame: 'sword_icon_01' },
    stat: 'swordPower',
    color: 0xf4bc3f,
    stageColor: 0xb94136,
    stageAccent: 0xffd45c,
    apply: (scene) => {
      scene.playerStats.swordPower += 1;
      scene.addGuildNote('Melee training complete! Sword damage increased.');
    },
  },
  {
    key: 'range',
    label: 'Range Damage',
    detail: '+1 bow power',
    icon: { texture: 'uiAtlas', frame: 'bow_icon_01' },
    stat: 'bowPower',
    color: 0x72c96d,
    stageColor: 0x397f4a,
    stageAccent: 0xbde679,
    apply: (scene) => {
      if (scene.isBowEvolutionReady()) {
        scene.playerStats.bowEvolved = true;
        scene.playerStats.bowPower += BOW_EVOLUTION_POWER_BONUS;
        scene.playerStats.bowCooldown = Math.max(220, scene.playerStats.bowCooldown - 90);
        scene.addGuildNote('Bow evolution complete! Arrows fly faster and hit harder.');
        return;
      }
      scene.playerStats.bowPower += 1;
      if (scene.playerStats.bowEvolved) {
        scene.playerStats.bowCooldown = Math.max(220, scene.playerStats.bowCooldown - 30);
        scene.addGuildNote('Evolved bow training complete! Master shots improved.');
        return;
      }
      scene.addGuildNote('Range training complete! Bow damage increased.');
    },
  },
  {
    key: 'magic',
    label: 'Magic Damage',
    detail: '+1 spell power',
    icon: { texture: 'uiAtlas', frame: 'spell_icon_01' },
    stat: 'spellPower',
    color: 0x6cc5ff,
    stageColor: 0x3267c9,
    stageAccent: 0xa8f3ff,
    apply: (scene) => {
      scene.playerStats.spellPower += 1;
      scene.addGuildNote('Magic training complete! Spell damage increased.');
    },
  },
];
