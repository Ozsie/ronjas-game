import type { Entity } from './engine/entity';
import { createEntity } from './engine/entity';
import { moveAabb, type CollisionEnv } from './engine/physics';
import { cellCenter, type Tilemap } from './world/tilemap';

export type OpeningStations = {
  register: { x: number; y: number };
  pickup: { x: number; y: number };
  iceCreamMachine: { x: number; y: number };
  customerStop: { x: number; y: number };
  customerDoor: { x: number; y: number };
};

export type OpeningDialogue = {
  day: string;
  speaker: 'CUSTOMER' | 'RONJA';
  text: string;
};

type OpeningPhase =
  | 'customer-arrives'
  | 'customer-speaks'
  | 'ronja-to-pickup'
  | 'ronja-speaks'
  | 'customer-leaves'
  | 'ronja-to-register'
  | 'ronja-to-machine'
  | 'final-speaks';

export type OpeningState = {
  dayIndex: number;
  phase: OpeningPhase;
  phaseElapsedMs: number;
  ronja: Entity;
  customer?: Entity;
  dialogue: OpeningDialogue | null;
  complete: boolean;
};

const DAYS = [
  {
    label: 'DAY 1 — LUNCH RUSH',
    response: 'The ice cream machine is broken.',
  },
  {
    label: 'DAY 2 — ANOTHER SHIFT',
    response: 'The ice cream machine is still broken.',
  },
  {
    label: 'DAY 3 — SAME STORY',
    response: 'The ice cream machine is still broken.',
  },
] as const;

const ACTOR_HALF_EXTENTS = { halfWidth: 8, halfHeight: 8 };
const WALK_SPEED_PX_PER_S = 96;
const DIALOGUE_DURATION_MS = 1400;
const CUSTOMER_ORDER = 'Could I get some ice cream?';
const FINAL_LINE =
  'Ronja has had enough. Take control and head for the front door.';

const positionAt = (map: Tilemap, cell: { x: number; y: number }) =>
  cellCenter(map, cell.x, cell.y);

export const createOpeningState = (
  map: Tilemap,
  stations: OpeningStations,
): OpeningState => ({
  dayIndex: 0,
  phase: 'customer-arrives',
  phaseElapsedMs: 0,
  ronja: createEntity(
    'ronja',
    positionAt(map, stations.register),
    ACTOR_HALF_EXTENTS,
  ),
  dialogue: null,
  complete: false,
});

const setPhase = (
  state: OpeningState,
  phase: OpeningPhase,
  dialogue: OpeningDialogue | null = null,
): void => {
  state.phase = phase;
  state.phaseElapsedMs = 0;
  state.dialogue = dialogue;
};

const dialogueForDay = (
  state: OpeningState,
  speaker: OpeningDialogue['speaker'],
  text: string,
): OpeningDialogue => ({
  day: DAYS[state.dayIndex].label,
  speaker,
  text,
});

const moveTowards = (
  entity: Entity,
  target: { x: number; y: number },
  stepMs: number,
  collisionEnv: CollisionEnv,
): boolean => {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 1) {
    entity.x = target.x;
    entity.y = target.y;
    entity.vx = 0;
    entity.vy = 0;
    return true;
  }

  const travel = Math.min(distance, (WALK_SPEED_PX_PER_S * stepMs) / 1000);
  const result = moveAabb(
    entity,
    (dx / distance) * travel,
    (dy / distance) * travel,
    collisionEnv,
  );
  entity.vx = ((result.x - entity.x) / stepMs) * 1000;
  entity.vy = ((result.y - entity.y) / stepMs) * 1000;
  entity.x = result.x;
  entity.y = result.y;
  return Math.hypot(target.x - entity.x, target.y - entity.y) <= 1;
};

export const updateOpening = (
  state: OpeningState,
  stepMs: number,
  map: Tilemap,
  stations: OpeningStations,
  collisionEnv: CollisionEnv,
): void => {
  if (state.complete) return;

  if (state.phase === 'customer-arrives') {
    if (!state.customer) {
      state.customer = createEntity(
        `customer-${state.dayIndex + 1}`,
        positionAt(map, stations.customerDoor),
        ACTOR_HALF_EXTENTS,
      );
    }
    if (
      moveTowards(
        state.customer,
        positionAt(map, stations.customerStop),
        stepMs,
        collisionEnv,
      )
    ) {
      setPhase(
        state,
        'customer-speaks',
        dialogueForDay(state, 'CUSTOMER', CUSTOMER_ORDER),
      );
    }
    return;
  }

  if (state.phase === 'customer-speaks') {
    state.phaseElapsedMs += stepMs;
    if (state.phaseElapsedMs >= DIALOGUE_DURATION_MS) {
      setPhase(state, 'ronja-to-pickup');
    }
    return;
  }

  if (state.phase === 'ronja-to-pickup') {
    if (
      moveTowards(
        state.ronja,
        positionAt(map, stations.pickup),
        stepMs,
        collisionEnv,
      )
    ) {
      setPhase(
        state,
        'ronja-speaks',
        dialogueForDay(state, 'RONJA', DAYS[state.dayIndex].response),
      );
    }
    return;
  }

  if (state.phase === 'ronja-speaks') {
    state.phaseElapsedMs += stepMs;
    if (state.phaseElapsedMs >= DIALOGUE_DURATION_MS) {
      setPhase(state, 'customer-leaves');
    }
    return;
  }

  if (state.phase === 'customer-leaves') {
    if (
      state.customer &&
      moveTowards(
        state.customer,
        positionAt(map, stations.customerDoor),
        stepMs,
        collisionEnv,
      )
    ) {
      state.customer = undefined;
      if (state.dayIndex < DAYS.length - 1) {
        setPhase(state, 'ronja-to-register');
      } else {
        setPhase(state, 'ronja-to-machine');
      }
    }
    return;
  }

  if (state.phase === 'ronja-to-register') {
    if (
      moveTowards(
        state.ronja,
        positionAt(map, stations.register),
        stepMs,
        collisionEnv,
      )
    ) {
      state.dayIndex += 1;
      setPhase(state, 'customer-arrives');
    }
    return;
  }

  if (state.phase === 'ronja-to-machine') {
    if (
      moveTowards(
        state.ronja,
        positionAt(map, stations.iceCreamMachine),
        stepMs,
        collisionEnv,
      )
    ) {
      setPhase(
        state,
        'final-speaks',
        dialogueForDay(state, 'RONJA', FINAL_LINE),
      );
    }
    return;
  }

  state.phaseElapsedMs += stepMs;
  if (state.phaseElapsedMs >= DIALOGUE_DURATION_MS * 2) {
    state.complete = true;
  }
};
