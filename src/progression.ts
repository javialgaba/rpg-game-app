import {
  CARD_DEFINITIONS,
  CARD_TIER_PERCENTAGES,
  ENEMY_ARCHETYPES,
  ENEMY_UNLOCK_LEVELS,
  HERO_CLASSES,
  LEVEL_UP_MAX_PIPS,
  MAGIC_SHIELD,
  ARCHER_TRAP,
  SHIELD_GUARD,
  WAVE_BUDGETS,
  type CardDefinition,
  type CardKey,
  type EnemyRoleKey,
  type HeroClass,
  type PersistentCardKey,
} from './gameConfig';
import type { BuildingEntity } from './gameTypes';

export type CardTiers = Record<PersistentCardKey, number>;

export const createEmptyCardTiers = (): CardTiers => ({
  swiftBoots: 0,
  strongerStrikes: 0,
  quickHands: 0,
  reinforcedWalls: 0,
  toughHeart: 0,
});

export function getSkillMilestoneConfig(heroClass: HeroClass, level: number) {
  if (heroClass === 'warrior') {
    return {
      duration: level >= 5 ? SHIELD_GUARD.upgradedDuration : SHIELD_GUARD.duration,
      cooldown: level >= 7 ? SHIELD_GUARD.upgradedCooldown : SHIELD_GUARD.cooldown,
      pushback: level >= 3 ? SHIELD_GUARD.upgradedPushback : SHIELD_GUARD.pushback,
    };
  }
  if (heroClass === 'archer') {
    return {
      cooldown: level >= 7 ? ARCHER_TRAP.upgradedCooldown : ARCHER_TRAP.cooldown,
      radius: level >= 5 ? ARCHER_TRAP.upgradedRadius : ARCHER_TRAP.radius,
      slowDuration: level >= 3 ? ARCHER_TRAP.upgradedSlowDuration : ARCHER_TRAP.slowDuration,
      maxActive: level >= 9 ? 2 : 1,
    };
  }
  return {
    cooldown: level >= 7 ? MAGIC_SHIELD.upgradedCooldown : MAGIC_SHIELD.cooldown,
    duration: level >= 5 ? MAGIC_SHIELD.upgradedDuration : MAGIC_SHIELD.duration,
    buildingAbsorb: level >= 3 ? MAGIC_SHIELD.upgradedBuildingAbsorb : MAGIC_SHIELD.buildingAbsorb,
    heroAbsorb: level >= 3 ? MAGIC_SHIELD.upgradedHeroAbsorb : MAGIC_SHIELD.heroAbsorb,
  };
}

export function percentageForTiers(
  key: keyof typeof CARD_TIER_PERCENTAGES,
  tiers: number,
): number {
  return CARD_TIER_PERCENTAGES[key]
    .slice(0, Math.max(0, Math.min(tiers, LEVEL_UP_MAX_PIPS)))
    .reduce((total, value) => total + value, 0) / 100;
}

export function applyCardStats(heroClass: HeroClass, tiers: CardTiers) {
  const base = HERO_CLASSES[heroClass];
  return {
    maxHealth: base.maxHealth + tiers.toughHeart,
    speed: base.speed * (1 + percentageForTiers('swiftBoots', tiers.swiftBoots)),
    attackDamage: base.attackDamage * (1 + percentageForTiers('strongerStrikes', tiers.strongerStrikes)),
    attackCooldown: base.attackCooldown / (1 + percentageForTiers('quickHands', tiers.quickHands)),
    attackRange: base.attackRange,
    skillCooldown: base.skillCooldown,
  };
}

export function canOfferMagicRepair(buildings: Pick<BuildingEntity, 'hp' | 'max'>[], lastSelectedCard: CardKey | null) {
  return lastSelectedCard !== 'magicRepair'
    && buildings.some((building) => building.hp > 0 && building.hp / building.max < 0.6);
}

function eligibleCards(
  category: CardDefinition['category'],
  tiers: CardTiers,
  buildings: Pick<BuildingEntity, 'hp' | 'max'>[],
  lastSelectedCard: CardKey | null,
) {
  return CARD_DEFINITIONS.filter((card) => {
    if (card.category !== category) {
      return false;
    }
    if (card.key === 'magicRepair') {
      return canOfferMagicRepair(buildings, lastSelectedCard);
    }
    return tiers[card.key as PersistentCardKey] < LEVEL_UP_MAX_PIPS;
  });
}

export function chooseCardOffer(
  tiers: CardTiers,
  buildings: Pick<BuildingEntity, 'hp' | 'max'>[],
  lastSelectedCard: CardKey | null,
  lastOfferedCards: CardKey[] = [],
  random = Math.random,
): CardDefinition[] {
  const offense = eligibleCards('offenseMobility', tiers, buildings, lastSelectedCard);
  const defense = eligibleCards('survivalVillage', tiers, buildings, lastSelectedCard);
  const available = [...offense, ...defense];
  if (available.length <= 2) {
    return available;
  }
  const pick = (cards: CardDefinition[]) => cards[Math.floor(random() * cards.length)];
  let offer: CardDefinition[];
  if (offense.length && defense.length) {
    offer = [pick(offense), pick(defense)];
  } else {
    const first = pick(available);
    offer = [first, pick(available.filter((card) => card.key !== first.key))];
  }
  const previous = [...lastOfferedCards].sort().join('|');
  if (offer.map((card) => card.key).sort().join('|') === previous) {
    const alternatives = available.filter((card) => !offer.some((offered) => offered.key === card.key));
    if (alternatives.length) {
      offer = [offer[0], pick(alternatives)];
    }
  }
  return offer.filter((card, index) => offer.findIndex((other) => other.key === card.key) === index).slice(0, 2);
}

export function getWaveBudget(level: number): number {
  if (level <= WAVE_BUDGETS.length) {
    return WAVE_BUDGETS[Math.max(0, level - 1)];
  }
  return WAVE_BUDGETS[WAVE_BUDGETS.length - 1] + (level - WAVE_BUDGETS.length) * 6;
}

export function getAvailableEnemyRoles(heroClass: HeroClass, level: number): EnemyRoleKey[] {
  return ENEMY_ARCHETYPES
    .filter((enemy) => ENEMY_UNLOCK_LEVELS[heroClass][enemy.key] <= level)
    .map((enemy) => enemy.key);
}

export function buildWaveRoster(heroClass: HeroClass, level: number, random = Math.random): EnemyRoleKey[] {
  let remaining = getWaveBudget(level);
  const available = ENEMY_ARCHETYPES.filter((enemy) => ENEMY_UNLOCK_LEVELS[heroClass][enemy.key] <= level);
  const roster: EnemyRoleKey[] = [];
  while (remaining > 0) {
    const affordable = available.filter((enemy) => enemy.cost <= remaining);
    if (!affordable.length) {
      roster.push('sproutling');
      remaining -= 1;
      continue;
    }
    const totalWeight = affordable.reduce((sum, enemy) => sum + enemy.weight, 0);
    let roll = random() * totalWeight;
    let selected = affordable[0];
    for (const enemy of affordable) {
      roll -= enemy.weight;
      if (roll <= 0) {
        selected = enemy;
        break;
      }
    }
    roster.push(selected.key);
    remaining -= selected.cost;
  }
  return roster;
}
