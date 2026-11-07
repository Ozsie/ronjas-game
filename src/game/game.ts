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
  advanceDialog,
  currentDialogNode,
  startDialog,
  type DialogState,
} from './dialog';
import { STRANGE_MAN_DIALOG } from './dialogContent';
import {
  dialogPanelBounds,
  drawDialogPanel,
  isDialogPanelHit,
} from './dialogView';
import {
  createInputHarness,
  directionTowardPoint,
  InputAction,
  type InputHarness,
  isCollisionDebugToggleKey,
} from './engine/input';
import { createLoop, type LoopHandle } from './engine/loop';
import { moveAabb, type CollisionEnv } from './engine/physics';
import { createLight, type LightSource } from '@hoard-engine/lighting';
import {
  createIsoProjection,
  createIsoView,
  isoPlaneToWorld,
  screenDirectionToWorld,
  type IsoProjection,
  worldToIsoPlane,
} from '@hoard-engine/scene';
import { seedRun } from './rng';
import {
  customerCharacterForDay,
  type CharacterId,
  type CharacterDirection,
  type CharacterSpriteSheets,
} from './scene/characters';
import { createLightingEnv, occlusionKeyFor } from './scene/lightingEnv';
import {
  drawLights,
  drawCollisionDebug,
  drawWorldFrame,
  type CafeteriaAssets,
} from './scene/render';
import {
  drawIntroOverlay,
  drawSkipButton,
  isSkipButtonHit,
  skipButtonBounds,
} from './intro';
import {
  createOpeningState,
  openingDialogue,
  skipOpening,
  updateOpening,
} from './opening';
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
  createAreaCollisionEnv,
  getArea,
} from './world/areas';
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
  const loadCharacterImage = (path: string): HTMLImageElement => {
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}${path}`;
    return image;
  };
  const loadCharacterSprites = (
    characterId: CharacterId,
  ): CharacterSpriteSheets => {
    const assetPath = `characters/${characterId}/assets`;
    return {
      idle: loadCharacterImage(`${assetPath}/idle.png`),
      walk: loadCharacterImage(`${assetPath}/walk.png`),
    };
  };
  const characterSprites: Record<CharacterId, CharacterSpriteSheets> = {
    barista: loadCharacterSprites('barista'),
    resident: loadCharacterSprites('resident'),
    'office-worker': loadCharacterSprites('office-worker'),
    courier: loadCharacterSprites('courier'),
    'maintenance-worker': loadCharacterSprites('maintenance-worker'),
  };
  const loadCafeteriaAsset = (name: string): HTMLImageElement =>
    loadCharacterImage(`assets/cafeteria/${name}.png`);
  const cafeteriaAssets: CafeteriaAssets = {
    floor: loadCafeteriaAsset('floor_checker_vinyl'),
    table: loadCafeteriaAsset('cafeteria_table'),
    fruitBasket: loadCafeteriaAsset('fruit_basket'),
    kitchenRange: loadCafeteriaAsset('kitchen_range'),
    reachInFridge: loadCafeteriaAsset('reach_in_fridge'),
    trashBin: loadCafeteriaAsset('trash_bin'),
    vendingMachine: loadCafeteriaAsset('vending_machine'),
  };
  const actorDirections = new Map<string, CharacterDirection>();
  let animationTimeMs = 0;

  const input: InputHarness = createInputHarness();
  let activeTouchPointerId: number | null = null;
  let touchTarget: { x: number; y: number } | null = null;
  let collisionDebugEnabled = false;
  let streetDialogue: {
    kind: 'greeting' | 'conversation';
    session: DialogState;
  } | null = null;
  let greetingIndex = 0;
  let wasNearStreetPerson = false;
  let useRequested = false;
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
  const isNearStreetPerson = (): boolean =>
    currentArea.id === 'street' &&
    Math.hypot(player.x - streetPerson.x, player.y - streetPerson.y) <=
      currentArea.tilemap.cellSize * 1.5;
  const updateStreetDialogue = (): boolean => {
    const nearPerson = isNearStreetPerson();
    if (!nearPerson && streetDialogue?.kind === 'greeting') {
      streetDialogue = null;
    }
    if (nearPerson && !wasNearStreetPerson && !streetDialogue) {
      const greetingNode =
        greetingIndex % 2 === 0 ? 'greeting-first' : 'greeting-second';
      streetDialogue = {
        kind: 'greeting',
        session: startDialog(STRANGE_MAN_DIALOG, greetingNode),
      };
      greetingIndex += 1;
    }
    wasNearStreetPerson = nearPerson;

    if (useRequested) {
      useRequested = false;
      if (nearPerson) {
        if (streetDialogue?.kind === 'conversation') {
          const session = advanceDialog(streetDialogue.session);
          streetDialogue = currentDialogNode(session)
            ? { kind: 'conversation', session }
            : null;
        } else {
          streetDialogue = {
            kind: 'conversation',
            session: startDialog(STRANGE_MAN_DIALOG, 'machine'),
          };
        }
      }
    }

    if (streetDialogue?.kind === 'conversation' && !nearPerson) {
      streetDialogue = null;
    }
    return streetDialogue?.kind === 'conversation';
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
      useRequested = true;
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
      streetDialogue &&
      isDialogPanelHit(
        dialogPanelBounds(canvas.width, canvas.height),
        event.offsetX,
        event.offsetY,
      )
    ) {
      event.preventDefault();
      useRequested = true;
      return;
    }
    if (streetDialogue?.kind === 'conversation') return;
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
    streetDialogue = null;
    wasNearStreetPerson = false;
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
    if (updateStreetDialogue()) {
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

  // Rendering receives wall-clock visual time for the animated light
  // effects; the simulation steps stay deterministic from the loop's
  // accumulator. The light pass runs after the frame so floors, walls
  // and actors all catch the glow.
  const renderScene = (frameMs: number): void => {
    animationTimeMs += Math.max(frameMs, 0);
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
          { entity: player, character: characterSprites.barista },
          ...(currentArea.id === 'street'
            ? [
                {
                  entity: streetPerson,
                  character: characterSprites['maintenance-worker'],
                  ...(Math.hypot(
                    player.x - streetPerson.x,
                    player.y - streetPerson.y,
                  ) <=
                  cellSize * 1.5
                    ? { name: 'Strange Man' }
                    : {}),
                },
              ]
            : []),
        ]
      : [
          { entity: opening.ronja, character: characterSprites.barista },
          ...(opening.customer
            ? [
                {
                  entity: opening.customer,
                  character:
                    characterSprites[customerCharacterForDay(opening.dayIndex)],
                },
              ]
            : []),
        ];
    const fixtures =
      currentArea.id === INITIAL_AREA_ID
        ? RESTAURANT_FIXTURES
        : currentArea.id === 'street'
          ? STREET_FIXTURES
          : [];
    const fixtureKind =
      currentArea.id === INITIAL_AREA_ID
        ? 'restaurant'
        : currentArea.id === 'street'
          ? 'street'
          : null;
    drawWorldFrame(
      ctx,
      currentArea.tilemap,
      view,
      actors,
      animationTimeMs,
      actorDirections,
      fixtures,
      fixtureKind,
      currentArea.id === INITIAL_AREA_ID ? cafeteriaAssets : undefined,
    );
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
    if (collisionDebugEnabled) {
      const debugActor = opening.complete ? player : opening.ronja;
      drawCollisionDebug(
        ctx,
        currentArea.tilemap,
        view,
        collisionEnv,
        debugActor,
      );
    }
    const dialogue = openingDialogue(opening);
    if (dialogue && !opening.complete) {
      drawIntroOverlay(ctx, canvas.width, canvas.height, dialogue);
    }
    const streetLine = streetDialogue
      ? currentDialogNode(streetDialogue.session)
      : null;
    if (streetLine) {
      drawDialogPanel(
        ctx,
        canvas.width,
        canvas.height,
        streetLine,
        streetDialogue?.kind === 'greeting'
          ? 'E / TAP TO TALK'
          : 'E / TAP TO CONTINUE',
      );
    }
    if (!opening.complete) drawSkipButton(ctx, canvas.width);
  };

  const loop: LoopHandle & { frame: (elapsedMs: number) => void } = createLoop({
    update,
    render: (_interpolation, frameMs) => renderScene(frameMs),
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
