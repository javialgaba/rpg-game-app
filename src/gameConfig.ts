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
  spellPower: 2,
  bowCooldown: 560,
  spellCost: 28,
};

export const LEVEL_UP_CARD_XS = [-210, 0, 210];
export const LEVEL_UP_MAX_PIPS = 5;

export const REPAIR_COST = 5;
export const REPAIR_AMOUNT = 16;
export const REPAIR_RANGE = 1.55;
export const REPAIR_COOLDOWN = 650;

export const LEVEL_SPAWN_BASE = 3;
export const LEVEL_SPAWN_PER_LEVEL = 2;
export const LEVEL_SPAWN_MAX = 22;
export const LEVEL_FIRST_SPAWN_DELAY = 740;
export const LEVEL_SPAWN_INTERVAL_BASE = 820;
export const LEVEL_SPAWN_INTERVAL_STEP = 28;
export const LEVEL_SPAWN_INTERVAL_MIN = 300;

export const COMPACT_NOTES_MAX_VISIBLE = 2;
export const DESKTOP_NOTES_MAX_VISIBLE = 3;
export const COMPACT_NOTE_MAX_CHARS = 62;

export const ENEMY_ARCHETYPES = [
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

export const ENEMY_VARIANTS = [
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
