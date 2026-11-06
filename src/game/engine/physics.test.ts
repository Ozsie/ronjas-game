import { describe, expect, it } from 'vitest';
import { moveAabb, type CollisionEnv } from './physics';

// A single solid cell at (2, 2) — 32..96 on both axes at cellSize 32.
const solidAt: CollisionEnv = {
  cellSize: 32,
  isSolidCell: (cellX, cellY) => cellX === 2 && cellY === 2,
};

const open: CollisionEnv = {
  cellSize: 32,
  isSolidCell: () => false,
};

const boxAt = (x: number, y: number) => ({
  x,
  y,
  halfWidth: 8,
  halfHeight: 8,
});

describe('moveAabb', () => {
  it('moves freely on open ground', () => {
    const result = moveAabb(boxAt(33, 33), 10, 0, open);
    expect(result).toEqual({ x: 43, y: 33, hitX: false, hitY: false });
  });

  it('snaps flush against a wall moving right', () => {
    // Box center 33 spans 25..41 (cell 1), wall column 2 starts at 64.
    const result = moveAabb(boxAt(33, 80.5), 40, 0, solidAt);
    expect(result.x).toBe(56); // 64 - halfWidth
    expect(result.hitX).toBe(true);
    expect(result.y).toBe(80.5);
  });

  it('snaps flush against a wall moving left', () => {
    // Box center 110 spans 102..118 (cell 3), wall column 2 ends at 96.
    const result = moveAabb(boxAt(110, 80.5), -40, 0, solidAt);
    expect(result.x).toBe(104); // 96 + halfWidth
    expect(result.hitX).toBe(true);
  });

  it('snaps flush against a wall moving down', () => {
    const result = moveAabb(boxAt(80.5, 33), 0, 40, solidAt);
    expect(result.y).toBe(56);
    expect(result.hitY).toBe(true);
  });

  it('slides along a wall when only one axis is blocked', () => {
    // Right into the wall, but also up where it is open: the Y movement
    // completes, the X axis snaps flush.
    const result = moveAabb(boxAt(33, 80.5), 40, -40, solidAt);
    expect(result.x).toBe(56);
    expect(result.y).toBe(40.5);
    expect(result.hitX).toBe(true);
    expect(result.hitY).toBe(false);
  });

  it('leaves a flush box free to move away along the wall face', () => {
    // Starting exactly flush against the wall's left face (x = 56),
    // moving up along the shared face must not report a hit.
    const result = moveAabb(boxAt(56, 80.5), 0, -40, solidAt);
    expect(result).toEqual({ x: 56, y: 40.5, hitX: false, hitY: false });
  });

  it('sweeps against a fine-grained obstacle within an otherwise open tile', () => {
    const env: CollisionEnv = {
      ...open,
      obstacles: [{ x: 80, y: 80, halfWidth: 10, halfHeight: 8 }],
    };

    const result = moveAabb(boxAt(48, 80), 40, 0, env);

    expect(result).toEqual({ x: 62, y: 80, hitX: true, hitY: false });
  });

  it('allows movement through the unused part of a fixture tile', () => {
    const env: CollisionEnv = {
      ...open,
      obstacles: [{ x: 80, y: 80, halfWidth: 10, halfHeight: 8 }],
    };

    const result = moveAabb(boxAt(48, 63), 40, 0, env);

    expect(result).toEqual({ x: 88, y: 63, hitX: false, hitY: false });
  });

  it('sweeps vertically against a fine-grained obstacle', () => {
    const env: CollisionEnv = {
      ...open,
      obstacles: [{ x: 80, y: 80, halfWidth: 10, halfHeight: 8 }],
    };

    const result = moveAabb(boxAt(80, 48), 0, 40, env);

    expect(result).toEqual({ x: 80, y: 64, hitX: false, hitY: true });
  });
});
