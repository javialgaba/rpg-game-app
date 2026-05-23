import type { SeasonPreset } from './sceneVariants';

export const WIDTH = 1280;
export const HEIGHT = 720;
export const TILE_W = 92;
export const TILE_H = 46;
export const MAP_W = 15;
export const MAP_H = 15;
export const ORIGIN = { x: WIDTH / 2, y: 108 };

export type HeroClass = 'warrior' | 'archer' | 'sorcerer';
export type CardKey = 'swiftBoots' | 'strongerStrikes' | 'quickHands' | 'magicRepair' | 'reinforcedWalls' | 'toughHeart';
export type PersistentCardKey = Exclude<CardKey, 'magicRepair'>;
export type EnemyRoleKey = 'sproutling' | 'thornRunner' | 'mushroomBrute' | 'spitter' | 'wispMage' | 'leafSneak' | 'bombBud';

export interface HeroClassConfig {
  key: HeroClass;
  label: string;
  identity: string;
  mainAttack: string;
  skill: string;
  maxHealth: number;
  speed: number;
  attackDamage: number;
  attackCooldown: number;
  attackRange: number;
  skillCooldown: number;
}

export const HERO_CLASSES: Record<HeroClass, HeroClassConfig> = {
  warrior: {
    key: 'warrior',
    label: 'Warrior',
    identity: 'Close-range protector.',
    mainAttack: 'Sword Slash',
    skill: 'Shield Guard',
    maxHealth: 4,
    speed: 3.15,
    attackDamage: 2,
    attackCooldown: 480,
    attackRange: 1.45,
    skillCooldown: 5000,
  },
  archer: {
    key: 'archer',
    label: 'Archer',
    identity: 'Ranged hunter with traps.',
    mainAttack: 'Bow Shot',
    skill: 'Trap',
    maxHealth: 3,
    speed: 3.45,
    attackDamage: 1,
    attackCooldown: 360,
    attackRange: 9,
    skillCooldown: 6000,
  },
  sorcerer: {
    key: 'sorcerer',
    label: 'Sorcerer',
    identity: 'Magic defender with shields.',
    mainAttack: 'Wand Bolt',
    skill: 'Magic Shield',
    maxHealth: 3,
    speed: 3.15,
    attackDamage: 2,
    attackCooldown: 620,
    attackRange: 6,
    skillCooldown: 8000,
  },
};

export const PLAYER_BASE = {
  maxHealth: HERO_CLASSES.warrior.maxHealth,
  speed: HERO_CLASSES.warrior.speed,
  attackDamage: HERO_CLASSES.warrior.attackDamage,
  attackCooldown: HERO_CLASSES.warrior.attackCooldown,
  attackRange: HERO_CLASSES.warrior.attackRange,
  skillCooldown: HERO_CLASSES.warrior.skillCooldown,
};

export const LEVEL_UP_CARD_XS = [-126, 126];
export const LEVEL_UP_MAX_PIPS = 5;
export const CARD_TIER_PERCENTAGES = {
  swiftBoots: [8, 8, 8, 6, 6],
  strongerStrikes: [15, 15, 12, 10, 10],
  quickHands: [10, 10, 8, 8, 6],
  reinforcedWalls: [15, 15, 12, 10, 10],
} as const;

export const SKILL_LEVELS = [3, 5, 7, 9] as const;
export const SHIELD_GUARD = {
  duration: 1250,
  upgradedDuration: 1650,
  cooldown: 5000,
  upgradedCooldown: 4000,
  meleeReduction: 0.5,
  pushback: 0.35,
  upgradedPushback: 0.65,
};
export const ARCHER_TRAP = {
  lifetime: 10000,
  cooldown: 6000,
  upgradedCooldown: 5000,
  radius: 0.8,
  upgradedRadius: 1.05,
  slowFactor: 0.55,
  slowDuration: 2500,
  upgradedSlowDuration: 3500,
};
export const MAGIC_SHIELD = {
  duration: 4000,
  upgradedDuration: 5000,
  cooldown: 8000,
  upgradedCooldown: 7000,
  buildingAbsorb: 16,
  upgradedBuildingAbsorb: 24,
  heroAbsorb: 2,
  upgradedHeroAbsorb: 3,
};
export const BOSS_HEALTH_MULTIPLIER = 1.6;
export const BOSS_PROJECTILE_DAMAGE = 5;
export const BOSS_PROJECTILE_COOLDOWN = 2250;

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

export const LEVEL_FIRST_SPAWN_DELAY = 740;
export const LEVEL_SPAWN_INTERVAL_BASE = 820;
export const LEVEL_SPAWN_INTERVAL_STEP = 28;
export const LEVEL_SPAWN_INTERVAL_MIN = 300;
export const WAVE_BUDGETS = [6, 9, 12, 16, 20, 24, 29, 34, 40] as const;
export const ROUNDS_PER_WORLD = 4;
export const BOSS_ROUND_INDEX = 4;

export const COMPACT_NOTES_MAX_VISIBLE = 2;
export const DESKTOP_NOTES_MAX_VISIBLE = 3;
export const COMPACT_NOTE_MAX_CHARS = 62;

export interface EnemyArchetypeConfig {
  key: EnemyRoleKey;
  label: string;
  row: number;
  cost: number;
  weight: number;
  hp: number;
  speed: number;
  buildingDamage: number;
  contactDamage: number;
  size: number;
  rewardGold: [number, number];
}

export const ENEMY_ARCHETYPES: EnemyArchetypeConfig[] = [
  {
    key: 'sproutling',
    label: 'Sproutling',
    row: 0,
    cost: 1,
    weight: 4,
    hp: 2,
    speed: 0.76,
    buildingDamage: 4,
    contactDamage: 1,
    size: 52,
    rewardGold: [6, 13],
  },
  {
    key: 'thornRunner',
    label: 'Thorn Runner',
    row: 1,
    cost: 2,
    weight: 3,
    hp: 2,
    speed: 1.16,
    buildingDamage: 3,
    contactDamage: 1,
    size: 50,
    rewardGold: [7, 14],
  },
  {
    key: 'mushroomBrute',
    label: 'Mushroom Brute',
    row: 2,
    cost: 4,
    weight: 2,
    hp: 8,
    speed: 0.56,
    buildingDamage: 8,
    contactDamage: 1,
    size: 60,
    rewardGold: [8, 16],
  },
  {
    key: 'spitter',
    label: 'Spitter',
    row: 3,
    cost: 3,
    weight: 2,
    hp: 4,
    speed: 0.72,
    buildingDamage: 4,
    contactDamage: 1,
    size: 58,
    rewardGold: [9, 17],
  },
  {
    key: 'leafSneak',
    label: 'Leaf Sneak',
    row: 4,
    cost: 2,
    weight: 2,
    hp: 3,
    speed: 1.04,
    buildingDamage: 5,
    contactDamage: 1,
    size: 62,
    rewardGold: [10, 20],
  },
  {
    key: 'wispMage',
    label: 'Wisp Mage',
    row: 3,
    cost: 5,
    weight: 1,
    hp: 5,
    speed: 0.62,
    buildingDamage: 4,
    contactDamage: 1,
    size: 58,
    rewardGold: [16, 25],
  },
  {
    key: 'bombBud',
    label: 'Bomb Bud',
    row: 4,
    cost: 5,
    weight: 1,
    hp: 4,
    speed: 0.82,
    buildingDamage: 16,
    contactDamage: 1,
    size: 62,
    rewardGold: [17, 26],
  },
];

export const ENEMY_UNLOCK_LEVELS: Record<HeroClass, Record<EnemyRoleKey, number>> = {
  warrior: {
    sproutling: 1,
    thornRunner: 2,
    mushroomBrute: 3,
    spitter: 5,
    leafSneak: 7,
    wispMage: 8,
    bombBud: 9,
  },
  archer: {
    sproutling: 1,
    thornRunner: 2,
    mushroomBrute: 4,
    spitter: 5,
    leafSneak: 3,
    wispMage: 7,
    bombBud: 8,
  },
  sorcerer: {
    sproutling: 1,
    thornRunner: 3,
    mushroomBrute: 2,
    spitter: 4,
    leafSneak: 6,
    wispMage: 7,
    bombBud: 8,
  },
};

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
  clearGold: number;
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
    clearGold: 58,
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
    clearGold: 66,
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
    clearGold: 74,
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
    clearGold: 84,
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

export const GENERATED_BUILDING_SPRITE_ALPHA = 1;
export const STATIC_BUILDING_BASE_ALPHA = 0.14;
export const STATIC_BUILDING_SPRITE_ALPHA = 0.74;

export interface CardDefinition {
  key: CardKey;
  label: string;
  detail: string;
  icon: { texture: string; frame: string };
  category: 'offenseMobility' | 'survivalVillage';
  persistent: boolean;
  color: number;
  stageColor: number;
  stageAccent: number;
}

export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    key: 'strongerStrikes',
    label: 'Stronger Strikes',
    detail: 'Main attack hits harder.',
    icon: { texture: 'uiAtlas', frame: 'card_stronger_strikes_01' },
    category: 'offenseMobility',
    persistent: true,
    color: 0xf4bc3f,
    stageColor: 0xb94136,
    stageAccent: 0xffd45c,
  },
  {
    key: 'quickHands',
    label: 'Quick Hands',
    detail: 'Main attack readies faster.',
    icon: { texture: 'uiAtlas', frame: 'card_quick_hands_01' },
    category: 'offenseMobility',
    persistent: true,
    color: 0x72c96d,
    stageColor: 0x397f4a,
    stageAccent: 0xbde679,
  },
  {
    key: 'swiftBoots',
    label: 'Swift Boots',
    detail: 'Move faster.',
    icon: { texture: 'uiAtlas', frame: 'card_swift_boots_01' },
    category: 'offenseMobility',
    persistent: true,
    color: 0x6cc5ff,
    stageColor: 0x3267c9,
    stageAccent: 0xa8f3ff,
  },
  {
    key: 'toughHeart',
    label: 'Tough Heart',
    detail: 'Gain 1 extra heart.',
    icon: { texture: 'uiAtlas', frame: 'card_tough_heart_01' },
    category: 'survivalVillage',
    persistent: true,
    color: 0xe65a72,
    stageColor: 0xa43c56,
    stageAccent: 0xffa9bd,
  },
  {
    key: 'reinforcedWalls',
    label: 'Reinforced Walls',
    detail: 'Buildings gain max health.',
    icon: { texture: 'uiAtlas', frame: 'card_reinforced_walls_01' },
    category: 'survivalVillage',
    persistent: true,
    color: 0x59c96b,
    stageColor: 0x347c48,
    stageAccent: 0xb8ffd5,
  },
  {
    key: 'magicRepair',
    label: 'Magic Repair',
    detail: 'Fully repair all buildings.',
    icon: { texture: 'uiAtlas', frame: 'card_magic_repair_01' },
    category: 'survivalVillage',
    persistent: false,
    color: 0x66cfc3,
    stageColor: 0x347c76,
    stageAccent: 0xb8fff3,
  },
];
