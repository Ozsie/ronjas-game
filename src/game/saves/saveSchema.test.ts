import { describe, expect, it } from 'vitest';
import { parseSaveBlob } from '@hoard-engine/saves';
import { createInitialSave, saveMigrations, type GameSave } from './saveSchema';

describe('save schema', () => {
  it('creates initial saves at the current registry version', () => {
    const save = createInitialSave(42, { x: 100, y: 200 });
    expect(save.saveVersion).toBe(saveMigrations.currentVersion);
    expect(save.seed).toBe(42);
    expect(save.hub.buildings).toEqual([]);
    expect(save.farm.plots).toEqual([]);
  });

  it('round-trips through the save blob validator', () => {
    const save = createInitialSave(7, { x: 1, y: 2 });
    const blob = JSON.stringify(save);
    const parsed = parseSaveBlob<GameSave>(blob);
    expect(parsed).not.toBeNull();
    expect(parsed?.seed).toBe(7);
    expect(parsed?.player).toEqual({ x: 1, y: 2 });
  });

  it('migrates and stamps older saves on load', () => {
    // Simulate a pre-versioning save: no version stamp, missing fields.
    const old = {
      seed: 7,
      player: { x: 0, y: 0 },
    } as unknown as GameSave;
    saveMigrations.migrateSave(old);
    expect(old.saveVersion).toBe(saveMigrations.currentVersion);
    expect(old.hub.buildings).toEqual([]);
    expect(old.farm.plots).toEqual([]);
    expect(old.visitedAreas).toEqual([]);
    expect(old.currentAreaId).toBe('hub');
  });
});
