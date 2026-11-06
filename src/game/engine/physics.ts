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
  obstacles?: ReadonlyArray<Aabb>;
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

const overlaps = (minA: number, maxA: number, minB: number, maxB: number) =>
  maxA > minB + EPS && minA < maxB - EPS;

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

const obstacleX = (box: Aabb, dx: number, env: CollisionEnv): number | null => {
  let nearest: number | null = null;
  for (const obstacle of env.obstacles ?? []) {
    if (
      !overlaps(
        box.y - box.halfHeight,
        box.y + box.halfHeight,
        obstacle.y - obstacle.halfHeight,
        obstacle.y + obstacle.halfHeight,
      )
    ) {
      continue;
    }
    if (dx > 0) {
      const edge = obstacle.x - obstacle.halfWidth;
      if (
        box.x + box.halfWidth <= edge + EPS &&
        box.x + box.halfWidth + dx > edge + EPS &&
        (nearest === null || edge < nearest)
      ) {
        nearest = edge;
      }
    } else {
      const edge = obstacle.x + obstacle.halfWidth;
      if (
        box.x - box.halfWidth >= edge - EPS &&
        box.x - box.halfWidth + dx < edge - EPS &&
        (nearest === null || edge > nearest)
      ) {
        nearest = edge;
      }
    }
  }
  return nearest;
};

const obstacleY = (box: Aabb, dy: number, env: CollisionEnv): number | null => {
  let nearest: number | null = null;
  for (const obstacle of env.obstacles ?? []) {
    if (
      !overlaps(
        box.x - box.halfWidth,
        box.x + box.halfWidth,
        obstacle.x - obstacle.halfWidth,
        obstacle.x + obstacle.halfWidth,
      )
    ) {
      continue;
    }
    if (dy > 0) {
      const edge = obstacle.y - obstacle.halfHeight;
      if (
        box.y + box.halfHeight <= edge + EPS &&
        box.y + box.halfHeight + dy > edge + EPS &&
        (nearest === null || edge < nearest)
      ) {
        nearest = edge;
      }
    } else {
      const edge = obstacle.y + obstacle.halfHeight;
      if (
        box.y - box.halfHeight >= edge - EPS &&
        box.y - box.halfHeight + dy < edge - EPS &&
        (nearest === null || edge > nearest)
      ) {
        nearest = edge;
      }
    }
  }
  return nearest;
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
  let blockColumn: number | null = null;
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
  const solidEdge =
    blockColumn === null
      ? null
      : dx > 0
        ? blockColumn * env.cellSize
        : (blockColumn + 1) * env.cellSize;
  const shapeEdge = obstacleX(box, dx, env);
  const edge =
    solidEdge === null
      ? shapeEdge
      : shapeEdge === null
        ? solidEdge
        : dx > 0
          ? Math.min(solidEdge, shapeEdge)
          : Math.max(solidEdge, shapeEdge);
  if (edge === null) return { x: box.x + dx, hitX: false };
  return {
    x: dx > 0 ? edge - box.halfWidth : edge + box.halfWidth,
    hitX: true,
  };
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
  let blockRow: number | null = null;
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
  const solidEdge =
    blockRow === null
      ? null
      : dy > 0
        ? blockRow * env.cellSize
        : (blockRow + 1) * env.cellSize;
  const shapeEdge = obstacleY(box, dy, env);
  const edge =
    solidEdge === null
      ? shapeEdge
      : shapeEdge === null
        ? solidEdge
        : dy > 0
          ? Math.min(solidEdge, shapeEdge)
          : Math.max(solidEdge, shapeEdge);
  if (edge === null) return { y: box.y + dy, hitY: false };
  return {
    y: dy > 0 ? edge - box.halfHeight : edge + box.halfHeight,
    hitY: true,
  };
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
