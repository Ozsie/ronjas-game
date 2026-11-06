import { describe, expect, it } from 'vitest';
import { drawIntroOverlay } from './intro';

describe('opening dialogue overlay', () => {
  it('shows dialogue in a panel without dimming the world or prompting for input', () => {
    const fillRects: number[][] = [];
    const text: string[] = [];
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      fillRect: (...rect: number[]) => fillRects.push(rect),
      strokeRect: () => undefined,
      fillText: (line: string) => text.push(line),
      measureText: (line: string) => ({ width: line.length * 8 }),
    } as unknown as CanvasRenderingContext2D;

    drawIntroOverlay(ctx, 800, 600, {
      day: 'DAY 1 — LUNCH RUSH',
      speaker: 'CUSTOMER',
      text: 'Could I get some ice cream?',
    });

    expect(fillRects).toHaveLength(1);
    expect(text).toContain('Could I get some ice cream?');
    expect(text.some((line) => line.includes('CLICK'))).toBe(false);
  });
});
