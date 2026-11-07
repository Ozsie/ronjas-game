// The composition root — the only module that knows how the parts
// connect (the HOARD rule: leaves never know who calls them). This file
// wires input → movement → physics → camera → rendering, owns the player
// entity and the player-carried light, owns the current area (travel is
// swapping it: rebuild the per-area contracts, land at the target
// door's spawn cell) and owns the canvas lifecycle for the Svelte
// component.
import { createCamera, updateCamera } from '@hoard-engine/camera';
import { createEntity } from './engine/entity';
import { dialogPanelBounds, isDialogPanelHit } from './dialogView';
import {
  createInputHarness,
  directionTowardPoint,
  InputAction,
  type InputHarness,
  isCollisionDebugToggleKey,
} from './engine/input';
import { createLoop, type LoopHandle } from './engine/loop';
import { moveAabb, type CollisionEnv } from './engine/physics';
import {
  createIsoProjection,
  isoPlaneToWorld,
  screenDirectionToWorld,
  type IsoProjection,
  worldToIsoPlane,
} from '@hoard-engine/scene';
import { seedRun } from './rng';
import { createGameRenderer } from './scene/gameRenderer';
import { createLightingEnv, occlusionKeyFor } from './scene/lightingEnv';
import { isSkipButtonHit, skipButtonBounds } from './intro';
import { createOpeningState, skipOpening, updateOpening } from './opening';
import {
  doorAtCell,
  arrivalPosition,
  type Area,
  type AreaDoor,
} from './world/area';
import {
  INITIAL_AREA_ID,
  createAreaCollisionEnv,
  getArea,
} from './world/areas';
import { RESTAURANT_STATIONS } from './world/areas/restaurant/area';
import { STRANGE_MAN } from './world/areas/street/actors/strangeMan/actor';
import { createStrangeManInteraction } from './world/areas/street/actors/strangeMan/interaction';
import { cellCenter } from './world/tilemap';
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

export const createGame = (
  canvas: HTMLCanvasElement,
  options: GameOptions = {},
): GameHandle => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('createGame: 2d context unavailable');
  }

  seedRun(options.seed ?? 1);
  const renderer = createGameRenderer(canvas, ctx);

  // The current area and its per-area contracts; travel swaps all of
  // them together.
  let currentArea: Area = getArea(INITIAL_AREA_ID);
  let collisionEnv: CollisionEnv = createAreaCollisionEnv(currentArea);
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
    STRANGE_MAN.id,
    cellCenter(getArea('street').tilemap, STRANGE_MAN.cellX, STRANGE_MAN.cellY),
    STRANGE_MAN.halfExtents,
  );
  let camera = createCamera(player.x, player.y);
  const opening = createOpeningState(currentArea.tilemap, RESTAURANT_STATIONS);

  const input: InputHarness = createInputHarness();
  let activeTouchPointerId: number | null = null;
  let touchTarget: { x: number; y: number } | null = null;
  let collisionDebugEnabled = false;
  const strangeManInteraction = createStrangeManInteraction();
  const handOffToPlayer = (): void => {
    player.x = opening.ronja.x;
    player.y = opening.ronja.y;
    player.vx = 0;
    player.vy = 0;
    camera = createCamera(player.x, player.y);
    input.clear();
    touchTarget = null;
  };
  const skipIntro = (): void => {
    skipOpening(opening, currentArea.tilemap, RESTAURANT_STATIONS);
    handOffToPlayer();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (isCollisionDebugToggleKey(event.key, event.repeat)) {
      collisionDebugEnabled = !collisionDebugEnabled;
      event.preventDefault();
      return;
    }
    if (!opening.complete) {
      if (event.code === 'Escape') skipIntro();
      return;
    }
    if (!event.repeat && (event.code === 'KeyE' || event.code === 'Space')) {
      strangeManInteraction.requestUse();
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
      return;
    }
    if (
      opening.complete &&
      event.pointerType === 'touch' &&
      strangeManInteraction.currentDialogue() &&
      isDialogPanelHit(
        dialogPanelBounds(canvas.width, canvas.height),
        event.offsetX,
        event.offsetY,
      )
    ) {
      event.preventDefault();
      strangeManInteraction.requestUse();
      return;
    }
    if (strangeManInteraction.currentDialogue()?.kind === 'conversation')
      return;
    if (!opening.complete || event.pointerType !== 'touch') return;
    if (activeTouchPointerId !== null) return;
    event.preventDefault();
    activeTouchPointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    updateTouchTarget(event);
  };
  const updateTouchTarget = (event: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const screenX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const screenY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const anchor = worldToIsoPlane(projection, camera.x, camera.y);
    touchTarget = isoPlaneToWorld(
      projection,
      screenX - canvas.width / 2 + anchor.x,
      screenY - canvas.height / 2 + anchor.y,
    );
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== activeTouchPointerId) return;
    event.preventDefault();
    updateTouchTarget(event);
  };
  const onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== activeTouchPointerId) return;
    activeTouchPointerId = null;
    touchTarget = null;
  };
  const onResize = (): void => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);
  window.addEventListener('resize', onResize);
  onResize();

  // Leaves the current area through the door the player stands in: the
  // player lands at the target door's spawn cell (one cell inside the
  // target area, so arrival never immediately re-triggers travel).
  const travelThrough = (door: AreaDoor): void => {
    const target = getArea(door.targetAreaId);
    const arrival = arrivalPosition(target, door.targetDoorId);
    currentArea = target;
    collisionEnv = createAreaCollisionEnv(target);
    lightingEnv = createLightingEnv(target.tilemap);
    occlusionKey = occlusionKeyFor(target.tilemap);
    projection = createIsoProjection(target.tilemap.cellSize);
    player.x = arrival.x;
    player.y = arrival.y;
    player.vx = 0;
    player.vy = 0;
    camera = createCamera(player.x, player.y);
    strangeManInteraction.reset();
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
    if (strangeManInteraction.update(player, currentArea)) {
      touchTarget = null;
      player.vx = 0;
      player.vy = 0;
      camera = updateCamera(
        camera,
        player.x,
        player.y,
        CAMERA_LAG_PER_SECOND,
        stepMs,
      );
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
    const touchDistance = touchTarget
      ? Math.hypot(touchTarget.x - player.x, touchTarget.y - player.y)
      : null;
    const worldDir = touchTarget
      ? directionTowardPoint(player, touchTarget)
      : screenDirectionToWorld(projection, screenDirX, screenDirY);
    const dtS = stepMs / 1000;
    const moveDistance =
      touchDistance === null
        ? MOVE_SPEED_PX_PER_S * dtS
        : Math.min(touchDistance, MOVE_SPEED_PX_PER_S * dtS);
    const move = moveAabb(
      player,
      worldDir.x * moveDistance,
      worldDir.y * moveDistance,
      collisionEnv,
    );
    const moveSpeed =
      touchDistance !== null && touchDistance <= moveDistance
        ? 0
        : MOVE_SPEED_PX_PER_S;
    player.vx = move.hitX ? 0 : worldDir.x * moveSpeed;
    player.vy = move.hitY ? 0 : worldDir.y * moveSpeed;
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

  const loop: LoopHandle & { frame: (elapsedMs: number) => void } = createLoop({
    update,
    render: (_interpolation, frameMs) =>
      renderer.render(
        {
          area: currentArea,
          camera,
          projection,
          player,
          streetPerson,
          opening,
          streetDialogue: strangeManInteraction.currentDialogue(),
          collisionEnv,
          lightingEnv,
          occlusionKey,
          collisionDebugEnabled,
        },
        frameMs,
      ),
  });
  loop.start();

  return {
    dispose: () => {
      loop.stop();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      canvas.removeEventListener('lostpointercapture', onPointerEnd);
      window.removeEventListener('resize', onResize);
      input.clear();
    },
  };
};
