// The lighting adapter: maps the game's tilemap into the lighting
// package's `LightingEnv` contract — every piece of world knowledge is
// one of these three callbacks. `occlusionKeyFor` is the caller's token
// for "anything that can change occlusion changed": it is derived from
// the tile rows, so a static map yields a constant key and the package's
// polygon cache stays warm; open a door by mutating rows and the key (and
// the caches) invalidate.
import { LightOcclusion, type LightingEnv } from '@hoard-engine/lighting';
import type { Tilemap } from '../world/tilemap';
import { isSolidCell } from '../world/tilemap';

export const createLightingEnv = (map: Tilemap): LightingEnv => ({
  gridWidth: Math.max(...map.rows.map((row) => row.length)),
  gridHeight: map.rows.length,
  cellOcclusion: (x, y) =>
    isSolidCell(map, x, y) ? LightOcclusion.OPAQUE : LightOcclusion.OPEN,
  // Walls block at the shared edge, like drakriddarna's wall edges; solid
  // destinations stop the ray at the boundary.
  isStepBlocked: (from, to) =>
    isSolidCell(map, to.x, to.y) || isSolidCell(map, from.x, from.y),
  // Room regions: one region until areas define rooms (gas lights and
  // room-scoped effects will need real room characters here).
  roomOf: () => 'world',
});

export const occlusionKeyFor = (map: Tilemap): string =>
  `${map.cellSize}:${map.rows.join('|')}`;
