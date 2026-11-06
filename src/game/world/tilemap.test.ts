import { describe, expect, it } from 'vitest';
import {
  DOOR,
  cellCenter,
  createCollisionEnv,
  createTilemap,
  isDoorCell,
  isSolidCell,
  mapHeightCells,
  mapWidthCells,
  mapWidthPx,
  SOLID,
  tileAt,
} from './tilemap';

const ROWS = ['###', '#D#', '###'];

describe('tilemap', () => {
  const map = createTilemap(ROWS, 32);

  it('reports cell and pixel dimensions', () => {
    expect(mapWidthCells(map)).toBe(3);
    expect(mapHeightCells(map)).toBe(3);
    expect(mapWidthPx(map)).toBe(96);
  });

  it('reports solidity from the row characters', () => {
    expect(isSolidCell(map, 1, 1)).toBe(false);
    expect(isSolidCell(map, 0, 0)).toBe(true);
    expect(isSolidCell(map, 4, 4)).toBe(false); // out of bounds: no solid
  });

  it('marks solidity with the grid package wall token', () => {
    expect(SOLID).toBe('#');
  });

  it('treats door cells as walkable markers', () => {
    expect(tileAt(map, 1, 1)).toBe(DOOR);
    expect(isDoorCell(map, 1, 1)).toBe(true);
    expect(isSolidCell(map, 1, 1)).toBe(false);
    expect(isDoorCell(map, 0, 0)).toBe(false);
  });

  it('computes cell centers in world pixels', () => {
    expect(cellCenter(map, 1, 1)).toEqual({ x: 48, y: 48 });
  });

  it('provides the collision contract physics consumes', () => {
    const env = createCollisionEnv(map);
    expect(env.cellSize).toBe(32);
    expect(env.isSolidCell(0, 0)).toBe(true);
    expect(env.isSolidCell(1, 1)).toBe(false);
  });
});
