import { describe, expect, it, vi } from 'vitest';
import { FIXED_STEP_MS, MAX_STEPS_PER_FRAME, drainElapsed } from './loop';

describe('drainElapsed', () => {
  it('calls update once per full step', () => {
    const update = vi.fn();
    drainElapsed(0, FIXED_STEP_MS * 2 + 5, FIXED_STEP_MS, update);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('carries the leftover time to the next frame', () => {
    const update = vi.fn();
    const leftover = drainElapsed(0, FIXED_STEP_MS + 5, FIXED_STEP_MS, update);
    expect(leftover).toBe(5);
  });

  it('accumulates sub-step frames into full steps', () => {
    const update = vi.fn();
    const after1 = drainElapsed(0, FIXED_STEP_MS / 2, FIXED_STEP_MS, update);
    const after2 = drainElapsed(
      after1,
      FIXED_STEP_MS / 2,
      FIXED_STEP_MS,
      update,
    );
    expect(update).toHaveBeenCalledTimes(1);
    expect(after2).toBe(0);
  });

  it('clamps the backlog after the step budget is spent', () => {
    const update = vi.fn();
    const leftover = drainElapsed(
      0,
      FIXED_STEP_MS * (MAX_STEPS_PER_FRAME + 20),
      FIXED_STEP_MS,
      update,
    );
    expect(update).toHaveBeenCalledTimes(MAX_STEPS_PER_FRAME);
    expect(leftover).toBe(0);
  });

  it('never calls update for zero elapsed time', () => {
    const update = vi.fn();
    const leftover = drainElapsed(0, 0, FIXED_STEP_MS, update);
    expect(update).not.toHaveBeenCalled();
    expect(leftover).toBe(0);
  });
});
