import {
  LightEffect,
  createLight,
  type LightSource,
} from '@hoard-engine/lighting';
import type { Area } from '../../area';
import { createCollisionEnv, createTilemap } from '../../tilemap';
import { createOpeningFeature } from './openingFeature';

export { RESTAURANT_STATIONS } from './stations';

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
  {
    kind: 'table',
    cellX: 3,
    cellY: 9,
    collision: { offsetX: -20, offsetY: -20, halfWidth: 30, halfHeight: 18 },
  },
  {
    kind: 'table',
    cellX: 6,
    cellY: 9,
    collision: { offsetX: -20, offsetY: -20, halfWidth: 30, halfHeight: 18 },
  },
  {
    kind: 'table',
    cellX: 3,
    cellY: 12,
    collision: { offsetX: -20, offsetY: -20, halfWidth: 30, halfHeight: 18 },
  },
  {
    kind: 'table',
    cellX: 6,
    cellY: 12,
    collision: { offsetX: -20, offsetY: -20, halfWidth: 30, halfHeight: 18 },
  },
  {
    kind: 'kitchen-range',
    cellX: 10,
    cellY: 1,
    collision: { halfWidth: 12, halfHeight: 10 },
  },
  {
    kind: 'kitchen-range',
    cellX: 11,
    cellY: 1,
    collision: { halfWidth: 12, halfHeight: 10 },
  },
  {
    kind: 'reach-in-fridge',
    cellX: 14,
    cellY: 1,
    collision: { halfWidth: 10, halfHeight: 12 },
  },
  {
    kind: 'reach-in-fridge',
    cellX: 16,
    cellY: 1,
    collision: { halfWidth: 10, halfHeight: 12 },
  },
  {
    kind: 'vending-machine',
    cellX: 4,
    cellY: 1,
    collision: { halfWidth: 10, halfHeight: 12 },
  },
  {
    kind: 'trash-bin',
    cellX: 8,
    cellY: 15,
    collision: { halfWidth: 7, halfHeight: 7 },
  },
  { kind: 'register', cellX: 12, cellY: 5 },
  { kind: 'pickup', cellX: 16, cellY: 5 },
  { kind: 'ice-cream-machine', cellX: 20, cellY: 5 },
] as const;

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

export const RESTAURANT_AREA: Area = {
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
  features: [createOpeningFeature],
};

export const createRestaurantCollisionEnv = (area: Area) =>
  createCollisionEnv(
    area.tilemap,
    [],
    RESTAURANT_FIXTURES.flatMap((fixture) => {
      if (!('collision' in fixture)) return [];
      const collision = fixture.collision;
      const offsetX = 'offsetX' in collision ? collision.offsetX : 0;
      const offsetY = 'offsetY' in collision ? collision.offsetY : 0;
      return [
        {
          x: (fixture.cellX + 0.5) * area.tilemap.cellSize + offsetX,
          y: (fixture.cellY + 0.5) * area.tilemap.cellSize + offsetY,
          halfWidth: collision.halfWidth,
          halfHeight: collision.halfHeight,
        },
      ];
    }),
  );
