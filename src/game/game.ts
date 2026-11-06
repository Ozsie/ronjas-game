// The composition root — the only module that knows how the parts
// connect (the HOARD rule: leaves never know who calls them). This file
// wires input → movement → physics → camera → rendering, owns the player
// entity and the player-carried light, owns the current area (travel is
// swapping it: rebuild the per-area contracts, land at the target
// door's spawn cell) and owns the canvas lifecycle for the Svelte
// component.
import { createCamera, updateCamera } from '@hoard-engine/camera';
import { createEntity, type Entity } from './engine/entity';
import {
  createInputHarness,
  InputAction,
  type InputHarness,
} from './engine/input';
import { createLoop, type LoopHandle } from './engine/loop';
import { moveAabb, type CollisionEnv } from './engine/physics';
import { createLight, type LightSource } from '@hoard-engine/lighting';
import {
  createIsoProjection,
  createIsoView,
  screenDirectionToWorld,
  type IsoProjection,
} from '@hoard-engine/scene';
import { seedRun } from './rng';
import { createLightingEnv, occlusionKeyFor } from './scene/lightingEnv';
import {
  drawLights,
  drawRestaurantFixtures,
  drawStreetFixtures,
  drawWorldFrame,
} from './scene/render';
import {
  drawIntroOverlay,
  drawSkipButton,
  isSkipButtonHit,
  skipButtonBounds,
} from './intro';
import { createOpeningState, skipOpening, updateOpening } from './opening';
import {
  doorAtCell,
  arrivalPosition,
  type Area,
  type AreaDoor,
} from './world/area';
import {
  INITIAL_AREA_ID,
  RESTAURANT_FIXTURES,
  RESTAURANT_STATIONS,
  STREET_FIXTURES,
  STREET_PERSON,
  getArea,
} from './world/areas';
import { cellCenter, createCollisionEnv } from './world/tilemap';
import type { LightingEnv } from '@hoard-engine/lighting';
import {
  CAMERA_LAG_PER_SECOND,
  MOVE_SPEED_PX_PER_S,
  PLAYER_HALF_EXTENTS,
} from './world/world';

export type GameHandle = {
  dispose: () => void;
};

export type GameOptions = {
  seed?: number;
};

// The player-carried light: follows the player at fractional cell
// coordinates (the lighting package's polygon cache is keyed by light
// geometry, so a moving light recomputes instead of serving a stale
// entry).
const playerLightAt = (player: Entity, cellSize: number): LightSource =>
  createLight(player.x / cellSize - 0.5, player.y / cellSize - 0.5, undefined, {
    id: 'player-light',
    color: '#BFE8FF',
    radius: 5,
    intensity: 0.32,
  });

export const createGame = (
  canvas: HTMLCanvasElement,
  options: GameOptions = {},
): GameHandle => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('createGame: 2d context unavailable');
  }

  seedRun(options.seed ?? 1);

  // The current area and its per-area contracts; travel swaps all of
  // them together.
  let currentArea: Area = getArea(INITIAL_AREA_ID);
  let collisionEnv: CollisionEnv = createCollisionEnv(currentArea.tilemap);
  let lightingEnv: LightingEnv = createLightingEnv(currentArea.tilemap);
  let occlusionKey = occlusionKeyFor(currentArea.tilemap);
  // One shared projection per area: input mapping and rendering must
  // agree.
  let projection: IsoProjection = createIsoProjection(
    currentArea.tilemap.cellSize,
  );

  const spawn = cellCenter(
    currentArea.tilemap,
    currentArea.spawnCell.x,
    currentArea.spawnCell.y,
  );
  const player = createEntity('player', spawn, PLAYER_HALF_EXTENTS);
  const streetPerson = createEntity(
    'street-person',
    cellCenter(
      getArea('street').tilemap,
      STREET_PERSON.cellX,
      STREET_PERSON.cellY,
    ),
    { halfWidth: 8, halfHeight: 6 },
  );
  let camera = createCamera(player.x, player.y);
  const opening = createOpeningState(currentArea.tilemap, RESTAURANT_STATIONS);

  const input: InputHarness = createInputHarness();
  const handOffToPlayer = (): void => {
    player.x = opening.ronja.x;
    player.y = opening.ronja.y;
    player.vx = 0;
    player.vy = 0;
    camera = createCamera(player.x, player.y);
    input.clear();
  };
  const skipIntro = (): void => {
    skipOpening(opening, currentArea.tilemap, RESTAURANT_STATIONS);
    handOffToPlayer();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!opening.complete) {
      if (event.code === 'Escape') skipIntro();
      return;
    }
    input.handleKeyDown(event);
  };
  const onKeyUp = (event: KeyboardEvent): void => input.handleKeyUp(event);
  const onPointerDown = (event: PointerEvent): void => {
    if (
      !opening.complete &&
      isSkipButtonHit(
        skipButtonBounds(canvas.width),
        event.offsetX,
        event.offsetY,
      )
    ) {
      event.preventDefault();
      skipIntro();
    }
  };
  const onResize = (): void => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', onResize);
  onResize();

  // Leaves the current area through the door the player stands in: the
  // player lands at the target door's spawn cell (one cell inside the
  // target area, so arrival never immediately re-triggers travel).
  const travelThrough = (door: AreaDoor): void => {
    const target = getArea(door.targetAreaId);
    const arrival = arrivalPosition(target, door.targetDoorId);
    currentArea = target;
    collisionEnv = createCollisionEnv(target.tilemap);
    lightingEnv = createLightingEnv(target.tilemap);
    occlusionKey = occlusionKeyFor(target.tilemap);
    projection = createIsoProjection(target.tilemap.cellSize);
    player.x = arrival.x;
    player.y = arrival.y;
    player.vx = 0;
    player.vy = 0;
    camera = createCamera(player.x, player.y);
  };

  const update = (stepMs: number): void => {
    if (!opening.complete) {
      updateOpening(
        opening,
        stepMs,
        currentArea.tilemap,
        RESTAURANT_STATIONS,
        collisionEnv,
      );
      const focus = opening.customer
        ? {
            x: (opening.ronja.x + opening.customer.x) / 2,
            y: (opening.ronja.y + opening.customer.y) / 2,
          }
        : {
            x: (opening.ronja.x + player.x) / 2,
            y: (opening.ronja.y + player.y) / 2,
          };
      camera = updateCamera(
        camera,
        focus.x,
        focus.y,
        CAMERA_LAG_PER_SECOND,
        stepMs,
      );
      if (opening.complete) {
        handOffToPlayer();
      }
      player.vx = 0;
      player.vy = 0;
      return;
    }
    // Held-input velocity sampled per step, so the player never moves
    // faster at a higher frame rate; walls stop movement flush (the
    // zeroed velocity marks a blocked axis for wall-slide feedback).
    // Controls are screen-relative: the held screen direction maps
    // through the projection to a world-plane unit vector first, so
    // "up" on the keyboard moves screen-up under the iso projection.
    const screenDirX =
      (input.isHeld(InputAction.RIGHT) ? 1 : 0) -
      (input.isHeld(InputAction.LEFT) ? 1 : 0);
    const screenDirY =
      (input.isHeld(InputAction.DOWN) ? 1 : 0) -
      (input.isHeld(InputAction.UP) ? 1 : 0);
    const worldDir = screenDirectionToWorld(projection, screenDirX, screenDirY);
    const dtS = stepMs / 1000;
    const move = moveAabb(
      player,
      worldDir.x * MOVE_SPEED_PX_PER_S * dtS,
      worldDir.y * MOVE_SPEED_PX_PER_S * dtS,
      collisionEnv,
    );
    player.vx = move.hitX ? 0 : worldDir.x * MOVE_SPEED_PX_PER_S;
    player.vy = move.hitY ? 0 : worldDir.y * MOVE_SPEED_PX_PER_S;
    player.x = move.x;
    player.y = move.y;
    camera = updateCamera(
      camera,
      player.x,
      player.y,
      CAMERA_LAG_PER_SECOND,
      stepMs,
    );
    // Standing in a door cell travels through it.
    const cellSize = currentArea.tilemap.cellSize;
    const door = doorAtCell(
      currentArea,
      Math.floor(player.x / cellSize),
      Math.floor(player.y / cellSize),
    );
    if (door) {
      travelThrough(door);
    }
  };

  // Rendering receives wall-clock visual time for the animated light
  // effects; the simulation steps stay deterministic from the loop's
  // accumulator. The light pass runs after the frame so floors, walls
  // and actors all catch the glow.
  const renderScene = (): void => {
    const cellSize = currentArea.tilemap.cellSize;
    const view = createIsoView(
      camera,
      canvas.width,
      canvas.height,
      cellSize,
      projection,
    );
    const actors = opening.complete
      ? [
          { entity: player },
          ...(currentArea.id === 'street'
            ? [{ entity: streetPerson, color: '#75838A' }]
            : []),
        ]
      : [
          { entity: opening.ronja, color: '#FFD45E' },
          ...(opening.customer
            ? [{ entity: opening.customer, color: '#F27B57' }]
            : []),
        ];
    drawWorldFrame(ctx, currentArea.tilemap, view, actors);
    if (currentArea.id === INITIAL_AREA_ID) {
      drawRestaurantFixtures(ctx, view, cellSize, RESTAURANT_FIXTURES);
    }
    if (currentArea.id === 'street') {
      drawStreetFixtures(ctx, view, cellSize, STREET_FIXTURES);
    }
    const lightCarrier = opening.complete ? player : opening.ronja;
    drawLights(
      ctx,
      [...currentArea.lights, playerLightAt(lightCarrier, cellSize)],
      lightingEnv,
      occlusionKey,
      cellSize,
      view,
      performance.now(),
    );
    if (opening.dialogue && !opening.complete) {
      drawIntroOverlay(ctx, canvas.width, canvas.height, opening.dialogue);
    }
    if (!opening.complete) drawSkipButton(ctx, canvas.width);
  };

  const loop: LoopHandle & { frame: (elapsedMs: number) => void } = createLoop({
    update,
    render: () => renderScene(),
  });
  loop.start();

  return {
    dispose: () => {
      loop.stop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
      input.clear();
    },
  };
};
