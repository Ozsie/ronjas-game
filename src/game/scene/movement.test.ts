import { describe, expect, it } from 'vitest';
import { createIsoProjection, worldToIsoPlane } from '@hoard-engine/scene';
import {
  isTouchRunDistance,
  worldMovementForInput,
  worldMovementForScreenDirection,
} from './movement';

describe('isometric movement', () => {
  it('uses touch distance beyond one cell to request running', () => {
    expect(isTouchRunDistance(31, 32)).toBe(false);
    expect(isTouchRunDistance(32, 32)).toBe(false);
    expect(isTouchRunDistance(33, 32)).toBe(true);
  });

  it('moves at the same projected speed in every direction', () => {
    const projection = createIsoProjection(32);
    const projectedSpeed = (horizontal: number, vertical: number) => {
      const direction = worldMovementForInput(projection, horizontal, vertical);
      const projected = worldToIsoPlane(projection, direction.x, direction.y);
      return Math.hypot(projected.x, projected.y);
    };

    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const;
    const speeds = directions.map(([horizontal, vertical]) =>
      projectedSpeed(horizontal, vertical),
    );

    for (const speed of speeds) {
      expect(speed).toBeCloseTo(1);
    }
  });

  it('moves down-left parallel to an isometric cell edge', () => {
    const direction = worldMovementForInput(createIsoProjection(32), -1, 1);

    expect(direction.x).toBeCloseTo(0);
    expect(direction.y).toBeGreaterThan(0);
  });

  it('normalizes pointer movement in projected space', () => {
    const projection = createIsoProjection(32);
    const direction = worldMovementForScreenDirection(projection, -1, 0.5);
    const projected = worldToIsoPlane(projection, direction.x, direction.y);

    expect(Math.hypot(projected.x, projected.y)).toBeCloseTo(1);
  });
});
