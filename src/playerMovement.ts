export interface MovementPoint {
  x: number;
  y: number;
}

export interface MovementProjectionMetrics {
  tileW: number;
  tileH: number;
}

export interface MovementResolution {
  position: MovementPoint;
  moved: boolean;
  blocked: boolean;
}

export const SCREEN_CARDINAL_DIRECTIONS: Record<string, MovementPoint> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

export const projectIsoMovementToScreen = (
  movement: MovementPoint,
  metrics: MovementProjectionMetrics,
): MovementPoint => ({
  x: (movement.x - movement.y) * (metrics.tileW / 2),
  y: (movement.x + movement.y) * (metrics.tileH / 2),
});

export const screenDirectionToIsoMovement = (
  direction: MovementPoint,
  metrics: MovementProjectionMetrics,
): MovementPoint => {
  const screenMagnitude = Math.min(1, Math.hypot(direction.x, direction.y));
  if (screenMagnitude === 0) {
    return { x: 0, y: 0 };
  }
  const screenDirection = {
    x: direction.x / Math.hypot(direction.x, direction.y),
    y: direction.y / Math.hypot(direction.x, direction.y),
  };
  const screenDistance = Math.hypot(metrics.tileW / 2, metrics.tileH / 2);
  const screenX = screenDirection.x * screenDistance * screenMagnitude;
  const screenY = screenDirection.y * screenDistance * screenMagnitude;
  return {
    x: screenY / metrics.tileH + screenX / metrics.tileW,
    y: screenY / metrics.tileH - screenX / metrics.tileW,
  };
};

export const resolvePlayerMovement = (
  current: MovementPoint,
  movement: MovementPoint,
  distance: number,
  canOccupy: (point: MovementPoint) => boolean,
): MovementResolution => {
  const fullStep = {
    x: current.x + movement.x * distance,
    y: current.y + movement.y * distance,
  };
  if (canOccupy(fullStep)) {
    const moved = fullStep.x !== current.x || fullStep.y !== current.y;
    return { position: fullStep, moved, blocked: !moved };
  }

  const position = { ...current };
  const nextX = { x: fullStep.x, y: current.y };
  if (canOccupy(nextX)) {
    position.x = nextX.x;
  }
  const nextY = { x: position.x, y: fullStep.y };
  if (canOccupy(nextY)) {
    position.y = nextY.y;
  }
  const moved = position.x !== current.x || position.y !== current.y;
  return { position, moved, blocked: !moved };
};
