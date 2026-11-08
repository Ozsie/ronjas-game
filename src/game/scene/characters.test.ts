import { describe, expect, it } from 'vitest';
import { parseSpriteSheetManifest } from '@hoard-engine/scene';
import {
  CHARACTER_IDS,
  characterDirectionForMotion,
  characterSpriteDraw,
  customerCharacterForDay,
  type CharacterSpriteSheets,
} from './characters';

const describeCharacterSprites = () => {
  const manifest = parseSpriteSheetManifest({
    cell: [64, 64],
    pivot: [32, 54],
    clips: {
      idle_south: {
        loop: true,
        duration_ms: 300,
        frames: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => ({
          rect: [index * 64, 0, 64, 64] as const,
          duration_ms: 300,
        })),
      },
      idle_east: {
        loop: true,
        frames: [0, 1, 2, 3].map((index) => ({
          rect: [index * 64, 64, 64, 64] as const,
          duration_ms: 300,
        })),
      },
      walk_west: {
        loop: true,
        frames: [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
          rect: [index * 64, 192, 64, 64] as const,
          duration_ms: 100,
        })),
      },
    },
  });
  const image = {
    complete: true,
    naturalWidth: 576,
  } as HTMLImageElement;
  const sheets: CharacterSpriteSheets = {
    idle: {
      image,
      clips: {
        south: manifest.clips['idle_south'],
        east: manifest.clips['idle_east'],
      },
    },
    walk: { image, clips: { west: manifest.clips['walk_west'] } },
    cell: manifest.cell,
    pivot: manifest.pivot,
  };
  return sheets;
};

describe('character sprites', () => {
  it('registers the requested character assets', () => {
    expect(CHARACTER_IDS).toEqual([
      'barista',
      'resident',
      'office-worker',
      'courier',
      'maintenance-worker',
      'rogue',
      'vampire-count',
      'vampire-countess',
      'blood-alchemist',
    ]);
  });

  it('uses the resident, office-worker and courier across the opening days', () => {
    expect([0, 1, 2].map(customerCharacterForDay)).toEqual([
      'resident',
      'office-worker',
      'courier',
    ]);
  });

  it('keeps the previous facing direction while idle and faces movement', () => {
    expect(characterDirectionForMotion(0, 0, 'west')).toBe('west');
    expect(characterDirectionForMotion(1, 0, 'south')).toBe('east');
    expect(characterDirectionForMotion(0, -1, 'south')).toBe('north');
  });

  it('keeps a stable facing near diagonal movement and changes on a clear turn', () => {
    expect(characterDirectionForMotion(1, 1.1, 'east')).toBe('east');
    expect(characterDirectionForMotion(1, 1.1, 'south')).toBe('south');
    expect(characterDirectionForMotion(1, 1.3, 'east')).toBe('south');
    expect(characterDirectionForMotion(-1, 0.2, 'east')).toBe('west');
  });

  it('selects manifest clip frames at their authored rates', () => {
    const sheets = describeCharacterSprites();
    expect(characterSpriteDraw(sheets, 'idle', 'east', 600)?.source).toEqual({
      sx: 128,
      sy: 64,
      sw: 64,
      sh: 64,
    });
    expect(characterSpriteDraw(sheets, 'walk', 'west', 800)?.source).toEqual({
      sx: 0,
      sy: 192,
      sw: 64,
      sh: 64,
    });
  });

  it('anchors clips with their manifest cell and pivot', () => {
    const sheets = describeCharacterSprites();
    const draw = characterSpriteDraw(sheets, 'idle', 'south', 0);
    expect(draw?.pivot).toEqual([32, 54]);
    expect(draw?.cell).toEqual([64, 64]);
    expect(draw?.image.complete).toBe(true);
  });

  it('prefers clip-level cell and pivot over the manifest values', () => {
    const manifest = parseSpriteSheetManifest({
      cell: [64, 64],
      pivot: [32, 54],
      clips: {
        idle_south: {
          cell: [80, 80],
          pivot: [40, 70],
          loop: true,
          frames: [{ rect: [0, 240, 80, 80], duration_ms: 540 }],
        },
      },
    });
    const image = {} as HTMLImageElement;
    const sheets: CharacterSpriteSheets = {
      idle: { image, clips: { south: manifest.clips['idle_south'] } },
      walk: { image, clips: {} },
    };
    const draw = characterSpriteDraw(sheets, 'idle', 'south', 0);
    expect(draw?.pivot).toEqual([40, 70]);
    expect(draw?.cell).toEqual([80, 80]);
    expect(draw?.source).toEqual({ sx: 0, sy: 240, sw: 80, sh: 80 });
  });

  it('falls back to frame-size cells and bottom-center pivots', () => {
    const manifest = parseSpriteSheetManifest({
      clips: {
        idle_south: {
          frames: [{ rect: [8, 4, 48, 56], duration_ms: 300 }],
        },
      },
    });
    const image = {} as HTMLImageElement;
    const sheets: CharacterSpriteSheets = {
      idle: { image, clips: { south: manifest.clips['idle_south'] } },
      walk: { image, clips: {} },
    };
    const draw = characterSpriteDraw(sheets, 'idle', 'south', 0);
    expect(draw?.pivot).toEqual([24, 56]);
    expect(draw?.cell).toEqual([48, 56]);
  });

  it('has no frame to draw for uncovered action and facing pairs', () => {
    const sheets = describeCharacterSprites();
    expect(characterSpriteDraw(sheets, 'idle', 'north', 0)).toBeUndefined();
    expect(characterSpriteDraw(sheets, 'idle', 'west', 0)).toBeUndefined();
  });
});
