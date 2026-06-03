export interface MovementInputState {
  left?: boolean;
  right?: boolean;
  up?: boolean;
  down?: boolean;
  a?: boolean;
  d?: boolean;
  w?: boolean;
  s?: boolean;
  joystickVisible?: boolean;
  joystickVector?: { x: number; y: number };
}

export function normalizeMovementVector(vector: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(vector.x, vector.y);
  if (len <= 1) {
    return vector;
  }
  return { x: vector.x / len, y: vector.y / len };
}

export function getScreenMovementVector(input: MovementInputState): { x: number; y: number } {
  let dx = 0;
  let dy = 0;
  if (input.left || input.a) {
    dx -= 1;
  }
  if (input.right || input.d) {
    dx += 1;
  }
  if (input.up || input.w) {
    dy -= 1;
  }
  if (input.down || input.s) {
    dy += 1;
  }
  if (input.joystickVisible && input.joystickVector) {
    dx += input.joystickVector.x;
    dy += input.joystickVector.y;
  }
  return normalizeMovementVector({ x: dx, y: dy });
}

export function canTriggerPhaseAction(
  phase: string,
  action: 'start' | 'levelUpChoice' | 'restart',
): boolean {
  if (action === 'start') {
    return phase === 'splash';
  }
  if (action === 'levelUpChoice') {
    return phase === 'levelUp';
  }
  return phase === 'gameOver';
}
