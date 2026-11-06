// Continuous AABB movement against a tile grid, axis-separated: the box
// moves along X, snaps flush against the first solid cell it would touch
// (the swept range catches blockers whole cells wide — no tunneling at
// the speeds this game runs), then does the same along Y. The collision
// facts arrive through an injected `CollisionEnv` (the tilemap provides
// one) — this module never learns how tiles are stored, matching the
// HOARD consumer-defined-contract style. Coordinates are world pixels,
// in and out.

export interface CollisionEnv {
  cellSize: number;
  isSolidCell: (cellX: number, cellY: number) => boolean;
}

export type Aabb = {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
};

export type MoveResult = {
  x: number;
  y: number;
  hitX: boolean;
  hitY: boolean;
};

// Half-open cell overlap: an edge exactly on a cell boundary does not
// count as overlapping the next cell, so a box snapped flush against a
// wall stays flush (zero-width contact is not a collision).
const EPS = 1e-9;

const cellRange = (
  min: number,
  max: number,
  cellSize: number,
): { first: number; last: number } => ({
  first: Math.floor((min + EPS) / cellSize),
  last: Math.floor((max - EPS) / cellSize),
});

const columnHasSolid = (
  cellX: number,
  rows: { first: number; last: number },
  env: CollisionEnv,
): boolean => {
  for (let cellY = rows.first; cellY <= rows.last; cellY += 1) {
    if (env.isSolidCell(cellX, cellY)) return true;
  }
  return false;
};

const rowHasSolid = (
  cellY: number,
  columns: { first: number; last: number },
  env: CollisionEnv,
): boolean => {
  for (let cellX = columns.first; cellX <= columns.last; cellX += 1) {
    if (env.isSolidCell(cellX, cellY)) return true;
  }
  return false;
};

// Moves along X across the swept width; returns the landed x and whether
// a wall stopped the axis short of the full move.
const moveX = (
  box: Aabb,
  dx: number,
  env: CollisionEnv,
): { x: number; hitX: boolean } => {
  if (dx === 0) return { x: box.x, hitX: false };
  const sweptLeft = Math.min(box.x - box.halfWidth, box.x + dx - box.halfWidth);
  const sweptRight = Math.max(
    box.x + box.halfWidth,
    box.x + dx + box.halfWidth,
  );
  const columns = cellRange(sweptLeft, sweptRight, env.cellSize);
  const rows = cellRange(
    box.y - box.halfHeight,
    box.y + box.halfHeight,
    env.cellSize,
  );
  // The first blocking column along the travel direction.
  let blockColumn = -1;
  if (dx > 0) {
    for (let c = columns.first; c <= columns.last; c += 1) {
      if (columnHasSolid(c, rows, env)) {
        blockColumn = c;
        break;
      }
    }
  } else {
    for (let c = columns.last; c >= columns.first; c -= 1) {
      if (columnHasSolid(c, rows, env)) {
        blockColumn = c;
        break;
      }
    }
  }
  if (blockColumn < 0) return { x: box.x + dx, hitX: false };
  const snappedX =
    dx > 0
      ? blockColumn * env.cellSize - box.halfWidth
      : (blockColumn + 1) * env.cellSize + box.halfWidth;
  return { x: snappedX, hitX: true };
};

// Moves along Y across the swept height, same nearest-blocker snap.
const moveY = (
  box: Aabb,
  dy: number,
  env: CollisionEnv,
): { y: number; hitY: boolean } => {
  if (dy === 0) return { y: box.y, hitY: false };
  const sweptTop = Math.min(
    box.y - box.halfHeight,
    box.y + dy - box.halfHeight,
  );
  const sweptBottom = Math.max(
    box.y + box.halfHeight,
    box.y + dy + box.halfHeight,
  );
  const rows = cellRange(sweptTop, sweptBottom, env.cellSize);
  const columns = cellRange(
    box.x - box.halfWidth,
    box.x + box.halfWidth,
    env.cellSize,
  );
  let blockRow = -1;
  if (dy > 0) {
    for (let r = rows.first; r <= rows.last; r += 1) {
      if (rowHasSolid(r, columns, env)) {
        blockRow = r;
        break;
      }
    }
  } else {
    for (let r = rows.last; r >= rows.first; r -= 1) {
      if (rowHasSolid(r, columns, env)) {
        blockRow = r;
        break;
      }
    }
  }
  if (blockRow < 0) return { y: box.y + dy, hitY: false };
  const snappedY =
    dy > 0
      ? blockRow * env.cellSize - box.halfHeight
      : (blockRow + 1) * env.cellSize + box.halfHeight;
  return { y: snappedY, hitY: true };
};

// Sweeps the box along dx then dy, returning the landed position and
// per-axis hit flags (for wall-slide, blocked-door feedback).
export const moveAabb = (
  box: Aabb,
  dx: number,
  dy: number,
  env: CollisionEnv,
): MoveResult => {
  const movedX = moveX(box, dx, env);
  const afterX: Aabb = { ...box, x: movedX.x };
  const movedY = moveY(afterX, dy, env);
  return { x: movedX.x, y: movedY.y, hitX: movedX.hitX, hitY: movedY.hitY };
};
