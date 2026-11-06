// The fixed-timestep core. The simulation advances in equal steps
// (drained from accumulated frame time) so movement, physics and AI are
// deterministic per step regardless of display refresh rate; rendering
// runs once per animation frame with the leftover time as the
// interpolation fraction. Everything here except `createLoop` is pure —
// tests drive `drainElapsed` directly without an animation frame.

// 60 simulation steps per second.
export const FIXED_STEP_MS = 1000 / 60;

// A frame slower than five steps skips the backlog instead of spiraling
// (the leftover time is dropped, the render still runs).
export const MAX_STEPS_PER_FRAME = 5;

// Drains `elapsedMs` plus the carried `accumulatorMs` in fixed steps,
// calling `update(stepMs)` once per step. Returns the leftover time to
// carry into the next frame (clamped to zero after MAX_STEPS_PER_FRAME
// steps so a stall cannot pile up a backlog).
export const drainElapsed = (
  accumulatorMs: number,
  elapsedMs: number,
  stepMs: number,
  update: (stepMs: number) => void,
  maxSteps: number = MAX_STEPS_PER_FRAME,
): number => {
  let remaining = accumulatorMs + Math.max(elapsedMs, 0);
  let steps = 0;
  while (remaining >= stepMs && steps < maxSteps) {
    update(stepMs);
    remaining -= stepMs;
    steps += 1;
  }
  if (steps === maxSteps && remaining >= stepMs) {
    remaining = 0;
  }
  return remaining;
};

export type LoopHandle = {
  start: () => void;
  stop: () => void;
};

// The per-frame driver wiring the fixed steps to requestAnimationFrame.
// `frame(elapsedMs)` is the testable unit: it advances the simulation and
// calls `render(interpolation, elapsedMs)` once, with the interpolation
// fraction in [0, 1) telling the renderer where between steps to draw.
export const createLoop = (hooks: {
  update: (stepMs: number) => void;
  render: (interpolation: number, frameMs: number) => void;
  stepMs?: number;
}): LoopHandle & {
  frame: (elapsedMs: number) => void;
} => {
  const stepMs = hooks.stepMs ?? FIXED_STEP_MS;
  let accumulatorMs = 0;
  let frameId: number | null = null;
  let lastTs = 0;

  const frame = (elapsedMs: number): void => {
    accumulatorMs = drainElapsed(
      accumulatorMs,
      elapsedMs,
      stepMs,
      hooks.update,
    );
    hooks.render(accumulatorMs / stepMs, elapsedMs);
  };

  const tick = (ts: number): void => {
    if (lastTs === 0) {
      lastTs = ts;
    }
    frame(ts - lastTs);
    lastTs = ts;
    frameId = requestAnimationFrame(tick);
  };

  return {
    frame,
    start: () => {
      if (frameId !== null) return;
      lastTs = 0;
      frameId = requestAnimationFrame(tick);
    },
    stop: () => {
      if (frameId === null) return;
      cancelAnimationFrame(frameId);
      frameId = null;
      accumulatorMs = 0;
    },
  };
};
