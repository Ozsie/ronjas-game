import type { Camera } from '@hoard-engine/camera';
import { createLight, type LightingEnv } from '@hoard-engine/lighting';
import {
  createIsoView,
  spriteAnchoredOrigin,
  type IsoProjection,
} from '@hoard-engine/scene';
import type { Entity } from '../engine/entity';
import type { CollisionEnv } from '../engine/physics';
import { drawStaminaHud, shouldShowStaminaHud } from './staminaHud';
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
  CHARACTER_SPRITE_CONFIG,
  characterFrame,
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
  stamina: number;
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
  const usesAnimationAssets = [
    'rogue',
    'vampire-count',
    'vampire-countess',
    'blood-alchemist',
  ].includes(characterId);
  const assetPath = `characters/${characterId}/${usesAnimationAssets ? 'animations' : 'assets'}`;
  const spriteConfig = CHARACTER_SPRITE_CONFIG[characterId] ?? {
    frameSize: 64,
    pivotX: 32,
    pivotY: 50,
  };
  return {
    idle: loadImage(`${assetPath}/idle.png`),
    walk: loadImage(`${assetPath}/walk.png`),
    ...spriteConfig,
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
    rogue: loadCharacterSprites('rogue'),
    'vampire-count': loadCharacterSprites('vampire-count'),
    'vampire-countess': loadCharacterSprites('vampire-countess'),
    'blood-alchemist': loadCharacterSprites('blood-alchemist'),
  };
  const forestCombatBackdrop = loadImage(
    'backdrops/1280x720/forest_clearing.png',
  );
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

  const drawCombatScene = (enemyCharacterId: CharacterId): void => {
    ctx.fillStyle = '#17201c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (
      forestCombatBackdrop.complete &&
      forestCombatBackdrop.naturalWidth > 0
    ) {
      const scale = Math.max(
        canvas.width / forestCombatBackdrop.naturalWidth,
        canvas.height / forestCombatBackdrop.naturalHeight,
      );
      const width = forestCombatBackdrop.naturalWidth * scale;
      const height = forestCombatBackdrop.naturalHeight * scale;
      ctx.drawImage(
        forestCombatBackdrop,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height,
      );
    }
    ctx.fillStyle = 'rgba(10, 14, 16, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawCombatant = (characterId: CharacterId, centerX: number): void => {
      const character = characterSprites[characterId];
      if (!character.idle.complete || character.idle.naturalWidth === 0) return;
      const frameCount = Math.max(
        1,
        Math.floor(character.idle.naturalWidth / character.frameSize),
      );
      const source = characterFrame(
        'idle',
        'south',
        animationTimeMs,
        character.frameSize,
        frameCount,
      );
      const size = Math.min(canvas.width * 0.22, canvas.height * 0.42);
      const feetY = canvas.height * 0.72;
      const origin = spriteAnchoredOrigin(
        { x: centerX, y: feetY },
        [character.pivotX, character.pivotY],
        [character.frameSize, character.frameSize],
        size,
        size,
      );
      ctx.drawImage(
        character.idle,
        source.sx,
        source.sy,
        source.sw,
        source.sh,
        origin.x,
        origin.y,
        size,
        size,
      );
    };
    drawCombatant('barista', canvas.width * 0.28);
    drawCombatant(enemyCharacterId, canvas.width * 0.72);

    ctx.fillStyle = '#fff4d9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(20, canvas.width * 0.045)}px sans-serif`;
    ctx.fillText('COMBAT', canvas.width / 2, canvas.height * 0.14);
    ctx.font = `bold ${Math.max(12, canvas.width * 0.018)}px sans-serif`;
    ctx.fillText(
      'Combat rules will be added later',
      canvas.width / 2,
      canvas.height * 0.91,
    );
  };

  return {
    render: (state, frameMs) => {
      animationTimeMs += Math.max(frameMs, 0);
      const { area, camera, features, player, projection } = state;
      if (features.encounter) {
        drawCombatScene(features.encounter.enemy.characterId);
        return;
      }
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
        drawCollisionDebug(ctx, area.tilemap, view, state.collisionEnv, [
          player,
          ...features.actors.map((actor) => actor.entity),
        ]);
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
      if (shouldShowStaminaHud(features)) {
        drawStaminaHud(ctx, state.stamina, animationTimeMs);
      }
    },
  };
};
