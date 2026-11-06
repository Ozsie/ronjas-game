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
    const wallTopPaths: number[][] = [];
    let currentPath: number[] = [];
    let isWallTopPath = false;
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
      beginPath: () => {
        currentPath = [];
        isWallTopPath = fillStyle === WORLD_PALETTE.wallTop;
      },
      moveTo: (_x: number, y: number) => {
        if (isWallTopPath) currentPath.push(y);
      },
      lineTo: (_x: number, y: number) => {
        if (isWallTopPath) currentPath.push(y);
      },
      closePath: () => undefined,
      fill: () => {
        if (isWallTopPath) wallTopPaths.push(currentPath);
        events.push(fillStyle);
      },
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
      ['#....', '.#...', '..#..', '.....', '.....'],
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
    expect(wallTops).toHaveLength(3);
    expect(wallTops[0]).toBeLessThan(spriteIndex);
    expect(wallTops[1]).toBeGreaterThan(spriteIndex);
    expect(wallTops[2]).toBeGreaterThan(spriteIndex);
    expect(wallTopPaths).toHaveLength(3);
    expect(wallTopPaths[0]).toEqual([
      worldToScreen(view, 0, 0).y - 60,
      worldToScreen(view, 32, 0).y - 60,
      worldToScreen(view, 32, 32).y - 60,
      worldToScreen(view, 0, 32).y - 60,
    ]);
    expect(wallTopPaths[1]).toEqual([
      worldToScreen(view, 32, 32).y - 60,
      worldToScreen(view, 64, 32).y - 52.5,
      worldToScreen(view, 64, 64).y - 45,
      worldToScreen(view, 32, 64).y - 52.5,
    ]);
    expect(wallTopPaths[2]).toEqual([
      worldToScreen(view, 64, 64).y - 45,
      worldToScreen(view, 96, 64).y - 37.5,
      worldToScreen(view, 96, 96).y - 30,
      worldToScreen(view, 64, 96).y - 37.5,
    ]);
    const screenFeet = worldToScreen(
      view,
      entity.x,
      entity.y + entity.halfHeight,
    );
    expect(spriteY).toBe(screenFeet.y - (map.cellSize * 3 * 50) / 64);
  });
});
