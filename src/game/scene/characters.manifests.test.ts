import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { parseSpriteSheetManifest, spriteClipKey } from '@hoard-engine/scene';
import { CHARACTER_IDS } from './characters';

// The shipped Godot-style manifests are runtime data now: the loader
// resolves every idle/walk clip from them, so each character must
// actually cover all four facings with positive frames.
const CHARACTERS_ROOT = fileURLToPath(
  new URL('../../../static/characters', import.meta.url),
);

const manifestPathFor = (characterId: string): string =>
  ['rogue', 'vampire-count', 'vampire-countess', 'blood-alchemist'].includes(
    characterId,
  )
    ? join(CHARACTERS_ROOT, characterId, 'animations', 'animation.json')
    : join(CHARACTERS_ROOT, characterId, 'aligned.json');

describe('shipped character manifests', () => {
  it('covers every character with idle and walk clips in all four facings', () => {
    for (const characterId of CHARACTER_IDS) {
      const manifest = parseSpriteSheetManifest(
        JSON.parse(readFileSync(manifestPathFor(characterId), 'utf8')),
      );
      for (const direction of ['south', 'east', 'north', 'west'] as const) {
        for (const action of ['idle', 'walk'] as const) {
          const key = `${characterId} ${action}_${direction}`;
          const clip = manifest.clips[spriteClipKey(action, direction)];
          expect(clip, key).toBeDefined();
          expect(clip?.action, key).toBe(action);
          expect(clip?.direction, key).toBe(direction);
          expect(clip?.frames.length ?? 0, key).toBeGreaterThan(0);
          expect(clip?.cell ?? manifest.cell, key).toBeDefined();
          expect(clip?.pivot ?? manifest.pivot, key).toBeDefined();
          const cycleMs =
            clip?.frames.reduce((sum, frame) => sum + frame.durationMs, 0) ?? 0;
          expect(cycleMs, key).toBeGreaterThan(0);
          for (const frame of clip?.frames ?? []) {
            expect(frame.durationMs, key).toBeGreaterThan(0);
            expect(frame.rect[0], key).toBeGreaterThanOrEqual(0);
            expect(frame.rect[1], key).toBeGreaterThanOrEqual(0);
            expect(frame.rect[2], key).toBeGreaterThan(0);
            expect(frame.rect[3], key).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
