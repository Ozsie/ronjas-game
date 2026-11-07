import { describe, expect, it } from 'vitest';
import { dialogPanelBounds, isDialogPanelHit } from './dialogView';

describe('dialog panel', () => {
  it('keeps its touch target inside the canvas and large enough to tap', () => {
    const bounds = dialogPanelBounds(390, 844);

    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(isDialogPanelHit(bounds, bounds.x + 10, bounds.y + 10)).toBe(true);
    expect(isDialogPanelHit(bounds, bounds.x - 1, bounds.y + 10)).toBe(false);
  });
});
