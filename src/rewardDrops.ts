import {
  HEART_DROP_PRIORITY_ENEMIES,
  HEART_DROP_REWARD,
  type EnemyRoleKey,
} from './gameConfig';

export interface HeartDropContext {
  currentHealth: number;
  maxHealth: number;
  defeatedSinceLastHeart: number;
  enemyRole?: EnemyRoleKey | 'boss';
  isBoss?: boolean;
  random?: () => number;
}

export function getHeartDropHealAmount({
  currentHealth,
  maxHealth,
  defeatedSinceLastHeart,
  enemyRole,
  isBoss = false,
  random = Math.random,
}: HeartDropContext): number {
  if (currentHealth >= maxHealth) {
    return 0;
  }
  if (isBoss || enemyRole === 'boss') {
    return HEART_DROP_REWARD.healAmount;
  }
  if (currentHealth <= 1 && defeatedSinceLastHeart >= HEART_DROP_REWARD.lowHealthPityDefeats) {
    return HEART_DROP_REWARD.healAmount;
  }
  const chance = enemyRole && HEART_DROP_PRIORITY_ENEMIES.includes(enemyRole as EnemyRoleKey)
    ? HEART_DROP_REWARD.priorityChance
    : HEART_DROP_REWARD.normalChance;
  return random() < chance ? HEART_DROP_REWARD.healAmount : 0;
}
