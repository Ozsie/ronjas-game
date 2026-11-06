// The renderer adapter uses @hoard-engine/scene for iso projection,
// screen mapping and light compositing. This module owns the game-specific
// painter queue so walls, fixtures and sprite actors can share depth order.
import {
  ISO_CULL_PAD_PX,
  drawIsoLights,
  isoDepth,
  screenWorldBounds,
  type SceneIsoActorView,
  type SceneIsoLightView,
  type SceneIsoView,
  type SceneIsoWorldView,
  worldToScreen,
} from '@hoard-engine/scene';
import {
  lightCenter,
  lightInViewport,
  lightPolygonFor,
  type LightSource,
  type LightingEnv,
} from '@hoard-engine/lighting';
import type { Entity } from '../engine/entity';
import type { Tilemap } from '../world/tilemap';
import { DOOR, SOLID } from '../world/tilemap';
import { WALL_HEIGHT_PX, WORLD_PALETTE } from './palette';
import {
  characterFrame,
  characterDirectionForMotion,
  type CharacterAction,
  type CharacterDirection,
  type CharacterSpriteSheets,
} from './characters';

// The tilemap as the iso world view model: rows and cell tokens pass
// structurally; palette, extrusion height and tokens are the game's
// content.
export const isoWorldView = (map: Tilemap): SceneIsoWorldView => ({
  rows: map.rows,
  cellSize: map.cellSize,
  wallCell: SOLID,
  doorCell: DOOR,
  wallHeightPx: WALL_HEIGHT_PX,
  palette: WORLD_PALETTE,
});

// An entity as the iso actor view: colors resolved from the palette,
// with its feet at the lower edge of the collision bounds.
const actorView = (entity: Entity, color?: string): SceneIsoActorView => ({
  feet: { x: entity.x, y: entity.y + entity.halfHeight },
  halfWidth: entity.halfWidth,
  halfHeight: entity.halfHeight,
  color: color ?? WORLD_PALETTE.player,
  shadowColor: WORLD_PALETTE.entityShadow,
});

const drawFloorCell = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  cellSize: number,
  cellX: number,
  cellY: number,
  color: string,
): void => {
  const left = cellX * cellSize;
  const top = cellY * cellSize;
  const north = worldToScreen(view, left, top);
  const east = worldToScreen(view, left + cellSize, top);
  const south = worldToScreen(view, left + cellSize, top + cellSize);
  const west = worldToScreen(view, left, top + cellSize);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(north.x, north.y);
  ctx.lineTo(east.x, east.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(west.x, west.y);
  ctx.closePath();
  ctx.fill();
};

const drawWallCell = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  world: SceneIsoWorldView,
  cellX: number,
  cellY: number,
): void => {
  const { cellSize, wallHeightPx, palette } = world;
  const left = cellX * cellSize;
  const top = cellY * cellSize;
  const north = worldToScreen(view, left, top);
  const east = worldToScreen(view, left + cellSize, top);
  const south = worldToScreen(view, left + cellSize, top + cellSize);
  const west = worldToScreen(view, left, top + cellSize);
  const lift = (point: { x: number; y: number }) => ({
    x: point.x,
    y: point.y - wallHeightPx,
  });
  const raisedNorth = lift(north);
  const raisedEast = lift(east);
  const raisedSouth = lift(south);
  const raisedWest = lift(west);

  ctx.fillStyle = palette.wallSouth;
  ctx.beginPath();
  ctx.moveTo(west.x, west.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(raisedSouth.x, raisedSouth.y);
  ctx.lineTo(raisedWest.x, raisedWest.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.wallEast;
  ctx.beginPath();
  ctx.moveTo(south.x, south.y);
  ctx.lineTo(east.x, east.y);
  ctx.lineTo(raisedEast.x, raisedEast.y);
  ctx.lineTo(raisedSouth.x, raisedSouth.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.wallTop;
  ctx.beginPath();
  ctx.moveTo(raisedNorth.x, raisedNorth.y);
  ctx.lineTo(raisedEast.x, raisedEast.y);
  ctx.lineTo(raisedSouth.x, raisedSouth.y);
  ctx.lineTo(raisedWest.x, raisedWest.y);
  ctx.closePath();
  ctx.fill();
};

const directionForActor = (
  entity: Entity,
  view: SceneIsoView,
  idleDirection: CharacterDirection,
): CharacterDirection => {
  const feet = worldToScreen(view, entity.x, entity.y);
  const moving = worldToScreen(
    view,
    entity.x + entity.vx,
    entity.y + entity.vy,
  );
  const dx = moving.x - feet.x;
  const dy = moving.y - feet.y;
  return characterDirectionForMotion(dx, dy, idleDirection);
};

type WorldFixture = {
  kind: string;
  cellX: number;
  cellY: number;
  color?: string;
};

type PainterEntry = { depth: number; draw: () => void };

// One full world pass: floors first, then walls, actors and fixtures in
// the same painter-sorted queue.
export const drawWorldFrame = (
  ctx: CanvasRenderingContext2D,
  map: Tilemap,
  view: SceneIsoView,
  actors: Array<{
    entity: Entity;
    color?: string;
    character?: CharacterSpriteSheets;
    direction?: CharacterDirection;
  }>,
  animationTimeMs = 0,
  actorDirections: Map<string, CharacterDirection> = new Map(),
  fixtures: ReadonlyArray<WorldFixture> = [],
  fixtureKind: 'restaurant' | 'street' | null = null,
): void => {
  const world = isoWorldView(map);
  const bounds = screenWorldBounds(view, world.wallHeightPx + ISO_CULL_PAD_PX);
  const widthCells = Math.max(...world.rows.map((row) => row.length));
  const firstX = Math.max(0, Math.floor(bounds.minX / world.cellSize));
  const lastX = Math.min(
    widthCells - 1,
    Math.ceil(bounds.maxX / world.cellSize),
  );
  const firstY = Math.max(0, Math.floor(bounds.minY / world.cellSize));
  const lastY = Math.min(
    world.rows.length - 1,
    Math.ceil(bounds.maxY / world.cellSize),
  );
  const queue: PainterEntry[] = [];

  ctx.fillStyle = world.palette.background;
  ctx.fillRect(0, 0, view.width, view.height);
  for (let cellY = firstY; cellY <= lastY; cellY += 1) {
    for (let cellX = firstX; cellX <= lastX; cellX += 1) {
      const cell = world.rows[cellY]?.[cellX] ?? '';
      if (cell === world.wallCell) {
        queue.push({
          depth: isoDepth(
            (cellX + 0.5) * world.cellSize,
            (cellY + 0.5) * world.cellSize,
          ),
          draw: () => drawWallCell(ctx, view, world, cellX, cellY),
        });
      } else {
        drawFloorCell(
          ctx,
          view,
          world.cellSize,
          cellX,
          cellY,
          cell === world.doorCell ? world.palette.door : world.palette.floor,
        );
      }
    }
  }

  for (const actor of actors) {
    const { entity, character, color, direction = 'south' } = actor;
    const feet = { x: entity.x, y: entity.y + entity.halfHeight };
    const depth = isoDepth(feet.x, feet.y);
    const spriteReady =
      character?.idle.complete &&
      character.idle.naturalWidth > 0 &&
      character.walk.complete &&
      character.walk.naturalWidth > 0;
    queue.push({
      depth,
      draw: () => {
        if (!spriteReady || !character) {
          const shape = actorView(entity, color);
          const screenFeet = worldToScreen(view, shape.feet.x, shape.feet.y);
          const shadowRadius = Math.max(shape.halfWidth * 1.2, 5);
          ctx.fillStyle = shape.shadowColor;
          ctx.beginPath();
          ctx.ellipse(
            screenFeet.x,
            screenFeet.y,
            shadowRadius,
            shadowRadius / 2,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          const bodyWidth = shape.halfWidth * 1.8;
          const bodyHeight = shape.halfHeight * 2.4;
          ctx.fillStyle = shape.color;
          ctx.fillRect(
            screenFeet.x - bodyWidth / 2,
            screenFeet.y - bodyHeight,
            bodyWidth,
            bodyHeight,
          );
          return;
        }

        const moving = Math.hypot(entity.vx, entity.vy) > 0.1;
        const facing = directionForActor(
          entity,
          view,
          actorDirections.get(entity.id) ?? direction,
        );
        if (moving) actorDirections.set(entity.id, facing);
        const action: CharacterAction = moving ? 'walk' : 'idle';
        const source = characterFrame(action, facing, animationTimeMs);
        const screenFeet = worldToScreen(view, feet.x, feet.y);
        const spriteSize = map.cellSize * 3;
        const pivotX = spriteSize / 2;
        const pivotY = (spriteSize * 50) / 64;

        ctx.fillStyle = WORLD_PALETTE.entityShadow;
        ctx.beginPath();
        ctx.ellipse(
          screenFeet.x,
          screenFeet.y,
          Math.max(entity.halfWidth * 1.2, 5),
          Math.max(entity.halfWidth * 0.6, 2.5),
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.drawImage(
          character[action],
          source.sx,
          source.sy,
          source.sw,
          source.sh,
          screenFeet.x - pivotX,
          screenFeet.y - pivotY,
          spriteSize,
          spriteSize,
        );
      },
    });
  }

  for (const fixture of fixtures) {
    const centerX = (fixture.cellX + 0.5) * world.cellSize;
    const centerY = (fixture.cellY + 0.5) * world.cellSize;
    queue.push({
      depth: isoDepth(centerX, centerY),
      draw: () => {
        if (fixtureKind === 'restaurant') {
          drawRestaurantFixtures(ctx, view, world.cellSize, [fixture]);
        } else if (fixtureKind === 'street') {
          drawStreetFixtures(ctx, view, world.cellSize, [fixture]);
        }
      },
    });
  }

  queue.sort((a, b) => a.depth - b.depth);
  for (const entry of queue) entry.draw();
};

const drawIsoBox = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  x: number,
  y: number,
  width: number,
  depth: number,
  height: number,
  colors: { top: string; south: string; east: string },
): void => {
  const north = worldToScreen(view, x, y);
  const east = worldToScreen(view, x + width, y);
  const south = worldToScreen(view, x + width, y + depth);
  const west = worldToScreen(view, x, y + depth);
  const raised = (point: { x: number; y: number }) => ({
    x: point.x,
    y: point.y - height,
  });
  const raisedEast = raised(east);
  const raisedSouth = raised(south);
  const raisedWest = raised(west);
  const raisedNorth = raised(north);

  ctx.fillStyle = colors.south;
  ctx.beginPath();
  ctx.moveTo(west.x, west.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(raisedSouth.x, raisedSouth.y);
  ctx.lineTo(raisedWest.x, raisedWest.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.east;
  ctx.beginPath();
  ctx.moveTo(south.x, south.y);
  ctx.lineTo(east.x, east.y);
  ctx.lineTo(raisedEast.x, raisedEast.y);
  ctx.lineTo(raisedSouth.x, raisedSouth.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.moveTo(raisedNorth.x, raisedNorth.y);
  ctx.lineTo(raisedEast.x, raisedEast.y);
  ctx.lineTo(raisedSouth.x, raisedSouth.y);
  ctx.lineTo(raisedWest.x, raisedWest.y);
  ctx.closePath();
  ctx.fill();
};

export const drawRestaurantFixtures = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  cellSize: number,
  fixtures: ReadonlyArray<{
    kind: string;
    cellX: number;
    cellY: number;
  }>,
): void => {
  for (const fixture of fixtures) {
    const table = fixture.kind === 'table';
    const size = cellSize * (table ? 0.86 : 0.58);
    const depth = cellSize * (table ? 0.62 : 0.42);
    const x = (fixture.cellX + 0.5) * cellSize - size / 2;
    const y = (fixture.cellY + 0.5) * cellSize - depth / 2;
    const colors =
      fixture.kind === 'register'
        ? { top: '#F6C143', south: '#9B452B', east: '#713222' }
        : fixture.kind === 'pickup'
          ? { top: '#F3E2C2', south: '#B86438', east: '#824127' }
          : fixture.kind === 'ice-cream-machine'
            ? { top: '#DDE4E7', south: '#8E9BA2', east: '#68757B' }
            : { top: '#E8B56C', south: '#8F542C', east: '#63391F' };
    const height = table ? 18 : 23;
    drawIsoBox(ctx, view, x, y, size, depth, height, colors);

    if (!table) {
      const center = worldToScreen(
        view,
        (fixture.cellX + 0.5) * cellSize,
        (fixture.cellY + 0.5) * cellSize,
      );
      const label =
        fixture.kind === 'ice-cream-machine'
          ? 'ICE CREAM'
          : fixture.kind.toUpperCase();
      ctx.fillStyle = '#FFF4D9';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, center.x, center.y - height - 2);
    }
  }
};

export const drawStreetFixtures = (
  ctx: CanvasRenderingContext2D,
  view: SceneIsoView,
  cellSize: number,
  fixtures: ReadonlyArray<{
    kind: string;
    cellX: number;
    cellY: number;
    color?: string;
  }>,
): void => {
  for (const fixture of fixtures) {
    const centerX = (fixture.cellX + 0.5) * cellSize;
    const centerY = (fixture.cellY + 0.5) * cellSize;
    if (fixture.kind === 'car') {
      const width = cellSize * 1.5;
      const depth = cellSize * 0.88;
      const x = centerX - width / 2;
      const y = centerY - depth / 2;
      const bodyColor = fixture.color ?? '#B74632';
      drawIsoBox(ctx, view, x, y, width, depth, 12, {
        top: bodyColor,
        south: '#453B3A',
        east: '#302B2A',
      });
      const cabinWidth = width * 0.52;
      const cabinDepth = depth * 0.68;
      drawIsoBox(
        ctx,
        view,
        centerX - cabinWidth / 2,
        centerY - cabinDepth / 2,
        cabinWidth,
        cabinDepth,
        22,
        { top: '#C8D6D5', south: bodyColor, east: '#714039' },
      );
    } else {
      const width = cellSize * 0.38;
      const depth = cellSize * 0.38;
      const x = centerX - width / 2;
      const y = centerY - depth / 2;
      drawIsoBox(ctx, view, x, y, width, depth, cellSize * 0.62, {
        top: '#6E7778',
        south: '#3E484A',
        east: '#30383A',
      });
      drawIsoBox(
        ctx,
        view,
        x - 1,
        y - 1,
        width + 2,
        depth + 2,
        cellSize * 0.66,
        {
          top: '#8C9695',
          south: '#535C5D',
          east: '#41494A',
        },
      );
    }
  }
};

// The additive light pass: the lighting package computes the animated
// visibility polygons on the world plane, culled against the visible
// bounds; scene projects and fills them. `timeMs` drives the animated
// effects (flicker, sway); it is visual time, so wall clock is fine.
export const drawLights = (
  ctx: CanvasRenderingContext2D,
  lights: LightSource[],
  env: LightingEnv,
  occlusionKey: string,
  cellSize: number,
  view: SceneIsoView,
  timeMs: number,
): void => {
  const bounds = screenWorldBounds(view, WALL_HEIGHT_PX + ISO_CULL_PAD_PX);
  const viewport = {
    x: bounds.minX / cellSize,
    y: bounds.minY / cellSize,
    width: (bounds.maxX - bounds.minX) / cellSize,
    height: (bounds.maxY - bounds.minY) / cellSize,
  };
  const resolved: SceneIsoLightView[] = [];
  for (const light of lights) {
    if (light.enabled === false || !lightInViewport(light, viewport)) continue;
    const polygon = lightPolygonFor(light, env, cellSize, occlusionKey, timeMs);
    if (polygon.length < 3) continue;
    const center = lightCenter(light, cellSize, timeMs);
    resolved.push({
      center: { x: center.x, y: center.y },
      polygon,
      radius: (light.radius ?? 4) * cellSize,
      color: light.color ?? '#ffffff',
      intensity: light.intensity ?? 0.35,
    });
  }
  drawIsoLights(ctx, view, resolved);
};
