import type { Area } from '../../area';
import { createTilemap } from '../../tilemap';

const CELL_SIZE = 32;

// A deliberately empty forest graybox; its south door is the only authored
// feature until the forest layout is designed.
const FOREST_ROWS = [
  '########',
  '#......#',
  '#......#',
  '#......#',
  '#......#',
  '#......#',
  '#......#',
  '###D####',
];

export const FOREST_AREA: Area = {
  id: 'forest',
  tilemap: createTilemap(FOREST_ROWS, CELL_SIZE),
  spawnCell: { x: 3, y: 6 },
  doors: [
    {
      id: 'street-entry',
      cellX: 3,
      cellY: 7,
      targetAreaId: 'street',
      targetDoorId: 'forest-door',
      spawnCell: { x: 3, y: 6 },
    },
  ],
  lights: [],
};
