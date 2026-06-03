export interface DebugEnemyTarget {
  defeated?: boolean;
  retreating?: boolean;
  target?: { name?: string };
}

export interface DebugRouteScore {
  building: { name: string };
  score: number;
  cost: number;
}

export function getBuildingDebugSummary(buildings: Array<{ name: string; hp: number; max: number }>): string {
  return buildings.length
    ? buildings.map((building) => `${building.name.slice(0, 1)}:${building.hp}/${building.max}`).join(' ')
    : 'none';
}

export function countActiveEnemies(enemies: DebugEnemyTarget[]): number {
  return enemies.filter((enemy) => !enemy.defeated && !enemy.retreating).length;
}

export function getLiveEnemyTargetSummary(enemies: DebugEnemyTarget[]): string {
  const counts = enemies
    .filter((enemy) => !enemy.defeated && !enemy.retreating)
    .reduce<Record<string, number>>((summary, enemy) => {
      const name = enemy.target?.name ?? 'None';
      summary[name] = (summary[name] ?? 0) + 1;
      return summary;
    }, {});
  const entries = Object.entries(counts);
  return entries.length
    ? entries.map(([name, count]) => `${name.slice(0, 3)}:${count}`).join(' ')
    : 'none';
}

export function formatGeneratedRouteDebugSummary(scores: DebugRouteScore[]): string {
  const topScores = scores
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!topScores.length) {
    return 'Routes no reachable targets';
  }
  return topScores.map((choice) => (
    `${choice.building.name.slice(0, 3)} ${Math.round(choice.score)} d${choice.cost}`
  )).join(' | ');
}
