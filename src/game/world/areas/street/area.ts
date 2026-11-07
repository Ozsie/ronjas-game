import { createLight, type LightSource } from '@hoard-engine/lighting';
import type { Area } from '../../area';
import { createTilemap } from '../../tilemap';

const CELL_SIZE = 32;

// The parking lot outside the restaurant. Its west entrance links back
// to the restaurant door, and its north exit leads into the forest.
const STREET_ROWS = [
  '#...........D...........',
  '#.......................',
  '#.......................',
  '#.......................',
  '#.......................',
  '#.......................',
  '#.......................',
  '#.......................',
  'D.......................',
  '#.......................',
  '#.......................',
  '#.......................',
  '#.......................',
  '#.......................',
  '#.......................',
  '#.......................',
];

export const STREET_FIXTURES = [
  { kind: 'car', cellX: 6, cellY: 4, color: '#B74632' },
  { kind: 'car', cellX: 12, cellY: 5, color: '#54727A' },
  { kind: 'car', cellX: 18, cellY: 11, color: '#D6B450' },
  { kind: 'trash-can', cellX: 2, cellY: 7 },
] as const;

const streetLights: LightSource[] = [
  createLight(3, 7, undefined, {
    id: 'street-lamp',
    color: '#FFD36B',
    radius: 4,
    intensity: 0.32,
  }),
];

export const STREET_AREA: Area = {
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
    {
      id: 'forest-door',
      cellX: 12,
      cellY: 0,
      targetAreaId: 'forest',
      targetDoorId: 'street-entry',
      spawnCell: { x: 12, y: 1 },
    },
  ],
  lights: streetLights,
};
