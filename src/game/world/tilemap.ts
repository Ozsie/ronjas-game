// The tilemap data layer: plain string rows over the grid package's cell
// tokens, with the solidity query physics and lighting consume. The rows
// are content — areas are authored as string grids, exactly like the
// drakriddarna dungeon layouts.
import { WALL, findCell } from '@hoard-engine/grid';
import type { Aabb, CollisionEnv } from '../engine/physics';

export const FLOOR = '.';
export const SOLID = WALL;
export const TREE = 'T';
// A walkable gap in a wall that connects two areas (see world/area.ts):
// not solid, rendered as a marked tile, triggers travel when the player
// stands in it.
export const DOOR = 'D';

export type Tilemap = {
  rows: string[];
  cellSize: number;
};

export const createTilemap = (rows: string[], cellSize: number): Tilemap => ({
  rows,
  cellSize,
});

export const mapWidthCells = (map: Tilemap): number =>
  Math.max(...map.rows.map((row) => row.length));

export const mapHeightCells = (map: Tilemap): number => map.rows.length;

export const mapWidthPx = (map: Tilemap): number =>
  mapWidthCells(map) * map.cellSize;

export const mapHeightPx = (map: Tilemap): number =>
  mapHeightCells(map) * map.cellSize;

export const tileAt = (map: Tilemap, cellX: number, cellY: number): string =>
  findCell(map.rows, cellX, cellY);

export const isSolidCell = (
  map: Tilemap,
  cellX: number,
  cellY: number,
): boolean => {
  const row = map.rows[cellY];
  if (
    cellX < 0 ||
    cellY < 0 ||
    cellY >= map.rows.length ||
    cellX >= (row?.length ?? 0)
  ) {
    return true;
  }
  const cell = tileAt(map, cellX, cellY);
  return cell === SOLID || cell === TREE;
};

export const isDoorCell = (
  map: Tilemap,
  cellX: number,
  cellY: number,
): boolean => tileAt(map, cellX, cellY) === DOOR;

// The center of a cell in world pixels (entity spawn positions, light
// anchors).
export const cellCenter = (
  map: Tilemap,
  cellX: number,
  cellY: number,
): { x: number; y: number } => ({
  x: (cellX + 0.5) * map.cellSize,
  y: (cellY + 0.5) * map.cellSize,
});

// The collision contract physics sweeps against.
export const createCollisionEnv = (
  map: Tilemap,
  solidCells: ReadonlyArray<{ cellX: number; cellY: number }> = [],
  obstacles: ReadonlyArray<Aabb> = [],
): CollisionEnv => {
  const solidCellKeys = new Set(
    solidCells.map(({ cellX, cellY }) => `${cellX},${cellY}`),
  );
  return {
    cellSize: map.cellSize,
    obstacles,
    isSolidCell: (cellX, cellY) =>
      isSolidCell(map, cellX, cellY) || solidCellKeys.has(`${cellX},${cellY}`),
  };
};
