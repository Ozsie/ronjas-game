import { describe, expect, it } from 'vitest';
import { doorById } from './area';
import { INITIAL_AREA_ID, createAreaCollisionEnv, getArea } from './areas';
import {
  RESTAURANT_FIXTURES,
  RESTAURANT_STATIONS,
} from './areas/restaurant/area';
import { STREET_FIXTURES } from './areas/street/area';
import {
  FOREST_DECORATIONS,
  FOREST_DECORATION_KINDS,
  FOREST_TREES,
  FOREST_TREE_KINDS,
} from './areas/forest/area';
import { STRANGE_MAN } from './areas/street/actors/strangeMan/actor';
import { DOOR, SOLID, TREE, isSolidCell, tileAt } from './tilemap';
import { moveAabb } from '../engine/physics';

const AREA_IDS = [INITIAL_AREA_ID, 'street', 'forest'];

const findTreeGroves = (rows: string[]) => {
  const remaining = new Set(
    rows.flatMap((row, cellY) =>
      [...row].flatMap((cell, cellX) =>
        cell === TREE ? [`${cellX},${cellY}`] : [],
      ),
    ),
  );
  const groves: { cellX: number; cellY: number }[][] = [];

  while (remaining.size > 0) {
    const firstCell = remaining.values().next().value;
    if (firstCell === undefined) break;

    const [cellX, cellY] = firstCell.split(',').map(Number);
    const queue = [{ cellX: cellX ?? 0, cellY: cellY ?? 0 }];
    const grove: { cellX: number; cellY: number }[] = [];
    remaining.delete(firstCell);

    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      if (!cell) continue;
      grove.push(cell);

      for (const [offsetX, offsetY] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const neighborX = cell.cellX + (offsetX ?? 0);
        const neighborY = cell.cellY + (offsetY ?? 0);
        const neighborKey = `${neighborX},${neighborY}`;
        if (!remaining.delete(neighborKey)) continue;
        queue.push({ cellX: neighborX, cellY: neighborY });
      }
    }

    groves.push(grove);
  }

  return groves;
};

describe('area content invariants', () => {
  it('starts in the restaurant with an exit to the street', () => {
    const restaurant = getArea(INITIAL_AREA_ID);
    expect(restaurant.id).toBe('restaurant');
    expect(restaurant.doors[0]?.targetAreaId).toBe('street');
  });

  it('resolves every registered area', () => {
    for (const id of AREA_IDS) {
      expect(getArea(id).id).toBe(id);
    }
    expect(() => getArea('unknown')).toThrow(/unknown area/);
  });

  it('has uniformly rectangular rows in every area', () => {
    for (const id of AREA_IDS) {
      const { rows } = getArea(id).tilemap;
      const width = rows[0].length;
      rows.forEach((row) => expect(row.length).toBe(width));
    }
  });

  it('gives the forest a 100 by 100 graybox layout', () => {
    const { rows } = getArea('forest').tilemap;
    expect(rows).toHaveLength(100);
    rows.forEach((row) => expect(row).toHaveLength(100));
  });

  it('covers contiguous forest tree areas with solid tree fixtures', () => {
    const forest = getArea('forest');
    const treeGroves = findTreeGroves(forest.tilemap.rows);
    const treeCells = treeGroves.flatMap((grove) =>
      grove.map(({ cellX, cellY }) => `${cellX},${cellY}`),
    );
    const treeFixtureCells = new Set(
      FOREST_TREES.map(({ cellX, cellY }) => `${cellX},${cellY}`),
    );

    expect(treeGroves).toHaveLength(4);
    expect(
      [...treeFixtureCells].every((cell) => treeCells.includes(cell)),
    ).toBe(true);
    expect(new Set(FOREST_TREES.map(({ kind }) => kind))).toEqual(
      new Set(FOREST_TREE_KINDS),
    );
    treeGroves.forEach((grove) => {
      const treeCount = grove.filter(({ cellX, cellY }) =>
        treeFixtureCells.has(`${cellX},${cellY}`),
      ).length;
      expect(treeCount).toBe(Math.max(1, Math.floor(grove.length / 2)));
    });
    FOREST_TREES.forEach(({ cellX, cellY }) => {
      expect(isSolidCell(forest.tilemap, cellX, cellY)).toBe(true);
    });
  });

  it('scatters forest decorations across walkable cells away from the entrance', () => {
    const forest = getArea('forest');
    expect(FOREST_DECORATIONS).toHaveLength(144);
    expect(
      new Set(FOREST_DECORATIONS.map(({ cellX, cellY }) => `${cellX},${cellY}`))
        .size,
    ).toBe(FOREST_DECORATIONS.length);
    expect(new Set(FOREST_DECORATIONS.map(({ kind }) => kind))).toEqual(
      new Set(FOREST_DECORATION_KINDS),
    );
    FOREST_DECORATIONS.forEach(({ cellX, cellY }) => {
      expect(isSolidCell(forest.tilemap, cellX, cellY)).toBe(false);
      expect(tileAt(forest.tilemap, cellX, cellY)).not.toBe(TREE);
      expect(tileAt(forest.tilemap, cellX, cellY)).not.toBe(DOOR);
      expect(
        Math.hypot(cellX - forest.spawnCell.x, cellY - forest.spawnCell.y),
      ).toBeGreaterThan(3);
    });
  });

  it('marks every door cell with the door token', () => {
    for (const id of AREA_IDS) {
      const area = getArea(id);
      area.doors.forEach((door) => {
        expect(tileAt(area.tilemap, door.cellX, door.cellY)).toBe(DOOR);
      });
    }
  });

  it('keeps light positions on open cells', () => {
    for (const id of AREA_IDS) {
      const area = getArea(id);
      area.lights.forEach((light) => {
        expect(
          isSolidCell(area.tilemap, light.position.x, light.position.y),
        ).toBe(false);
      });
    }
  });

  it('spawns the player on walkable ground', () => {
    for (const id of AREA_IDS) {
      const area = getArea(id);
      const { x, y } = area.spawnCell;
      expect(isSolidCell(area.tilemap, x, y)).toBe(false);
      expect(tileAt(area.tilemap, x, y)).not.toBe(DOOR);
    }
  });

  it('keeps dining and kitchen fixtures and opening stations on walkable cells', () => {
    const restaurant = getArea(INITIAL_AREA_ID);
    const collisionEnv = createAreaCollisionEnv(restaurant);
    expect(
      RESTAURANT_FIXTURES.filter((fixture) => fixture.kind === 'table'),
    ).toHaveLength(4);
    expect(collisionEnv.obstacles?.slice(0, 4)).toMatchObject([
      { x: 92, y: 284, halfWidth: 30, halfHeight: 18 },
      { x: 188, y: 284, halfWidth: 30, halfHeight: 18 },
      { x: 92, y: 380, halfWidth: 30, halfHeight: 18 },
      { x: 188, y: 380, halfWidth: 30, halfHeight: 18 },
    ]);
    expect(RESTAURANT_FIXTURES.map((fixture) => fixture.kind)).toEqual(
      expect.arrayContaining([
        'kitchen-range',
        'reach-in-fridge',
        'vending-machine',
        'trash-bin',
      ]),
    );
    for (const fixture of RESTAURANT_FIXTURES) {
      const collision = 'collision' in fixture ? fixture.collision : undefined;
      const expectedX =
        (fixture.cellX + 0.5) * restaurant.tilemap.cellSize +
        (collision && 'offsetX' in collision ? collision.offsetX : 0);
      const expectedY =
        (fixture.cellY + 0.5) * restaurant.tilemap.cellSize +
        (collision && 'offsetY' in collision ? collision.offsetY : 0);
      expect(
        isSolidCell(restaurant.tilemap, fixture.cellX, fixture.cellY),
      ).toBe(false);
      const hasObstacle = collisionEnv.obstacles?.some(
        (obstacle) => obstacle.x === expectedX && obstacle.y === expectedY,
      );
      expect(hasObstacle).toBe(Boolean(collision));
    }
    for (const station of Object.values(RESTAURANT_STATIONS)) {
      expect(isSolidCell(restaurant.tilemap, station.x, station.y)).toBe(false);
      expect(collisionEnv.isSolidCell(station.x, station.y)).toBe(false);
    }

    const movement = moveAabb(
      { x: 40, y: 284, halfWidth: 8, halfHeight: 8 },
      48,
      0,
      collisionEnv,
    );
    expect(movement).toMatchObject({ x: 54, hitX: true });
    expect(collisionEnv.obstacles).toHaveLength(10);
  });

  it('dresses the street as a parking lot beside the restaurant exit', () => {
    const street = getArea('street');
    const collisionEnv = createAreaCollisionEnv(street);
    expect(
      STREET_FIXTURES.filter((fixture) => fixture.kind === 'car'),
    ).toHaveLength(3);
    expect(
      STREET_FIXTURES.find((fixture) => fixture.kind === 'trash-can'),
    ).toMatchObject({ cellX: 2, cellY: 7 });
    for (const fixture of STREET_FIXTURES) {
      expect(isSolidCell(street.tilemap, fixture.cellX, fixture.cellY)).toBe(
        false,
      );
      expect(collisionEnv.isSolidCell(fixture.cellX, fixture.cellY)).toBe(
        false,
      );
    }
    expect(
      isSolidCell(street.tilemap, STRANGE_MAN.cellX, STRANGE_MAN.cellY),
    ).toBe(false);
    expect(STRANGE_MAN).toMatchObject({
      id: 'street-person',
      halfExtents: { halfWidth: 8, halfHeight: 6 },
      characterId: 'maintenance-worker',
      displayName: 'Strange Man',
    });
  });

  it('connects the street north door to the placeholder forest', () => {
    const street = getArea('street');
    const forest = getArea('forest');
    const northDoor = street.doors.find((door) => door.id === 'forest-door');

    expect(northDoor?.cellY).toBe(0);
    expect(northDoor?.targetAreaId).toBe('forest');
    expect(forest.doors[0]?.targetAreaId).toBe('street');
    expect(forest.doors[0]).toMatchObject({
      cellX: 50,
      cellY: 99,
      spawnCell: { x: 50, y: 98 },
    });
    expect(STRANGE_MAN).toMatchObject({ cellX: 2, cellY: 10 });
  });

  it('lands arrivals inside the area, never back onto the door cell', () => {
    for (const id of AREA_IDS) {
      const area = getArea(id);
      area.doors.forEach((door) => {
        expect(
          isSolidCell(area.tilemap, door.spawnCell.x, door.spawnCell.y),
        ).toBe(false);
        expect(
          door.spawnCell.x === door.cellX && door.spawnCell.y === door.cellY,
        ).toBe(false);
      });
    }
  });

  it('lands arrivals immediately inside their door', () => {
    for (const id of AREA_IDS) {
      const area = getArea(id);
      area.doors.forEach((door) => {
        const distance =
          Math.abs(door.spawnCell.x - door.cellX) +
          Math.abs(door.spawnCell.y - door.cellY);
        expect(distance).toBe(1);
      });
    }
  });

  it('links every door to an existing door that links back', () => {
    for (const id of AREA_IDS) {
      const area = getArea(id);
      area.doors.forEach((door) => {
        const target = getArea(door.targetAreaId);
        const targetDoor = doorById(target, door.targetDoorId);
        expect(targetDoor.targetAreaId).toBe(area.id);
        expect(targetDoor.targetDoorId).toBe(door.id);
      });
    }
  });

  it('uses the grid package wall token for solid tiles', () => {
    expect(SOLID).toBe('#');
  });
});
