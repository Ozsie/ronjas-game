// The save schema and its migration registry. New schema versions are
// one migration each, registered in order at module scope (the
// @hoard-engine/saves pattern); loading runs every step a save has not
// seen and stamps the current version. Hub layouts and farm plots will
// churn — the registry is what keeps old saves loadable through that.
import { createSaveMigrations, type VersionedSave } from '@hoard-engine/saves';

export interface HubSave {
  buildings: Array<{
    id: string;
    kind: string;
    cellX: number;
    cellY: number;
  }>;
}

export interface FarmSave {
  plots: Array<{
    id: string;
    cellX: number;
    cellY: number;
    crop: string | null;
    // Wall-clock epoch of sowing; farm growth is calendar-driven, not
    // frame-driven, so this survives reloads untouched.
    sownAtMs: number | null;
  }>;
}

export interface GameSave extends VersionedSave {
  seed: number;
  // The area the player is currently in (an id from world/areas.ts).
  currentAreaId: string;
  player: { x: number; y: number };
  visitedAreas: string[];
  hub: HubSave;
  farm: FarmSave;
}

export const INITIAL_SAVE_AREA_ID = 'hub';

export const saveMigrations = createSaveMigrations<GameSave>();

// Version 1: the first stamped schema — initializes the hub, farm and
// discovery fields on pre-versioning saves. Newer versions append steps
// below, in order; never edit a registered step.
saveMigrations.register(1, (save) => {
  save.hub ??= { buildings: [] };
  save.farm ??= { plots: [] };
  save.visitedAreas ??= [];
});

// Version 2: area travel — records which area the player is in.
saveMigrations.register(2, (save) => {
  save.currentAreaId ??= INITIAL_SAVE_AREA_ID;
});

export const createInitialSave = (
  seed: number,
  player: { x: number; y: number },
): GameSave => ({
  saveVersion: saveMigrations.currentVersion,
  seed,
  currentAreaId: INITIAL_SAVE_AREA_ID,
  player,
  visitedAreas: [],
  hub: { buildings: [] },
  farm: { plots: [] },
});
