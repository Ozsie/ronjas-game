import {
  spriteClipFrameAt,
  type SpriteClipSource,
  type SpriteManifestClip,
} from '@hoard-engine/scene';

export const CHARACTER_IDS = [
  'barista',
  'resident',
  'office-worker',
  'courier',
  'maintenance-worker',
  'rogue',
  'vampire-count',
  'vampire-countess',
  'blood-alchemist',
] as const;

export type CharacterId = (typeof CHARACTER_IDS)[number];

export const CUSTOMER_CHARACTER_IDS = [
  'resident',
  'office-worker',
  'courier',
] as const satisfies readonly CharacterId[];

export type CharacterDirection = 'south' | 'east' | 'north' | 'west';
export type CharacterAction = 'idle' | 'walk';

// One action's atlas: the sheet image the manifest's clips reference
// and the clip for each facing, resolved from the character's
// Godot-style manifest (aligned.json or animation.json) at load time.
// Until the manifest has been fetched the clips stay empty and actors
// render with the placeholder fallback.
export type CharacterActionSprites = {
  image: HTMLImageElement;
  clips: Partial<Record<CharacterDirection, SpriteManifestClip>>;
};

export type CharacterSpriteSheets = {
  idle: CharacterActionSprites;
  walk: CharacterActionSprites;
  cell?: readonly [number, number];
  pivot?: readonly [number, number];
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

export const characterAtlasReady = (atlas: CharacterActionSprites): boolean =>
  atlas.image.complete && atlas.image.naturalWidth > 0;

// The frame to draw for an action facing at the animation time,
// resolved from the manifest clip's authored frame rects and
// durations, with the pivot/cell that anchor it — the clip's own
// values over the manifest's. Clips without authored pivots anchor
// at the bottom center of their frame; a character without a clip
// for the action and facing has no frame to draw and renders with
// the placeholder fallback.
export type CharacterSpriteDraw = {
  image: HTMLImageElement;
  source: SpriteClipSource;
  pivot: readonly [number, number];
  cell: readonly [number, number];
};

export const characterSpriteDraw = (
  sheets: CharacterSpriteSheets,
  action: CharacterAction,
  direction: CharacterDirection,
  timeMs: number,
): CharacterSpriteDraw | undefined => {
  const atlas = sheets[action];
  const clip = atlas.clips[direction];
  if (!clip) return undefined;
  const source = spriteClipFrameAt(clip, timeMs);
  if (!source) return undefined;
  const cell: readonly [number, number] = clip.cell ??
    sheets.cell ?? [source.sw, source.sh];
  const pivot: readonly [number, number] = clip.pivot ??
    sheets.pivot ?? [cell[0] / 2, cell[1]];
  return { image: atlas.image, source, pivot, cell };
};
