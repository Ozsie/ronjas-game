// The registry and shared area adapters. Area-specific content lives beside
// its area in `world/areas/<area-id>`.
import type { Area } from './area';
import {
  RESTAURANT_AREA,
  createRestaurantCollisionEnv,
} from './areas/restaurant/area';
import { FOREST_AREA } from './areas/forest/area';
import { STREET_AREA } from './areas/street/area';
import { createCollisionEnv } from './tilemap';

const AREAS: Record<string, Area> = {
  restaurant: RESTAURANT_AREA,
  street: STREET_AREA,
  forest: FOREST_AREA,
};

export const INITIAL_AREA_ID = 'restaurant';

// Resolves an area id; unknown ids are content errors, not runtime
// states to handle silently.
export const getArea = (areaId: string): Area => {
  const area = AREAS[areaId];
  if (!area) {
    throw new Error(`unknown area '${areaId}'`);
  }
  return area;
};

export const createAreaCollisionEnv = (area: Area) =>
  area.id === INITIAL_AREA_ID
    ? createRestaurantCollisionEnv(area)
    : createCollisionEnv(area.tilemap);
