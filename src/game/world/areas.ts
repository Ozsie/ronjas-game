// The area content and registry. Areas are data (see world/area.ts):
// each area's doors link to a door in another area, and travel is the
// composition root swapping the current area. New areas are added here —
// the content invariant test fails on broken links, unreachable spawns
// or ragged rows before any agent trips over them in gameplay.
import {
  LightEffect,
  createLight,
  type LightSource,
} from '@hoard-engine/lighting';
import type { Area } from './area';
import { createTilemap } from './tilemap';

const CELL_SIZE = 32;

// Ronja starts behind the counter in the restaurant; the exit opens onto
// the street. The counter and restaurant fixtures are graybox geometry.
const RESTAURANT_ROWS = [
  '########################',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#.........############.#',
  '#......................#',
  '#......................D',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '########################',
];

export const RESTAURANT_FIXTURES = [
  { kind: 'table', cellX: 3, cellY: 9 },
  { kind: 'table', cellX: 6, cellY: 9 },
  { kind: 'table', cellX: 3, cellY: 12 },
  { kind: 'table', cellX: 6, cellY: 12 },
  { kind: 'register', cellX: 12, cellY: 5 },
  { kind: 'pickup', cellX: 16, cellY: 5 },
  { kind: 'ice-cream-machine', cellX: 20, cellY: 5 },
] as const;

export const RESTAURANT_STATIONS = {
  register: { x: 12, y: 4 },
  pickup: { x: 16, y: 4 },
  iceCreamMachine: { x: 20, y: 4 },
  customerStop: { x: 12, y: 7 },
  customerDoor: { x: 22, y: 8 },
} as const;

// A quiet stretch of sidewalk outside the restaurant. Its west entrance
// links back to the restaurant door.
const STREET_ROWS = [
  '########################',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  'D......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '########################',
];

const restaurantLights: LightSource[] = [
  createLight(5, 5, undefined, {
    id: 'restaurant-counter-light',
    color: '#FFD36B',
    radius: 7,
    intensity: 0.48,
  }),
  createLight(16, 8, undefined, {
    id: 'restaurant-exit-light',
    color: '#FFB957',
    radius: 5,
    intensity: 0.38,
    effect: LightEffect.FLICKER,
    rate: 1.2,
  }),
];

const streetLights: LightSource[] = [
  createLight(3, 7, undefined, {
    id: 'street-lamp',
    color: '#FFD36B',
    radius: 4,
    intensity: 0.32,
  }),
];

const restaurant: Area = {
  id: 'restaurant',
  tilemap: createTilemap(RESTAURANT_ROWS, CELL_SIZE),
  spawnCell: { x: 8, y: 12 },
  doors: [
    {
      id: 'front-door',
      cellX: 23,
      cellY: 8,
      targetAreaId: 'street',
      targetDoorId: 'restaurant-door',
      spawnCell: { x: 22, y: 8 },
    },
  ],
  lights: restaurantLights,
};

const street: Area = {
  id: 'street',
  tilemap: createTilemap(STREET_ROWS, CELL_SIZE),
  spawnCell: { x: 2, y: 8 },
  doors: [
    {
      id: 'restaurant-door',
      cellX: 0,
      cellY: 8,
      targetAreaId: 'restaurant',
      targetDoorId: 'front-door',
      spawnCell: { x: 1, y: 8 },
    },
  ],
  lights: streetLights,
};

// The registry. New areas register here by adding one entry.
const AREAS: Record<string, Area> = {
  restaurant,
  street,
};

export const INITIAL_AREA_ID = 'restaurant';

// Resolves an area id; unknown ids are content errors, not runtime
// states to handle silently.
export const getArea = (areaId: string): Area => {
  const area = AREAS[areaId];
  if (!area) {
    throw new Error(`unknown area '${areaId}'`);
  }
  return area;
};
