import type { Area } from '../../area';
import { createTilemap, TREE } from '../../tilemap';

const CELL_SIZE = 32;
const FOREST_SIZE = 100;
const FOREST_DOOR_X = Math.floor(FOREST_SIZE / 2);

const TREE_GROVES = [
  { centerX: 18, centerY: 18, radiusX: 5, radiusY: 8 },
  { centerX: 82, centerY: 18, radiusX: 5, radiusY: 8 },
  { centerX: 18, centerY: 69, radiusX: 5, radiusY: 8 },
  { centerX: 82, centerY: 69, radiusX: 5, radiusY: 8 },
];

const isTreeCell = (cellX: number, cellY: number): boolean =>
  TREE_GROVES.some(({ centerX, centerY, radiusX, radiusY }) => {
    const dx = (cellX - centerX) / radiusX;
    const dy = (cellY - centerY) / radiusY;
    return dx * dx + dy * dy <= 1;
  });

const treeCellsInGrove = (grove: (typeof TREE_GROVES)[number]) => {
  const cells: { cellX: number; cellY: number }[] = [];
  for (
    let cellY = grove.centerY - grove.radiusY;
    cellY <= grove.centerY + grove.radiusY;
    cellY += 1
  ) {
    for (
      let cellX = grove.centerX - grove.radiusX;
      cellX <= grove.centerX + grove.radiusX;
      cellX += 1
    ) {
      const dx = (cellX - grove.centerX) / grove.radiusX;
      const dy = (cellY - grove.centerY) / grove.radiusY;
      if (dx * dx + dy * dy <= 1) cells.push({ cellX, cellY });
    }
  }
  return cells;
};

const createSeededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

export const FOREST_TREE_KINDS = [
  'forked_birch_sapling_with_a_black_bark_band',
  'linden_tree_with_heart_shaped_leaves',
  'pine_sapling_with_a_bent_tip',
  'sycamore_tree_with_a_thick_trunk',
  'walnut_tree_with_a_broad_crown',
  'young_apple_tree_with_red_apples',
] as const;

export type ForestTreeKind = (typeof FOREST_TREE_KINDS)[number];

export type ForestTree = {
  kind: ForestTreeKind;
  cellX: number;
  cellY: number;
};

const FOREST_ROWS = Array.from({ length: FOREST_SIZE }, (_, y) =>
  Array.from({ length: FOREST_SIZE }, (_, x) => {
    if (y === FOREST_SIZE - 1 && x === FOREST_DOOR_X) return 'D';
    return isTreeCell(x, y) ? TREE : '.';
  }).join(''),
);

export const FOREST_TREES: ForestTree[] = [];
const treeRandom = createSeededRandom(0x7ee12345);
TREE_GROVES.forEach((grove) => {
  const cells = treeCellsInGrove(grove);
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(treeRandom() * (index + 1));
    const currentCell = cells[index];
    const swapCell = cells[swapIndex];
    if (!currentCell || !swapCell) continue;
    cells[index] = swapCell;
    cells[swapIndex] = currentCell;
  }

  const treeCount = Math.max(1, Math.floor(cells.length / 2));
  cells.slice(0, treeCount).forEach(({ cellX, cellY }) => {
    const kindIndex = Math.floor(treeRandom() * FOREST_TREE_KINDS.length);
    FOREST_TREES.push({
      kind: FOREST_TREE_KINDS[kindIndex] ?? FOREST_TREE_KINDS[0],
      cellX,
      cellY,
    });
  });
});

export const FOREST_DECORATION_KINDS = [
  'bracken_clump_with_drooping_fronds',
  'brown_mushroom_with_a_forked_cap',
  'clump_of_cattails_with_brown_seed_heads',
  'cluster_of_mustard_mushrooms_with_funnel_caps',
  'tall_pampas_grass_clump_with_cream_plumes',
] as const;

export type ForestDecorationKind = (typeof FOREST_DECORATION_KINDS)[number];

export type ForestDecoration = {
  kind: ForestDecorationKind;
  cellX: number;
  cellY: number;
};

const decorationRandom = createSeededRandom(0x5eed1234);
const decorationCells = Array.from({ length: FOREST_SIZE }, (_, cellY) =>
  Array.from({ length: FOREST_SIZE }, (_, cellX) => ({ cellX, cellY })),
)
  .flat()
  .filter(
    ({ cellX, cellY }) =>
      !isTreeCell(cellX, cellY) &&
      Math.hypot(cellX - FOREST_DOOR_X, cellY - (FOREST_SIZE - 2)) > 3,
  );
const shuffledDecorationCells = [...decorationCells];
for (let index = shuffledDecorationCells.length - 1; index > 0; index -= 1) {
  const swapIndex = Math.floor(decorationRandom() * (index + 1));
  const currentCell = shuffledDecorationCells[index];
  const swapCell = shuffledDecorationCells[swapIndex];
  if (!currentCell || !swapCell) continue;
  shuffledDecorationCells[index] = swapCell;
  shuffledDecorationCells[swapIndex] = currentCell;
}

export const FOREST_DECORATIONS: ForestDecoration[] = Array.from(
  { length: Math.min(144, shuffledDecorationCells.length) },
  (_, index) => index,
)
  .slice(0, 144)
  .map((index) => {
    const { cellX, cellY } = shuffledDecorationCells[index] ?? {
      cellX: 0,
      cellY: 0,
    };
    return {
      kind:
        FOREST_DECORATION_KINDS[
          Math.floor(decorationRandom() * FOREST_DECORATION_KINDS.length)
        ] ?? FOREST_DECORATION_KINDS[0],
      cellX,
      cellY,
    };
  });

export const FOREST_AREA: Area = {
  id: 'forest',
  tilemap: createTilemap(FOREST_ROWS, CELL_SIZE),
  spawnCell: { x: FOREST_DOOR_X, y: FOREST_SIZE - 2 },
  doors: [
    {
      id: 'street-entry',
      cellX: FOREST_DOOR_X,
      cellY: FOREST_SIZE - 1,
      targetAreaId: 'street',
      targetDoorId: 'forest-door',
      spawnCell: { x: FOREST_DOOR_X, y: FOREST_SIZE - 2 },
    },
  ],
  lights: [],
};
