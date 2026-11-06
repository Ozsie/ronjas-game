// A realtime world entity: continuous position and velocity in world
// pixels, plus the AABB half-extents physics sweeps against the tilemap.
// Deliberately minimal — entities carry no rendering or AI knowledge;
// behavior modules own their own entity kinds (player, enemy, ...) and
// extend this shape structurally, like the HOARD packages' contract types.
export type Entity = {
  id: string;
  // Center position, world pixels.
  x: number;
  y: number;
  // Velocity, pixels per second.
  vx: number;
  vy: number;
  // AABB half-extents, world pixels.
  halfWidth: number;
  halfHeight: number;
};

export const createEntity = (
  id: string,
  position: { x: number; y: number },
  halfExtents: { halfWidth: number; halfHeight: number },
): Entity => ({
  id,
  x: position.x,
  y: position.y,
  vx: 0,
  vy: 0,
  halfWidth: halfExtents.halfWidth,
  halfHeight: halfExtents.halfHeight,
});
