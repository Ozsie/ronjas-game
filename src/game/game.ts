// The composition root — the only module that knows how the parts
// connect (the HOARD rule: leaves never know who calls them). This file
// wires input → movement → physics → camera → rendering, owns the player
// entity and the player-carried light, owns the current area (travel is
// swapping it: rebuild the per-area contracts, land at the target
// door's spawn cell) and owns the canvas lifecycle for the Svelte
// component.
import { createCamera, updateCamera } from '@hoard-engine/camera';
import { createEntity } from './engine/entity';
import { advanceStamina, createStaminaPool } from './engine/stamina';
import { dialogPanelBounds, isDialogPanelHit } from './dialogView';
import {
  createInputHarness,
  InputAction,
  type InputHarness,
  isCollisionDebugToggleKey,
} from './engine/input';
import { createLoop, type LoopHandle } from './engine/loop';
import { moveAabb, type CollisionEnv } from './engine/physics';
import {
  createIsoProjection,
  isoPlaneToWorld,
  type IsoProjection,
  worldToIsoPlane,
} from '@hoard-engine/scene';
import { seedRun } from './rng';
import { createGameRenderer } from './scene/gameRenderer';
import { createLightingEnv, occlusionKeyFor } from './scene/lightingEnv';
import {
  isTouchRunDistance,
  worldMovementForInput,
  worldMovementForScreenDirection,
} from './scene/movement';
import { isSkipButtonHit, skipButtonBounds } from './intro';
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
import {
  createAreaFeatureController,
  type AreaFeatureController,
} from './world/areaFeatures';
import { cellCenter } from './world/tilemap';
import type { LightingEnv } from '@hoard-engine/lighting';
import {
  CAMERA_LAG_PER_SECOND,
  MOVE_SPEED_PX_PER_S,
  PLAYER_HALF_EXTENTS,
  RUN_SPEED_MULTIPLIER,
  TOUCH_RUN_DISTANCE_CELLS,
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
  let stamina = createStaminaPool();
  let camera = createCamera(player.x, player.y);
  const featureControllers = new Map<string, AreaFeatureController>();
  const featuresForArea = (area: Area): AreaFeatureController => {
    let controller = featureControllers.get(area.id);
    if (!controller) {
      controller = createAreaFeatureController(area, player);
      featureControllers.set(area.id, controller);
    }
    return controller;
  };
  let areaFeatures = featuresForArea(currentArea);

  const input: InputHarness = createInputHarness();
  let activeTouchPointerId: number | null = null;
  let touchTarget: { x: number; y: number } | null = null;
  let collisionDebugEnabled = false;
  const onKeyDown = (event: KeyboardEvent): void => {
    if (isCollisionDebugToggleKey(event.key, event.repeat)) {
      collisionDebugEnabled = !collisionDebugEnabled;
      event.preventDefault();
      return;
    }
    if (event.code === 'Escape' && areaFeatures.presentation().encounter) {
      areaFeatures.handleAction('escape');
      event.preventDefault();
      return;
    }
    if (areaFeatures.presentation().hidePlayer) {
      if (event.code === 'Escape') areaFeatures.handleAction('skip');
      return;
    }
    if (!event.repeat && (event.code === 'KeyE' || event.code === 'Space')) {
      areaFeatures.handleAction('interact');
    }
    input.handleKeyDown(event);
  };
  const onKeyUp = (event: KeyboardEvent): void => input.handleKeyUp(event);
  const onPointerDown = (event: PointerEvent): void => {
    const presentation = areaFeatures.presentation();
    if (
      presentation.showSkipButton &&
      isSkipButtonHit(
        skipButtonBounds(canvas.width),
        event.offsetX,
        event.offsetY,
      )
    ) {
      event.preventDefault();
      areaFeatures.handleAction('skip');
      return;
    }
    if (
      event.pointerType === 'touch' &&
      presentation.dialogue &&
      isDialogPanelHit(
        dialogPanelBounds(canvas.width, canvas.height),
        event.offsetX,
        event.offsetY,
      )
    ) {
      event.preventDefault();
      areaFeatures.handleAction('interact');
      return;
    }
    if (presentation.dialogue?.blocksMovement || presentation.hidePlayer)
      return;
    if (event.pointerType !== 'touch') return;
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
    areaFeatures.reset();
    currentArea = target;
    areaFeatures = featuresForArea(target);
    collisionEnv = createAreaCollisionEnv(target);
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
    const featureUpdate = areaFeatures.update(stepMs, collisionEnv);
    if (featureUpdate.playerPosition) {
      player.x = featureUpdate.playerPosition.x;
      player.y = featureUpdate.playerPosition.y;
      player.vx = 0;
      player.vy = 0;
      camera = createCamera(player.x, player.y);
      input.clear();
      touchTarget = null;
    }
    if (featureUpdate.blocksPlayer) {
      player.vx = 0;
      player.vy = 0;
      stamina = advanceStamina(stamina, false, stepMs / 1000);
      if (!featureUpdate.playerPosition) {
        const focus = featureUpdate.cameraFocus ?? {
          x: player.x,
          y: player.y,
        };
        camera = updateCamera(
          camera,
          focus.x,
          focus.y,
          CAMERA_LAG_PER_SECOND,
          stepMs,
        );
      }
      return;
    }
    // Held-input velocity sampled per step, so the player never moves
    // faster at a higher frame rate; walls stop movement flush (the
    // zeroed velocity marks a blocked axis for wall-slide feedback).
    // Scale held keyboard axes by the projection so paired directions
    // follow cell edges; normalize in projected space so every direction
    // travels at the same apparent speed.
    const screenDirX =
      (input.isHeld(InputAction.RIGHT) ? 1 : 0) -
      (input.isHeld(InputAction.LEFT) ? 1 : 0);
    const screenDirY =
      (input.isHeld(InputAction.DOWN) ? 1 : 0) -
      (input.isHeld(InputAction.UP) ? 1 : 0);
    const touchScreenDelta = touchTarget
      ? worldToIsoPlane(
          projection,
          touchTarget.x - player.x,
          touchTarget.y - player.y,
        )
      : null;
    const touchDistance = touchScreenDelta
      ? Math.hypot(touchScreenDelta.x, touchScreenDelta.y)
      : null;
    const worldDir = touchScreenDelta
      ? worldMovementForScreenDirection(
          projection,
          touchScreenDelta.x,
          touchScreenDelta.y,
        )
      : worldMovementForInput(projection, screenDirX, screenDirY);
    const dtS = stepMs / 1000;
    const touchRequestsRun =
      touchDistance !== null &&
      isTouchRunDistance(
        touchDistance,
        currentArea.tilemap.cellSize * TOUCH_RUN_DISTANCE_CELLS,
      );
    const requestedSpeed =
      (input.isHeld(InputAction.RUN) || touchRequestsRun) &&
      stamina.value > 0 &&
      (worldDir.x !== 0 || worldDir.y !== 0)
        ? MOVE_SPEED_PX_PER_S * RUN_SPEED_MULTIPLIER
        : MOVE_SPEED_PX_PER_S;
    const moveDistance =
      touchDistance === null
        ? requestedSpeed * dtS
        : Math.min(touchDistance, requestedSpeed * dtS);
    const move = moveAabb(
      player,
      worldDir.x * moveDistance,
      worldDir.y * moveDistance,
      collisionEnv,
    );
    const moveSpeed =
      touchDistance !== null && touchDistance <= moveDistance
        ? 0
        : requestedSpeed;
    const moved = move.x !== player.x || move.y !== player.y;
    player.vx = move.hitX ? 0 : worldDir.x * moveSpeed;
    player.vy = move.hitY ? 0 : worldDir.y * moveSpeed;
    player.x = move.x;
    player.y = move.y;
    const running = requestedSpeed > MOVE_SPEED_PX_PER_S && moved;
    stamina = advanceStamina(stamina, running, dtS);
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
          stamina: stamina.value,
          features: areaFeatures.presentation(),
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
      areaFeatures.reset();
    },
  };
};
