# AGENTS.md

Realtime 2.5D isometric game starter. SvelteKit + TypeScript, fully
custom canvas rendering (no game engine), deployed as a static site. The
current graybox areas are scaffolding, not settled game design. The
player moves continuously (not grid-stepped) over tile-based areas; the
realtime simulation core is built here and consumes HOARD engine packages.

## Commands

```bash
npm run dev              # dev server
npm run build            # production build (static adapter)
npm run check            # svelte-check (type checking, strict TS)
npm test                 # vitest (watch mode; `npm test -- run` for one pass)
npm run lint             # eslint over .ts files
npm run prettier         # prettier check
npm run prettier:format  # prettier fix
```

Run `npm run check`, `npm test -- run`, and `npm run lint` before
considering work done.

## Structure

```
src/
  game/                  the game — the only module with edges (composition root)
    game.ts              wires everything; owns the canvas lifecycle for Svelte
    engine/              realtime simulation core (greenfield part)
      loop.ts            fixed-timestep accumulator + rAF driver
      input.ts           held-key action harness (velocity from held state per step, never from press events)
      physics.ts         continuous AABB-vs-tilemap sweep (axis-separated, flush snapping)
      camera.ts          follow camera + view/culling math
      entity.ts          the minimal Entity contract (position/velocity/half-extents, world pixels)
    world/               tilemap data + area content
      tilemap.ts         string rows over the grid package's cell tokens; collision/lighting contracts
      area.ts            the Area/AreaDoor contracts + door lookup and arrival helpers
      areas.ts           the area registry and content (map rows, doors, lights); content invariants are tested
      world.ts           graybox tuning constants (player movement, camera feel)
    scene/               canvas adapters over @hoard-engine/scene (the iso
                         projection, screen mapping and painter compositing
                         live in the package)
      lightingEnv.ts     maps the tilemap into @hoard-engine/lighting's LightingEnv
      render.ts          view-model adapter: tilemap rows + palette into the iso
                         world view, entities into actor views, and animated
                         lights resolved via @hoard-engine/lighting into light
                         views for the package's paint cores
      palette.ts         graybox world palette + wall extrusion height
    audio/cueTable.ts    sound-cue seam: logic emits cue ids, table maps them to sample paths
    saves/saveSchema.ts  GameSave schema + the ordered migration registry
    rng.ts               run RNG facade over @hoard-engine/rng
  routes/                SvelteKit pages (mounts the game canvas)
  styles/                global styles
static/                  favicon, future sprites/sfx/music
```

## Realtime rules

- The simulation advances in fixed steps (`engine/loop.ts`,
  `FIXED_STEP_MS`); render runs once per animation frame. All movement
  goes through `engine/physics.ts` sweeps — never grid-step the player
  or enemies, never move things in the render callback.
- Frame-rate independence: velocities are pixels per second, inputs are
  sampled from held state each step, camera smoothing is exponential.
- Determinism: gameplay-affecting randomness flows only through
  `src/game/rng.ts` (seeded run stream; `seedRun` at game start).
  Wall-clock time (`performance.now()`) is allowed for visual effects
  (light flicker), never for gameplay rolls.
- Browser API access is confined to the seams that need it:
  `routes/+page.svelte`, `game.ts` (canvas, listeners), `engine/loop.ts`
  (rAF), `audio/` (future adapter), and SvelteKit itself. Engine and
  world modules stay headless-testable — they take canvas types or
  events only as parameters, which is how the shaderless `engine/` and
  `world/` tests run in plain Node.
- Future enemy AI: coarse pathing via `@hoard-engine/grid`'s `findPath`
  over a `PassableGrid` built from the tilemap (re-path on an interval
  or target-cell change, not every step), steering between cells on the
  physics layer.

## Isometric rendering (2.5D)

The game is 2.5D: it is _simulated_ strictly top-down (world pixels,
tile grid, XY-plane physics — physics, lighting, pathfinding and saves
never know the projection), and only the renderer projects through the
iso plane of `@hoard-engine/scene`.

- Projection: standard 2:1 diamonds — a cell renders `cellSize * 2`
  wide and `cellSize` tall (`createIsoProjection`); screen x walks the
  world x-minus-y diagonal, screen y the x-plus-y diagonal. All
  projection math goes through the package's iso helpers (`@hoard-engine/scene`)
  — never hand-roll screen offsets.
- Draw order: the painter's algorithm, sorted by the world-plane depth
  sum (`isoDepth`): floors are flat (drawn first, unsorted); wall
  prisms and actors share one queue, walls at their cell-center sum,
  actors at their feet. The additive light pass draws last over
  everything under its polygons.
- Walls extrude upward by `WALL_HEIGHT_PX` (in `scene/palette.ts`),
  rendering the visible world-south and world-east faces plus the top
  diamond.
- Actors stand upright at their projected feet position — sprites must
  be drawn feet-anchored.
- Light polygons are computed by `@hoard-engine/lighting` on the world
  plane in world pixels and projected at draw time (`render.ts`); a
  ground-plane light disk squishes into an ellipse under the
  projection. The lighting package needs no changes for iso.

If real verticality ever appears (platforms at different heights,
jumping), that is a simulation change — entities grow `z`/`vz`, the
tilemap grows height data, physics grows "standing on" checks — decide
it before it half-happens in the renderer.

## HOARD engine packages

Standalone npm packages under the `@hoard-engine/*` scope (spec:
`drakriddarna/docs/engine-packages.md`, sibling folders in this repo).
Dependency-free leaves designed pluggable, interoperable and standalone:

- **`@hoard-engine/grid`** — cell helpers, line of sight, door/wall
  edges (the gating primitives for locked doors and ability gates),
  callback-driven pathfinding, corner classification. The tilemap in
  `world/tilemap.ts` is plain string rows over its cell tokens
  (`WALL = '#'`).
- **`@hoard-engine/lighting`** — visibility-polygon light maps on the
  tile grid (fog, flicker, gas). The scene composes it through
  `scene/lightingEnv.ts`: everything the package knows about the world
  arrives via the three `LightingEnv` callbacks.
- **`@hoard-engine/rng`** — the seedable stream; `game/rng.ts` is the
  only game module that touches it.
- **`@hoard-engine/saves`** — versioned save framework;
  `saves/saveSchema.ts` registers the game's migration steps.
- **`@hoard-engine/audio`** — sample playback + intensity-driven
  crossfade. The future browser adapter goes in `audio/`; logic only
  emits cue ids from `audio/cueTable.ts`.
- **`@hoard-engine/directors`** — hook/dispatch primitives for game
  pacing directors.
- **`@hoard-engine/primitives`** — theme tokens, text, geometry,
  clipping.
- **`@hoard-engine/uikit`** — canvas UI chrome (menus, dialogs,
  panels) built on primitives.

Rules for consuming them (they are contracts, a framework):

- Packages import nothing (uikit imports primitives). Never import one
  package from another in game code; the game is the only composition
  root — only `src/game/game.ts` and the Svelte layer know that grid
  feeds lighting feeds rendering.
- Consume through package entry points only; game-side facades and
  adapters (`tilemap.ts`, `lightingEnv.ts`, `rng.ts`, future audio
  adapter) are where game vocabulary maps into package contracts.
  Keep `Position`-style shapes structural — do not create a shared
  game-wide types hub beyond the per-module contracts.
- Reverse boundary (enforced by eslint): logic modules under `src/game/`
  may not import `@hoard-engine/uikit`; canvas chrome goes through
  scene/UI adapters. New UI chrome composes kit widgets/components,
  which receive plain view models and the theme — no style literals, no
  default strings.
- Keep game-specific time and input policy in this project; add shared
  engine packages only when more than one consumer demonstrates a need.
- Package development happens in the sibling folders (`../grid`,
  `../lighting`, ...), published on npm; this repo consumes published
  versions. When a module here solidifies enough to extract (the rng
  pattern in the spec), the extraction becomes a new sibling package
  folder with its own tooling — never a subfolder of this game.

## Areas and travel

- An area is data (`world/area.ts`): a tilemap, its doors, its spawn
  cell and its lights. Areas register in `world/areas.ts`; new areas are
  added there — never by editing core code.
- A door is a walkable gap cell marked `D` in the tilemap rows plus an
  `AreaDoor` entry linking to a target area's door. Door cells are not
  solid; the renderer draws them in the door tile color.
- Travel is the composition root swapping the current area
  (`game.ts` `travelThrough`): rebuild the collision/lighting contracts
  and occlusion key for the new tilemap, land the player at the target
  door's `spawnCell`, snap the camera. It triggers when the player's
  center enters a door cell.
- `spawnCell` on a door is the _arrival_ position for travelers coming
  through that door — authored content, always one cell inside the area
  (never the door cell itself, so arrival never immediately re-triggers
  travel). The area's `spawnCell` is where new games start.
- `world/areas.test.ts` enforces the content invariants: rectangular
  rows, door cells carry the `D` token, all spawns walkable, door
  links resolve and are bidirectional. Extend it when adding invariant
  kinds.
- The player's current area persists as `currentAreaId` in the save
  schema (`saves/saveSchema.ts`, migration v2).

## Ronja's game content

- The opening sequence lives in `intro.ts`; it is advanced from the game
  composition root and rendered over the isometric scene.
- The restaurant and street are graybox areas in `world/areas.ts`; the
  front door links the restaurant to the street.
- Preserve the story beats supplied by the owner. Ask before inventing
  additional dialogue, characters, or plot details.

## Code style

- Prettier with single quotes, 2-space indent, trailing commas
  (`npm run prettier:format`).
- ESLint is strict TypeScript: `no-console` and `no-explicit-any` are
  errors.
- Prefer `import type` for type-only imports; relative imports within
  `src/`.
- Tests are colocated as `*.test.ts` next to the code they cover; add
  tests for any behavior change, especially in `engine/` and `world/`.
- TypeScript is in strict mode — no `any`, no unchecked assertions
  where avoidable.

## Content note

Game design, area layouts and other authored content decisions are the
owner's (mirroring drakriddarna's AI policy, `drakriddarna/README.md`):
stop and ask instead of inventing world content, story text or balance.
Graybox geometry and placeholder tokens are fine to write as scaffolding.
