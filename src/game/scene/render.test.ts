import { describe, expect, it } from 'vitest';
import {
  createIsoProjection,
  createIsoView,
  worldToScreen,
} from '@hoard-engine/scene';
import { createEntity } from '../engine/entity';
import { createTilemap } from '../world/tilemap';
import { drawWorldFrame } from './render';
import { WORLD_PALETTE } from './palette';

describe('isometric world rendering', () => {
  it('draws sprites between walls according to world depth', () => {
    const events: string[] = [];
    let spriteY = 0;
    let fillStyle = '';
    const ctx = {
      get fillStyle() {
        return fillStyle;
      },
      set fillStyle(value: string) {
        fillStyle = value;
      },
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => events.push(fillStyle),
      ellipse: () => undefined,
      drawImage: (
        _image: CanvasImageSource,
        _sx: number,
        _sy: number,
        _sw: number,
        _sh: number,
        _dx: number,
        dy: number,
      ) => {
        spriteY = dy;
        events.push('sprite');
      },
    } as unknown as CanvasRenderingContext2D;
    const map = createTilemap(
      ['#....', '.....', '..#..', '.....', '.....'],
      32,
    );
    const view = createIsoView(
      { x: 80, y: 80 },
      400,
      400,
      map.cellSize,
      createIsoProjection(map.cellSize),
    );
    const image = {
      complete: true,
      naturalWidth: 576,
    } as HTMLImageElement;
    const character = { idle: image, walk: image };
    const entity = createEntity(
      'ronja',
      { x: 32, y: 32 },
      { halfWidth: 8, halfHeight: 8 },
    );

    drawWorldFrame(ctx, map, view, [
      {
        entity,
        character,
      },
    ]);

    const spriteIndex = events.indexOf('sprite');
    const wallTops = events.reduce<number[]>(
      (indices, color, index) =>
        color === WORLD_PALETTE.wallTop ? [...indices, index] : indices,
      [],
    );
    expect(wallTops).toHaveLength(2);
    expect(wallTops[0]).toBeLessThan(spriteIndex);
    expect(wallTops[1]).toBeGreaterThan(spriteIndex);
    const screenFeet = worldToScreen(
      view,
      entity.x,
      entity.y + entity.halfHeight,
    );
    expect(spriteY).toBe(screenFeet.y - (map.cellSize * 3 * 50) / 64);
  });
});
