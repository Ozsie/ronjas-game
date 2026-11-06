// The run RNG facade. All gameplay-affecting randomness flows through
// the seedable stream (`@hoard-engine/rng` module state), so a run can be
// reproduced from its seed; visual-only effects may use wall-clock noise.
// Facade per the audio/dice pattern: game vocabulary (drop tables, farm
// procs) lives in the modules that roll, this file owns the stream.
import { createSeededRng, setRng } from '@hoard-engine/rng';

export const seedRun = (seed: number): void => {
  setRng(createSeededRng(seed));
};

export { nextRandom, randomInt, shuffle } from '@hoard-engine/rng';
