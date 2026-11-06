export const CHARACTER_IDS = [
  'barista',
  'resident',
  'office-worker',
  'courier',
  'maintenance-worker',
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export const CUSTOMER_CHARACTER_IDS = [
  'resident',
  'office-worker',
  'courier',
] as const satisfies readonly CharacterId[];

export type CharacterDirection = 'south' | 'east' | 'north' | 'west';
export type CharacterAction = 'idle' | 'walk';

export type CharacterSpriteSheets = {
  idle: HTMLImageElement;
  walk: HTMLImageElement;
};

const DIRECTION_ROWS: Record<CharacterDirection, number> = {
  south: 0,
  east: 1,
  north: 2,
  west: 3,
};
const DIRECTION_SWITCH_RATIO = 1.25;

export const characterDirectionForMotion = (
  dx: number,
  dy: number,
  idleDirection: CharacterDirection,
): CharacterDirection => {
  if (Math.hypot(dx, dy) <= 0.1) return idleDirection;

  const previousFacingStillFits =
    (idleDirection === 'east' &&
      dx > 0 &&
      Math.abs(dx) * DIRECTION_SWITCH_RATIO >= Math.abs(dy)) ||
    (idleDirection === 'west' &&
      dx < 0 &&
      Math.abs(dx) * DIRECTION_SWITCH_RATIO >= Math.abs(dy)) ||
    (idleDirection === 'south' &&
      dy > 0 &&
      Math.abs(dy) * DIRECTION_SWITCH_RATIO >= Math.abs(dx)) ||
    (idleDirection === 'north' &&
      dy < 0 &&
      Math.abs(dy) * DIRECTION_SWITCH_RATIO >= Math.abs(dx));
  if (previousFacingStillFits) return idleDirection;

  return Math.abs(dx) > Math.abs(dy)
    ? dx > 0
      ? 'east'
      : 'west'
    : dy > 0
      ? 'south'
      : 'north';
};

export const customerCharacterForDay = (dayIndex: number): CharacterId =>
  CUSTOMER_CHARACTER_IDS[dayIndex % CUSTOMER_CHARACTER_IDS.length] ??
  'resident';

export const characterFrame = (
  action: CharacterAction,
  direction: CharacterDirection,
  timeMs: number,
): { sx: number; sy: number; sw: number; sh: number } => {
  const frameDurationMs = action === 'idle' ? 300 : 100;
  const frameCount = action === 'idle' ? 9 : 8;
  const frame = Math.floor(Math.max(timeMs, 0) / frameDurationMs) % frameCount;

  return {
    sx: frame * 64,
    sy: DIRECTION_ROWS[direction] * 64,
    sw: 64,
    sh: 64,
  };
};
