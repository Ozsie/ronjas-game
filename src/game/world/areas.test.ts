import { describe, expect, it } from 'vitest';
import { doorById } from './area';
import {
  INITIAL_AREA_ID,
  RESTAURANT_FIXTURES,
  RESTAURANT_STATIONS,
  STREET_FIXTURES,
  STREET_PERSON,
  getArea,
} from './areas';
import { DOOR, SOLID, isSolidCell, tileAt } from './tilemap';

const AREA_IDS = [INITIAL_AREA_ID, 'street', 'forest'];

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
    expect(
      RESTAURANT_FIXTURES.filter((fixture) => fixture.kind === 'table'),
    ).toHaveLength(4);
    for (const fixture of RESTAURANT_FIXTURES) {
      expect(
        isSolidCell(restaurant.tilemap, fixture.cellX, fixture.cellY),
      ).toBe(false);
    }
    for (const station of Object.values(RESTAURANT_STATIONS)) {
      expect(isSolidCell(restaurant.tilemap, station.x, station.y)).toBe(false);
    }
  });

  it('dresses the street as a parking lot beside the restaurant exit', () => {
    const street = getArea('street');
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
    }
    expect(
      isSolidCell(street.tilemap, STREET_PERSON.cellX, STREET_PERSON.cellY),
    ).toBe(false);
  });

  it('connects the street north door to the placeholder forest', () => {
    const street = getArea('street');
    const forest = getArea('forest');
    const northDoor = street.doors.find((door) => door.id === 'forest-door');

    expect(northDoor?.cellY).toBe(0);
    expect(northDoor?.targetAreaId).toBe('forest');
    expect(forest.doors[0]?.targetAreaId).toBe('street');
    expect(forest.doors[0]?.spawnCell).toEqual({ x: 3, y: 6 });
    expect(STREET_PERSON).toEqual({ cellX: 2, cellY: 10 });
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
