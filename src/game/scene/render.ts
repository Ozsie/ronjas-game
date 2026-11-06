// The renderer adapter: the isometric paint cores (the projection, the
// screen mapping, the painter-sorted world frame, the additive light
// pass) live in @hoard-engine/scene; this module prepares their view
// models — the tilemap rows, tokens and world palette into the world
// view, entities into actor views — and resolves the animated lights
// against @hoard-engine/lighting's polygon engine before handing them
// over. Colors are game content (world palette), not theme tokens; UI
// chrome later uses @hoard-engine/uikit with the theme.
import {
  ISO_CULL_PAD_PX,
  drawIsoLights,
  drawIsoWorldFrame,
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
// the feet position is the entity center.
const actorView = (entity: Entity, color?: string): SceneIsoActorView => ({
  feet: { x: entity.x, y: entity.y },
  halfWidth: entity.halfWidth,
  halfHeight: entity.halfHeight,
  color: color ?? WORLD_PALETTE.player,
  shadowColor: WORLD_PALETTE.entityShadow,
});

// One full world pass: scene draws the dark base, floor diamonds and
// the painter-sorted queue of wall prisms and actors.
export const drawWorldFrame = (
  ctx: CanvasRenderingContext2D,
  map: Tilemap,
  view: SceneIsoView,
  actors: Array<{ entity: Entity; color?: string }>,
): void => {
  drawIsoWorldFrame(
    ctx,
    isoWorldView(map),
    view,
    actors.map(({ entity, color }) => actorView(entity, color)),
  );
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
