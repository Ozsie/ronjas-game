// The world palette — warm restaurant tones. Game content, not theme
// tokens: UI chrome uses @hoard-engine/uikit with the theme; the world
// canvas belongs to the game.

export const WORLD_PALETTE = {
  background: '#120F0D',
  floor: '#39312D',
  door: '#E5A72F',
  wallTop: '#A64A32',
  wallSouth: '#743427',
  wallEast: '#552820',
  player: '#FFD45E',
  entityShadow: '#120F0Ddd',
} as const;

// Wall prism extrusion height in screen pixels.
export const WALL_HEIGHT_PX = 30;
