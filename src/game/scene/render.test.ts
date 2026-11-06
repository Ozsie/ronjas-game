import { describe, expect, it } from 'vitest';
import {
  createIsoProjection,
  createIsoView,
  worldToScreen,
} from '@hoard-engine/scene';
import { createEntity } from '../engine/entity';
import { createTilemap } from '../world/tilemap';
import {
  drawCollisionDebug,
  drawWorldFrame,
  type CafeteriaAssets,
} from './render';
import { WORLD_PALETTE } from './palette';

describe('isometric world rendering', () => {
  it('draws the cafeteria floor and prop assets in the restaurant', () => {
    const drawImage = (image: CanvasImageSource) => {
      drawnImages.push(image);
    };
    const drawnImages: CanvasImageSource[] = [];
    const imageSizes: {
      image: CanvasImageSource;
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];
    let clipCount = 0;
    let fillCount = 0;
    const ctx = {
      fillStyle: '',
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      save: () => undefined,
      clip: () => {
        clipCount += 1;
      },
      restore: () => undefined,
      fill: () => {
        fillCount += 1;
      },
      ellipse: () => undefined,
      drawImage: (
        image: CanvasImageSource,
        _sourceX: number,
        _sourceY: number,
        _sourceWidth: number,
        _sourceHeight: number,
        x: number,
        y: number,
        width: number,
        height: number,
      ) => {
        drawImage(image);
        imageSizes.push({ image, x, y, width, height });
      },
    } as unknown as CanvasRenderingContext2D;
    const map = createTilemap(['.'], 32);
    const view = createIsoView(
      { x: 16, y: 16 },
      200,
      200,
      map.cellSize,
      createIsoProjection(map.cellSize),
    );
    const makeImage = () =>
      ({
        complete: true,
        naturalWidth: 64,
        naturalHeight: 64,
      }) as HTMLImageElement;
    const floorImage = makeImage();
    const tableImage = makeImage();
    const rangeImage = makeImage();
    const assets: CafeteriaAssets = {
      floor: floorImage,
      table: tableImage,
      fruitBasket: makeImage(),
      kitchenRange: rangeImage,
      reachInFridge: makeImage(),
      trashBin: makeImage(),
      vendingMachine: makeImage(),
    };

    drawWorldFrame(
      ctx,
      map,
      view,
      [],
      0,
      new Map(),
      [
        { kind: 'table', cellX: 0, cellY: 0 },
        { kind: 'kitchen-range', cellX: 0, cellY: 0 },
      ],
      'restaurant',
      assets,
    );

    expect(drawnImages).toHaveLength(3);
    expect(drawnImages).toEqual([floorImage, tableImage, rangeImage]);
    expect(imageSizes[0]).toEqual({
      image: floorImage,
      x: worldToScreen(view, 16, 16).x - floorImage.naturalWidth / 2,
      y: worldToScreen(view, 0, 0).y - floorImage.naturalHeight / 2,
      width: floorImage.naturalWidth,
      height: floorImage.naturalHeight,
    });
    expect(imageSizes[1]).toEqual({
      image: tableImage,
      x: worldToScreen(view, 16, 16).x - map.cellSize * 1.5,
      y: worldToScreen(view, 16, 16).y + map.cellSize * 0.25 - map.cellSize * 3,
      width: map.cellSize * 3,
      height: map.cellSize * 3,
    });
    expect(imageSizes[2]).toMatchObject({
      image: rangeImage,
      width: map.cellSize * 3,
      height: map.cellSize * 3,
    });
    expect(clipCount).toBe(1);
    expect(fillCount).toBeGreaterThan(0);
  });

  it('projects wall cells, fixture shapes, and the player collision box', () => {
    let strokeCount = 0;
    const ctx = {
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      fill: () => undefined,
      stroke: () => {
        strokeCount += 1;
      },
    } as unknown as CanvasRenderingContext2D;
    const map = createTilemap(['#.'], 32);
    const view = createIsoView(
      { x: 16, y: 16 },
      200,
      200,
      map.cellSize,
      createIsoProjection(map.cellSize),
    );

    drawCollisionDebug(
      ctx,
      map,
      view,
      {
        cellSize: map.cellSize,
        isSolidCell: () => false,
        obstacles: [{ x: 48, y: 16, halfWidth: 8, halfHeight: 6 }],
      },
      { x: 48, y: 48, halfWidth: 8, halfHeight: 8 },
    );

    expect(strokeCount).toBe(3);
  });

  it('keeps isometric wall geometry instead of drawing wall sprites', () => {
    const drawnImages: CanvasImageSource[] = [];
    const makeImage = () =>
      ({
        complete: true,
        naturalWidth: 64,
        naturalHeight: 64,
      }) as HTMLImageElement;
    const ctx = {
      fillStyle: '',
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      closePath: () => undefined,
      fill: () => undefined,
      ellipse: () => undefined,
      drawImage: (image: CanvasImageSource) => drawnImages.push(image),
    } as unknown as CanvasRenderingContext2D;
    const map = createTilemap(['#'], 32);
    const view = createIsoView(
      { x: 16, y: 16 },
      200,
      200,
      map.cellSize,
      createIsoProjection(map.cellSize),
    );
    const assets: CafeteriaAssets = {
      floor: makeImage(),
      table: makeImage(),
      fruitBasket: makeImage(),
      kitchenRange: makeImage(),
      reachInFridge: makeImage(),
      trashBin: makeImage(),
      vendingMachine: makeImage(),
    };

    drawWorldFrame(ctx, map, view, [], 0, new Map(), [], 'restaurant', assets);

    expect(drawnImages).toHaveLength(0);
  });

  it('draws sprites between walls according to world depth', () => {
    const events: string[] = [];
    const wallTopPaths: number[][] = [];
    let currentPath: number[] = [];
    let isWallTopPath = false;
    let spriteY = 0;
    const drawnText: { text: string; x: number; y: number }[] = [];
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
      save: () => undefined,
      restore: () => undefined,
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
      fillText: (text: string, x: number, y: number) => {
        drawnText.push({ text, x, y });
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
        name: 'Strange Man',
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
    const screenFeet = worldToScreen(view, entity.x, entity.y);
    expect(spriteY).toBe(screenFeet.y - (map.cellSize * 3 * 50) / 64);
    expect(drawnText).toEqual([
      {
        text: 'Strange Man',
        x: screenFeet.x,
        y: screenFeet.y - (map.cellSize * 3 * 50) / 64 - 2,
      },
    ]);
  });
});
