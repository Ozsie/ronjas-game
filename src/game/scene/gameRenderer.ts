import type { Camera } from '@hoard-engine/camera';
import { createLight, type LightingEnv } from '@hoard-engine/lighting';
import { createIsoView, type IsoProjection } from '@hoard-engine/scene';
import type { Entity } from '../engine/entity';
import type { CollisionEnv } from '../engine/physics';
import { drawDialogPanel } from '../dialogView';
import { drawIntroOverlay, drawSkipButton } from '../intro';
import type { Area } from '../world/area';
import type { AreaFeaturePresentation } from '../world/areaFeatures';
import { INITIAL_AREA_ID } from '../world/areas';
import {
  FOREST_DECORATIONS,
  type ForestDecorationKind,
  FOREST_TREES,
  type ForestTreeKind,
} from '../world/areas/forest/area';
import { RESTAURANT_FIXTURES } from '../world/areas/restaurant/area';
import { STREET_FIXTURES } from '../world/areas/street/area';
import {
  type CharacterDirection,
  type CharacterId,
  type CharacterSpriteSheets,
} from './characters';
import {
  drawCollisionDebug,
  drawLights,
  drawWorldFrame,
  type CafeteriaAssets,
  type ForestDecorationAssets,
} from './render';

export type GameRenderState = {
  area: Area;
  camera: Camera;
  projection: IsoProjection;
  player: Entity;
  features: AreaFeaturePresentation;
  collisionEnv: CollisionEnv;
  lightingEnv: LightingEnv;
  occlusionKey: string;
  collisionDebugEnabled: boolean;
};

export type GameRenderer = {
  render: (state: GameRenderState, frameMs: number) => void;
};

const loadImage = (path: string): HTMLImageElement => {
  const image = new Image();
  image.src = `${import.meta.env.BASE_URL}${path}`;
  return image;
};

const loadCharacterSprites = (
  characterId: CharacterId,
): CharacterSpriteSheets => {
  const assetPath = `characters/${characterId}/assets`;
  return {
    idle: loadImage(`${assetPath}/idle.png`),
    walk: loadImage(`${assetPath}/walk.png`),
  };
};

const loadCafeteriaAsset = (name: string): HTMLImageElement =>
  loadImage(`assets/cafeteria/${name}.png`);

const loadForestDecoration = (kind: ForestDecorationKind): HTMLImageElement =>
  loadImage(`assets/forest/decorations/${kind}.png`);

const loadForestTree = (kind: ForestTreeKind): HTMLImageElement =>
  loadImage(`assets/forest/trees/${kind}.png`);

const playerLightAt = (player: Entity, cellSize: number) =>
  createLight(player.x / cellSize - 0.5, player.y / cellSize - 0.5, undefined, {
    id: 'player-light',
    color: '#BFE8FF',
    radius: 5,
    intensity: 0.32,
  });

export const createGameRenderer = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): GameRenderer => {
  const characterSprites: Record<CharacterId, CharacterSpriteSheets> = {
    barista: loadCharacterSprites('barista'),
    resident: loadCharacterSprites('resident'),
    'office-worker': loadCharacterSprites('office-worker'),
    courier: loadCharacterSprites('courier'),
    'maintenance-worker': loadCharacterSprites('maintenance-worker'),
  };
  const cafeteriaAssets: CafeteriaAssets = {
    floor: loadCafeteriaAsset('floor_checker_vinyl'),
    table: loadCafeteriaAsset('cafeteria_table'),
    fruitBasket: loadCafeteriaAsset('fruit_basket'),
    kitchenRange: loadCafeteriaAsset('kitchen_range'),
    reachInFridge: loadCafeteriaAsset('reach_in_fridge'),
    trashBin: loadCafeteriaAsset('trash_bin'),
    vendingMachine: loadCafeteriaAsset('vending_machine'),
  };
  const forestAssets: ForestDecorationAssets = {
    bracken_clump_with_drooping_fronds: loadForestDecoration(
      'bracken_clump_with_drooping_fronds',
    ),
    brown_mushroom_with_a_forked_cap: loadForestDecoration(
      'brown_mushroom_with_a_forked_cap',
    ),
    clump_of_cattails_with_brown_seed_heads: loadForestDecoration(
      'clump_of_cattails_with_brown_seed_heads',
    ),
    cluster_of_mustard_mushrooms_with_funnel_caps: loadForestDecoration(
      'cluster_of_mustard_mushrooms_with_funnel_caps',
    ),
    tall_pampas_grass_clump_with_cream_plumes: loadForestDecoration(
      'tall_pampas_grass_clump_with_cream_plumes',
    ),
    forked_birch_sapling_with_a_black_bark_band: loadForestTree(
      'forked_birch_sapling_with_a_black_bark_band',
    ),
    linden_tree_with_heart_shaped_leaves: loadForestTree(
      'linden_tree_with_heart_shaped_leaves',
    ),
    pine_sapling_with_a_bent_tip: loadForestTree(
      'pine_sapling_with_a_bent_tip',
    ),
    sycamore_tree_with_a_thick_trunk: loadForestTree(
      'sycamore_tree_with_a_thick_trunk',
    ),
    walnut_tree_with_a_broad_crown: loadForestTree(
      'walnut_tree_with_a_broad_crown',
    ),
    young_apple_tree_with_red_apples: loadForestTree(
      'young_apple_tree_with_red_apples',
    ),
  };
  const actorDirections = new Map<string, CharacterDirection>();
  let animationTimeMs = 0;

  return {
    render: (state, frameMs) => {
      animationTimeMs += Math.max(frameMs, 0);
      const { area, camera, features, player, projection } = state;
      const cellSize = area.tilemap.cellSize;
      const view = createIsoView(
        camera,
        canvas.width,
        canvas.height,
        cellSize,
        projection,
      );
      const actors = [
        ...(features.hidePlayer
          ? []
          : [{ entity: player, character: characterSprites.barista }]),
        ...features.actors.map((actor) => ({
          entity: actor.entity,
          character: characterSprites[actor.characterId],
          ...(actor.displayName &&
          (actor.displayNameDistance === undefined ||
            Math.hypot(player.x - actor.entity.x, player.y - actor.entity.y) <=
              actor.displayNameDistance)
            ? { name: actor.displayName }
            : {}),
        })),
      ];
      const fixtures =
        area.id === INITIAL_AREA_ID
          ? RESTAURANT_FIXTURES
          : area.id === 'street'
            ? STREET_FIXTURES
            : area.id === 'forest'
              ? [...FOREST_TREES, ...FOREST_DECORATIONS]
              : [];
      const fixtureKind =
        area.id === INITIAL_AREA_ID
          ? 'restaurant'
          : area.id === 'street'
            ? 'street'
            : area.id === 'forest'
              ? 'forest'
              : null;
      drawWorldFrame(
        ctx,
        area.tilemap,
        view,
        actors,
        animationTimeMs,
        actorDirections,
        fixtures,
        fixtureKind,
        area.id === INITIAL_AREA_ID ? cafeteriaAssets : undefined,
        area.id === 'forest' ? forestAssets : undefined,
      );
      const lightCarrier = features.lightCarrier ?? player;
      drawLights(
        ctx,
        [...area.lights, playerLightAt(lightCarrier, cellSize)],
        state.lightingEnv,
        state.occlusionKey,
        cellSize,
        view,
        performance.now(),
      );
      if (state.collisionDebugEnabled) {
        drawCollisionDebug(
          ctx,
          area.tilemap,
          view,
          state.collisionEnv,
          features.hidePlayer ? (features.actors[0]?.entity ?? player) : player,
        );
      }
      if (features.intro) {
        drawIntroOverlay(ctx, canvas.width, canvas.height, features.intro);
      }
      if (features.dialogue) {
        drawDialogPanel(
          ctx,
          canvas.width,
          canvas.height,
          features.dialogue.line,
          features.dialogue.prompt,
        );
      }
      if (features.showSkipButton) drawSkipButton(ctx, canvas.width);
    },
  };
};
