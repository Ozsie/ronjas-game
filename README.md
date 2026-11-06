# Ronja's Game

A realtime 2.5D isometric game starter built with SvelteKit, TypeScript,
and custom canvas rendering (no game engine), deployed as a static site.
Mobile phones are the target platform, so gameplay input must support touch.

Built on the HOARD engine packages (`@hoard-engine/*`) — tile geometry,
lighting, seeded RNG, versioned saves, audio and canvas UI chrome — with
the realtime simulation core (fixed-timestep loop, continuous
AABB-vs-tilemap physics, follow camera, held-input movement) implemented
in this repo. See [AGENTS.md](./AGENTS.md) for the architecture and
conventions.

The opening follows Ronja through three workdays at McDonald's: customers
walk in to order ice cream, Ronja moves between the register, pickup, and
the broken machine, and she eventually leaves the restaurant. The opening
plays automatically; afterward, use WASD or the arrow keys to reach the
front door and go outside. The restaurant includes graybox dining tables
and a kitchen counter, and the restaurant and street are rendered in
isometric style.

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # production build (static adapter)
npm run check    # type checking (strict TS)
npm test         # vitest
npm run lint     # eslint
```
