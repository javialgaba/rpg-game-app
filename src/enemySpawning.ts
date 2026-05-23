import type { EnemyVisualResult } from './gameTypes';
import {
  ENEMY_ARCHETYPES,
  ENEMY_VARIANTS,
} from './gameConfig';
import type { EnemyArchetypeConfig, EnemyRoleKey, EnemyVariantConfig } from './gameConfig';

// ---- Pure helper functions (testable without scene) ----

export function pickWeighted<T extends { weight: number }>(items: T[], roll: number): T | null {
  if (!items.length) {
    return null;
  }
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let r = roll * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}

export function getEnemyArchetype(
  role: EnemyRoleKey,
): EnemyArchetypeConfig {
  return ENEMY_ARCHETYPES.find((archetype) => archetype.key === role) ?? ENEMY_ARCHETYPES[0];
}

export function getEnemyVariant(level: number, roll: number): EnemyVariantConfig {
  return pickWeighted(
    ENEMY_VARIANTS.filter((variant) => variant.unlockLevel <= level),
    roll,
  ) || ENEMY_VARIANTS[0];
}

export function getEnemyDisplayName(
  variantLabel: string,
  archetypeLabel: string,
): string {
  return [variantLabel, archetypeLabel].filter(Boolean).join(' ');
}

export function getEnemyFrameKey(
  framePrefix: string,
  frameRow: number,
  column: number,
): string {
  return `${framePrefix}-${frameRow}-${column}`;
}

export function getWorldEliteVisual(
  level: number,
  variantKey: string,
  eliteSpawnChance: number,
  eliteAssetKey: string,
  eliteFramePrefix: string,
  eliteIdleFrames: number[],
  eliteDefeatFrame: number,
  eliteDisplayScaleX: number,
  eliteDisplayScaleY: number,
  ambientTint: number | null,
  variantTint: number | null,
  textureExists: (key: string) => boolean,
  roll: number,
): EnemyVisualResult {
  const shouldUseElite = level >= 2 && (variantKey !== 'normal' || roll < eliteSpawnChance);
  if (!shouldUseElite || !textureExists(eliteAssetKey)) {
    return { frameSheetKey: 'monsterSheet', framePrefix: 'monster', frameRow: null, tint: variantTint };
  }
  return {
    frameSheetKey: eliteAssetKey,
    framePrefix: eliteFramePrefix,
    frameRow: 0,
    tint: ambientTint ?? variantTint,
  };
}

export function getBossVisual(
  bossAssetKey: string,
  bossFramePrefix: string,
  bossTint: number | null,
  textureExists: (key: string) => boolean,
): EnemyVisualResult {
  if (!textureExists(bossAssetKey)) {
    return { frameSheetKey: 'monsterSheet', framePrefix: 'monster', frameRow: 0, tint: bossTint };
  }
  return {
    frameSheetKey: bossAssetKey,
    framePrefix: bossFramePrefix,
    frameRow: 0,
    tint: bossTint,
  };
}

export function calculateLevelBonus(level: number): number {
  return Math.max(0, level - 1);
}

export interface EnemyStats {
  size: number;
  maxHp: number;
  speed: number;
  buildingDamage: number;
  contactDamage: number;
  rewardGold: number[];
}

export function calculateEnemyStats(
  level: number,
  archetype: EnemyArchetypeConfig,
  variant: EnemyVariantConfig,
  eliteScaleX: number,
  eliteScaleY: number,
  isEliteVisual: boolean,
): EnemyStats {
  const levelBonus = calculateLevelBonus(level);
  const size = (archetype.size + Math.min(levelBonus, 6) * 1.4) * variant.scale;
  const maxHp = Math.max(1, Math.round((archetype.hp + Math.floor(levelBonus / 2)) * variant.hp));
  const speed = Math.min(1.72, (archetype.speed + levelBonus * 0.035) * variant.speed);
  const buildingDamage = Math.max(1, Math.round((archetype.buildingDamage + Math.floor(levelBonus / 3)) * variant.buildingDamage));
  const contactDamage = Math.max(1, Math.round(archetype.contactDamage * variant.contactDamage));
  const _displayScaleX = isEliteVisual ? eliteScaleX : 1;
  const _displayScaleY = isEliteVisual ? eliteScaleY : 1;
  const rewardGold = archetype.rewardGold.map((value) => Math.round((value + levelBonus) * variant.reward));
  return { size, maxHp, speed, buildingDamage, contactDamage, rewardGold };
}

export interface BossStats {
  maxHp: number;
  size: number;
  speed: number;
  buildingDamage: number;
  contactDamage: number;
  rewardGold: [number, number];
}

export function calculateBossStats(
  level: number,
  worldIndex: number,
  worldCycle: number,
  bossHp: number,
  bossSize: number,
  bossSpeed: number,
  bossBuildingDamage: number,
  bossContactDamage: number,
  bossRewardGold: [number, number],
): BossStats {
  const levelBonus = calculateLevelBonus(level);
  const cycleBonus = worldCycle * 0.18;
  return {
    maxHp: Math.round(bossHp + levelBonus * 3 + worldIndex * 3 + worldCycle * 8),
    size: bossSize + worldIndex * 3 + worldCycle * 4,
    speed: bossSpeed + levelBonus * 0.018 + cycleBonus,
    buildingDamage: bossBuildingDamage + Math.floor(levelBonus / 2) + worldCycle,
    contactDamage: bossContactDamage,
    rewardGold: [
      bossRewardGold[0] + worldCycle * 4 + worldIndex * 2,
      bossRewardGold[1] + worldCycle * 6 + worldIndex * 3,
    ] as [number, number],
  };
}
