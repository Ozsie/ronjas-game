import { isoPlaneToWorld, type IsoProjection } from '@hoard-engine/scene';

export const isTouchRunDistance = (
  distance: number,
  cellSize: number,
): boolean => distance > cellSize;

export const worldMovementForScreenDirection = (
  projection: IsoProjection,
  screenX: number,
  screenY: number,
): { x: number; y: number } => {
  const length = Math.hypot(screenX, screenY);
  if (length === 0) return { x: 0, y: 0 };

  return isoPlaneToWorld(projection, screenX / length, screenY / length);
};

export const worldMovementForInput = (
  projection: IsoProjection,
  horizontal: number,
  vertical: number,
): { x: number; y: number } =>
  worldMovementForScreenDirection(
    projection,
    horizontal * projection.ax,
    vertical * projection.by,
  );
