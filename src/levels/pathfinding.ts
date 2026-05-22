import type { GridPoint } from './levelTypes';

const keyFor = (point: GridPoint) => `${point.x},${point.y}`;

const heuristic = (point: GridPoint, goals: GridPoint[]) => (
  goals.reduce((best, goal) => Math.min(best, Math.abs(point.x - goal.x) + Math.abs(point.y - goal.y)), Infinity)
);

const getNeighbors = (point: GridPoint, width: number, height: number) => [
  { x: point.x + 1, y: point.y },
  { x: point.x - 1, y: point.y },
  { x: point.x, y: point.y + 1 },
  { x: point.x, y: point.y - 1 },
].filter((candidate) => (
  candidate.x >= 0 && candidate.y >= 0 && candidate.x < width && candidate.y < height
));

export const findGridPath = (
  walkableGrid: boolean[][],
  start: GridPoint,
  goals: GridPoint[],
) => {
  if (!goals.length) {
    return null;
  }

  const height = walkableGrid.length;
  const width = walkableGrid[0]?.length ?? 0;
  const goalKeys = new Set(goals.map(keyFor));
  const open: GridPoint[] = [start];
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[keyFor(start), 0]]);
  const fScore = new Map<string, number>([[keyFor(start), heuristic(start, goals)]]);

  while (open.length > 0) {
    open.sort((a, b) => (fScore.get(keyFor(a)) ?? Infinity) - (fScore.get(keyFor(b)) ?? Infinity));
    const current = open.shift();
    if (!current) {
      break;
    }
    const currentKey = keyFor(current);
    if (goalKeys.has(currentKey)) {
      const path = [current];
      let cursor = currentKey;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor) ?? cursor;
        const [x, y] = cursor.split(',').map(Number);
        path.unshift({ x, y });
      }
      return path;
    }

    getNeighbors(current, width, height).forEach((neighbor) => {
      if (!walkableGrid[neighbor.y]?.[neighbor.x]) {
        return;
      }
      const neighborKey = keyFor(neighbor);
      const tentativeScore = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentativeScore >= (gScore.get(neighborKey) ?? Infinity)) {
        return;
      }
      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeScore);
      fScore.set(neighborKey, tentativeScore + heuristic(neighbor, goals));
      if (!open.some((candidate) => candidate.x === neighbor.x && candidate.y === neighbor.y)) {
        open.push(neighbor);
      }
    });
  }

  return null;
};

export const pathCost = (path: GridPoint[] | null) => (path ? Math.max(0, path.length - 1) : Infinity);
