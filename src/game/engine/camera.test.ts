import { describe, expect, it } from 'vitest';
import { createCamera, updateCamera } from '@hoard-engine/camera';

describe('updateCamera', () => {
  it("doesn't move on zero step time", () => {
    const camera = updateCamera(createCamera(0, 0), 100, 100, 8, 0);
    expect(camera).toEqual({ x: 0, y: 0 });
  });

  it('moves toward the target and never overshoots', () => {
    const camera = createCamera(0, 0);
    const step1 = updateCamera(camera, 100, 200, 8, 16);
    expect(step1.x).toBeGreaterThan(0);
    expect(step1.x).toBeLessThan(100);
    const step2 = updateCamera(step1, 100, 200, 8, 16);
    expect(step2.x).toBeGreaterThan(step1.x);
    const far = updateCamera(createCamera(0, 0), -100, -200, 8, 16);
    expect(far.x).toBeLessThan(0);
    expect(far.y).toBeLessThan(0);
  });

  it('is frame-rate independent: equal total dt converges equally', () => {
    const oneBigStep = updateCamera(createCamera(0, 0), 100, 0, 8, 100);
    // Two 50ms steps carry the same time.
    let stepped = createCamera(0, 0);
    stepped = updateCamera(stepped, 100, 0, 8, 50);
    stepped = updateCamera(stepped, 100, 0, 8, 50);
    expect(stepped.x).toBeCloseTo(oneBigStep.x, 10);
    expect(oneBigStep.x).toBeLessThan(100);
  });
});
