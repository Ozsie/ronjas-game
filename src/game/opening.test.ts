import { describe, expect, it } from 'vitest';
import { createCollisionEnv, createTilemap } from './world/tilemap';
import {
  createOpeningState,
  updateOpening,
  type OpeningStations,
} from './opening';

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

const STATIONS: OpeningStations = {
  register: { x: 12, y: 5 },
  pickup: { x: 16, y: 5 },
  iceCreamMachine: { x: 20, y: 5 },
  customerStop: { x: 20, y: 8 },
  customerDoor: { x: 22, y: 8 },
};

describe('restaurant opening choreography', () => {
  it('runs three walk-up conversations and leaves Ronja at the ice cream machine', () => {
    const map = createTilemap(ROWS, 32);
    const collisionEnv = createCollisionEnv(map);
    const state = createOpeningState(map, STATIONS);
    const dialogue: string[] = [];

    for (let elapsed = 0; elapsed < 60_000 && !state.complete; elapsed += 16) {
      updateOpening(state, 16, map, STATIONS, collisionEnv);
      if (state.dialogue) {
        const line = `${state.dialogue.day}|${state.dialogue.speaker}|${state.dialogue.text}`;
        if (dialogue.at(-1) !== line) dialogue.push(line);
      }
    }

    expect(state.complete).toBe(true);
    expect(state.dayIndex).toBe(2);
    expect(state.customer).toBeUndefined();
    expect(state.ronja.x).toBe((STATIONS.iceCreamMachine.x + 0.5) * 32);
    expect(state.ronja.y).toBe((STATIONS.iceCreamMachine.y + 0.5) * 32);
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
