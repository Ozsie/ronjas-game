// The area model: a playable map is a tilemap plus the doors that
// connect it to other areas, its entry points and its lights. Areas are
// data — the composition root (game.ts) owns travel between them, the
// engine modules (physics, lighting, rendering) only ever see one area's
// tilemap.
import type { LightSource } from '@hoard-engine/lighting';
import type { AreaFeatureFactory } from './areaFeatures';
import { cellCenter } from './tilemap';
import type { Tilemap } from './tilemap';

// A door in an area: a walkable gap cell in its tilemap that connects to
// a door in another area. `spawnCell` is where a traveler arriving at
// this door lands — authored content, and deliberately a cell *inside*
// the area so arrival never immediately re-triggers travel out through
// the same door.
export type AreaDoor = {
  id: string;
  cellX: number;
  cellY: number;
  targetAreaId: string;
  targetDoorId: string;
  spawnCell: { x: number; y: number };
};

// One playable map: its tilemap, the doors leading out, the cell where
// new games (and area-first visits) spawn, and its light stage dressing.
export type Area = {
  id: string;
  tilemap: Tilemap;
  doors: AreaDoor[];
  spawnCell: { x: number; y: number };
  lights: LightSource[];
  features?: readonly AreaFeatureFactory[];
};

// The door whose cell contains the given position, if the player is
// standing in one.
export const doorAtCell = (
  area: Area,
  cellX: number,
  cellY: number,
): AreaDoor | undefined =>
  area.doors.find((door) => door.cellX === cellX && door.cellY === cellY);

// The door with the given id; unknown ids are content errors.
export const doorById = (area: Area, doorId: string): AreaDoor => {
  const door = area.doors.find((candidate) => candidate.id === doorId);
  if (!door) {
    throw new Error(`area '${area.id}' has no door '${doorId}'`);
  }
  return door;
};

// The world-pixel position a traveler lands on when arriving at
// `doorId`: the door's authored spawn cell, centered.
export const arrivalPosition = (
  area: Area,
  doorId: string,
): { x: number; y: number } => {
  const door = doorById(area, doorId);
  return cellCenter(area.tilemap, door.spawnCell.x, door.spawnCell.y);
};
