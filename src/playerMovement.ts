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

export interface ScreenMovementCandidate {
  label: 'intent' | 'horizontal-slide' | 'vertical-slide';
  screen: MovementPoint;
  iso: MovementPoint;
  position: MovementPoint;
  accepted: boolean;
}

export interface ScreenMovementResolution extends MovementResolution {
  intendedScreen: MovementPoint;
  intendedIso: MovementPoint;
  selectedScreen: MovementPoint | null;
  selectedIso: MovementPoint | null;
  candidates: ScreenMovementCandidate[];
  reason: string | null;
}

export interface EscapeProbeResult {
  escaped: boolean;
  position: MovementPoint;
  stepsMoved: number;
  visibleDistance: number;
}

export const SCREEN_CARDINAL_DIRECTIONS: Record<string, MovementPoint> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

export const SCREEN_ESCAPE_DIRECTIONS: Record<string, MovementPoint> = {
  ...SCREEN_CARDINAL_DIRECTIONS,
  'UP-LEFT': { x: -1, y: -1 },
  'UP-RIGHT': { x: 1, y: -1 },
  'DOWN-LEFT': { x: -1, y: 1 },
  'DOWN-RIGHT': { x: 1, y: 1 },
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

const getScreenCandidateVectors = (
  intendedScreen: MovementPoint,
  previousSlideScreen: MovementPoint | null,
) => {
  const candidates: Array<{ label: ScreenMovementCandidate['label']; screen: MovementPoint }> = [
    { label: 'intent', screen: intendedScreen },
  ];
  const allowsSliding = Math.abs(intendedScreen.x) > 0.01 && Math.abs(intendedScreen.y) > 0.01;
  if (!allowsSliding) {
    return candidates;
  }
  const slides: Array<{ label: ScreenMovementCandidate['label']; screen: MovementPoint }> = [
    { label: 'horizontal-slide', screen: { x: intendedScreen.x, y: 0 } },
    { label: 'vertical-slide', screen: { x: 0, y: intendedScreen.y } },
  ];
  slides.sort((a, b) => {
    const previousAlignment = (candidate: MovementPoint) => previousSlideScreen
      ? candidate.x * previousSlideScreen.x + candidate.y * previousSlideScreen.y
      : 0;
    const alignmentDifference = previousAlignment(b.screen) - previousAlignment(a.screen);
    if (Math.abs(alignmentDifference) > 0.001) {
      return alignmentDifference;
    }
    const intendedAlignment = (candidate: MovementPoint) => (
      candidate.x * intendedScreen.x + candidate.y * intendedScreen.y
    );
    return intendedAlignment(b.screen) - intendedAlignment(a.screen);
  });
  return [...candidates, ...slides];
};

export const resolveScreenSpacePlayerMovement = (
  current: MovementPoint,
  intendedScreen: MovementPoint,
  metrics: MovementProjectionMetrics,
  distance: number,
  canOccupy: (point: MovementPoint) => boolean,
  previousSlideScreen: MovementPoint | null = null,
): ScreenMovementResolution => {
  const candidates = getScreenCandidateVectors(intendedScreen, previousSlideScreen)
    .map(({ label, screen }) => {
      const iso = screenDirectionToIsoMovement(screen, metrics);
      const position = {
        x: current.x + iso.x * distance,
        y: current.y + iso.y * distance,
      };
      return { label, screen, iso, position, accepted: canOccupy(position) };
    });
  const chosen = candidates.find((candidate) => candidate.accepted);
  if (chosen) {
    return {
      position: chosen.position,
      moved: chosen.position.x !== current.x || chosen.position.y !== current.y,
      blocked: false,
      intendedScreen,
      intendedIso: candidates[0].iso,
      selectedScreen: chosen.screen,
      selectedIso: chosen.iso,
      candidates,
      reason: chosen.label === 'intent' ? null : chosen.label,
    };
  }
  return {
    position: { ...current },
    moved: false,
    blocked: true,
    intendedScreen,
    intendedIso: candidates[0].iso,
    selectedScreen: null,
    selectedIso: null,
    candidates,
    reason: 'blocked footprint',
  };
};

export const probeScreenSpaceEscape = (
  current: MovementPoint,
  direction: MovementPoint,
  metrics: MovementProjectionMetrics,
  stepDistance: number,
  stepCount: number,
  canOccupy: (point: MovementPoint) => boolean,
): EscapeProbeResult => {
  let position = { ...current };
  let stepsMoved = 0;
  for (let step = 0; step < stepCount; step += 1) {
    const result = resolveScreenSpacePlayerMovement(position, direction, metrics, stepDistance, canOccupy);
    if (!result.moved) {
      break;
    }
    position = result.position;
    stepsMoved += 1;
  }
  const isoDisplacement = { x: position.x - current.x, y: position.y - current.y };
  const screenDisplacement = projectIsoMovementToScreen(isoDisplacement, metrics);
  const visibleDistance = Math.hypot(screenDisplacement.x, screenDisplacement.y);
  return {
    escaped: stepsMoved === stepCount && visibleDistance > 0,
    position,
    stepsMoved,
    visibleDistance,
  };
};
