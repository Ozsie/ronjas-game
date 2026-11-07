import { describe, expect, it } from 'vitest';
import { createCollisionEnv, createTilemap } from './world/tilemap';
import {
  createOpeningState,
  openingDialogue,
  skipOpening,
  updateOpening,
} from './opening';
import { RESTAURANT_STATIONS } from './world/areas';

const ROWS = [
  '########################',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#.........############.#',
  '#......................#',
  '#......................D',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '#......................#',
  '########################',
];

describe('restaurant opening choreography', () => {
  it('skips the opening and clears its active actors and dialogue', () => {
    const map = createTilemap(ROWS, 32);
    const collisionEnv = createCollisionEnv(map);
    const state = createOpeningState(map, RESTAURANT_STATIONS);
    updateOpening(state, 16, map, RESTAURANT_STATIONS, collisionEnv);

    skipOpening(state, map, RESTAURANT_STATIONS);

    expect(state.complete).toBe(true);
    expect(state.customer).toBeUndefined();
    expect(openingDialogue(state)).toBeNull();
    expect(state.ronja.x).toBe(
      (RESTAURANT_STATIONS.iceCreamMachine.x + 0.5) * 32,
    );
    expect(state.ronja.y).toBe(
      (RESTAURANT_STATIONS.iceCreamMachine.y + 0.5) * 32,
    );
    expect(state.ronja.vx).toBe(0);
    expect(state.ronja.vy).toBe(0);
  });

  it('starts customer dialogue only after reaching the register', () => {
    const map = createTilemap(ROWS, 32);
    const collisionEnv = createCollisionEnv(map);
    const state = createOpeningState(map, RESTAURANT_STATIONS);

    for (
      let elapsed = 0;
      elapsed < 60_000 && !openingDialogue(state);
      elapsed += 16
    ) {
      updateOpening(state, 16, map, RESTAURANT_STATIONS, collisionEnv);
    }

    expect(openingDialogue(state)?.speaker).toBe('CUSTOMER');
    expect(
      Math.hypot(
        (state.customer?.x ?? Number.POSITIVE_INFINITY) - (12 + 0.5) * 32,
        (state.customer?.y ?? Number.POSITIVE_INFINITY) - (7 + 0.5) * 32,
      ),
    ).toBeLessThanOrEqual(1);
  });

  it('keeps the customer idle while Ronja checks the ice cream machine', () => {
    const map = createTilemap(ROWS, 32);
    const collisionEnv = createCollisionEnv(map);
    const state = createOpeningState(map, RESTAURANT_STATIONS);

    for (let elapsed = 0; elapsed < 60_000; elapsed += 16) {
      updateOpening(state, 16, map, RESTAURANT_STATIONS, collisionEnv);
      if (openingDialogue(state)?.speaker === 'RONJA') break;
    }

    expect(openingDialogue(state)?.speaker).toBe('RONJA');
    expect(state.ronja.vx).toBe(0);
    expect(state.ronja.vy).toBe(0);
    expect(state.customer?.vx).toBe(0);
    expect(state.customer?.vy).toBe(0);
  });

  it('runs three walk-up conversations and leaves Ronja at the ice cream machine', () => {
    const map = createTilemap(ROWS, 32);
    const collisionEnv = createCollisionEnv(map);
    const state = createOpeningState(map, RESTAURANT_STATIONS);
    const dialogue: string[] = [];

    for (let elapsed = 0; elapsed < 60_000 && !state.complete; elapsed += 16) {
      updateOpening(state, 16, map, RESTAURANT_STATIONS, collisionEnv);
      const currentDialogue = openingDialogue(state);
      if (currentDialogue) {
        if (currentDialogue.speaker === 'RONJA') {
          expect(state.ronja.x).toBe(
            (RESTAURANT_STATIONS.iceCreamMachine.x + 0.5) * 32,
          );
          expect(state.ronja.y).toBe(
            (RESTAURANT_STATIONS.iceCreamMachine.y + 0.5) * 32,
          );
        }
        const line = `${currentDialogue.day}|${currentDialogue.speaker}|${currentDialogue.text}`;
        if (dialogue.at(-1) !== line) dialogue.push(line);
      }
    }

    expect(state.complete).toBe(true);
    expect(state.dayIndex).toBe(2);
    expect(state.customer).toBeUndefined();
    expect(state.ronja.x).toBe(
      (RESTAURANT_STATIONS.iceCreamMachine.x + 0.5) * 32,
    );
    expect(state.ronja.y).toBe(
      (RESTAURANT_STATIONS.iceCreamMachine.y + 0.5) * 32,
    );
    expect(dialogue.filter((line) => line.includes('|CUSTOMER|'))).toHaveLength(
      3,
    );
    expect(dialogue).toContain(
      'DAY 1 — LUNCH RUSH|RONJA|The ice cream machine is broken.',
    );
    expect(dialogue).toContain(
      'DAY 2 — ANOTHER SHIFT|RONJA|The ice cream machine is still broken.',
    );
    expect(dialogue).toContain(
      'DAY 3 — SAME STORY|RONJA|Ronja has had enough. Take control and head for the front door.',
    );
  });
});
