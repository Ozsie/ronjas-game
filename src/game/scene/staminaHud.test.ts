import { describe, expect, it } from 'vitest';
import { LOW_STAMINA_THRESHOLD, MAX_STAMINA } from '../engine/stamina';
import { drawStaminaHud, shouldShowStaminaHud } from './staminaHud';

describe('stamina HUD', () => {
  it('hides during scripted and movement-blocking presentations', () => {
    expect(shouldShowStaminaHud({ actors: [] })).toBe(true);
    expect(
      shouldShowStaminaHud({
        actors: [],
        intro: { day: 'DAY 1', speaker: '', text: '' },
      }),
    ).toBe(false);
    expect(shouldShowStaminaHud({ actors: [], hidePlayer: true })).toBe(false);
    expect(shouldShowStaminaHud({ actors: [], showSkipButton: true })).toBe(
      false,
    );
    expect(
      shouldShowStaminaHud({
        actors: [],
        dialogue: {
          line: { text: '' },
          prompt: '',
          blocksMovement: true,
        },
      }),
    ).toBe(false);
  });

  const drawAt = (stamina: number, elapsedMs: number) => {
    let fillStyle = '';
    const fillRects: {
      color: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];
    const text: string[] = [];
    const ctx = {
      save: () => undefined,
      restore: () => undefined,
      fillRect: (x: number, y: number, width: number, height: number) => {
        fillRects.push({ color: fillStyle, x, y, width, height });
      },
      fillText: (value: string) => text.push(value),
      set fillStyle(value: string) {
        fillStyle = value;
      },
    } as unknown as CanvasRenderingContext2D;

    drawStaminaHud(ctx, stamina, elapsedMs);
    return { fillRects, text };
  };

  it('shows a proportionate green bar', () => {
    const { fillRects, text } = drawAt(MAX_STAMINA / 2, 500);

    expect(text).toEqual(['STAMINA']);
    expect(fillRects[2]).toMatchObject({
      color: '#35C759',
      x: 16,
      width: 160 * 0.5,
      height: 12,
    });
  });

  it('flashes white below the low-stamina threshold, alternating with green', () => {
    expect(drawAt(LOW_STAMINA_THRESHOLD - 0.5, 0).fillRects[2].color).toBe(
      '#FFFFFF',
    );
    expect(drawAt(LOW_STAMINA_THRESHOLD - 0.5, 250).fillRects[2].color).toBe(
      '#35C759',
    );
    expect(drawAt(LOW_STAMINA_THRESHOLD, 0).fillRects[2].color).toBe('#35C759');
  });
});
