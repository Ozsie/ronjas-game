import { describe, expect, it } from 'vitest';
import { doorAtCell, doorById, arrivalPosition } from './area';
import type { Area } from './area';
import { createTilemap } from './tilemap';

const rows = ['#####', '#...#', '#D..#', '#...#', '#####'];

const area: Area = {
  id: 'test-area',
  tilemap: createTilemap(rows, 32),
  spawnCell: { x: 2, y: 2 },
  doors: [
    {
      id: 'west-gate',
      cellX: 1,
      cellY: 2,
      targetAreaId: 'other-area',
      targetDoorId: 'east-gate',
      spawnCell: { x: 2, y: 2 },
    },
  ],
  lights: [],
};

describe('doorAtCell', () => {
  it('finds the door containing the player cell', () => {
    expect(doorAtCell(area, 1, 2)?.id).toBe('west-gate');
  });

  it('returns undefined on ordinary cells', () => {
    expect(doorAtCell(area, 2, 2)).toBeUndefined();
    expect(doorAtCell(area, 0, 0)).toBeUndefined();
  });
});

describe('doorById', () => {
  it('resolves ids', () => {
    expect(doorById(area, 'west-gate').id).toBe('west-gate');
  });

  it('throws on unknown ids rather than leaving travel dangling', () => {
    expect(() => doorById(area, 'nope')).toThrow(/test-area.*nope/);
  });
});

describe('arrivalPosition', () => {
  it("lands at the door's spawn cell center", () => {
    // Spawn cell (2,2) at cellSize 32 centers at (80, 80).
    expect(arrivalPosition(area, 'west-gate')).toEqual({ x: 80, y: 80 });
  });
});
