import type { Entity } from '../engine/entity';
import type { CollisionEnv } from '../engine/physics';
import type { DialogLine } from '../dialog';
import type { IntroBeat } from '../intro';
import type { CharacterId } from '../scene/characters';
import type { Area } from './area';

export type AreaFeatureAction = 'interact' | 'skip' | 'escape';

export type AreaFeatureActor = {
  entity: Entity;
  characterId: CharacterId;
  displayName?: string;
  displayNameDistance?: number;
};

export type AreaFeatureDialogue = {
  line: DialogLine;
  prompt: string;
  blocksMovement: boolean;
};

export type AreaFeatureEncounter = {
  enemy: AreaFeatureActor;
};

export type AreaFeaturePresentation = {
  actors: AreaFeatureActor[];
  encounter?: AreaFeatureEncounter;
  dialogue?: AreaFeatureDialogue;
  intro?: IntroBeat;
  showSkipButton?: boolean;
  hidePlayer?: boolean;
  lightCarrier?: Entity;
};

export type AreaFeatureUpdate = {
  blocksPlayer?: boolean;
  cameraFocus?: { x: number; y: number };
  playerPosition?: { x: number; y: number };
};

export type AreaFeatureContext = {
  area: Area;
  player: Entity;
};

export type AreaFeatureRuntime = {
  update: (stepMs: number, collisionEnv: CollisionEnv) => AreaFeatureUpdate;
  handleAction: (action: AreaFeatureAction) => void;
  reset: () => void;
  presentation: () => AreaFeaturePresentation;
};

export type AreaFeatureFactory = (
  context: AreaFeatureContext,
) => AreaFeatureRuntime;

export type AreaFeatureController = {
  update: (stepMs: number, collisionEnv: CollisionEnv) => AreaFeatureUpdate;
  handleAction: (action: AreaFeatureAction) => void;
  reset: () => void;
  presentation: () => AreaFeaturePresentation;
};

export const createAreaFeatureController = (
  area: Area,
  player: Entity,
): AreaFeatureController => {
  const features = (area.features ?? []).map((createFeature) =>
    createFeature({ area, player }),
  );

  return {
    update: (stepMs, collisionEnv) => {
      let blocksPlayer = false;
      let cameraFocus: AreaFeatureUpdate['cameraFocus'];
      let playerPosition: AreaFeatureUpdate['playerPosition'];

      for (const feature of features) {
        const update = feature.update(stepMs, collisionEnv);
        blocksPlayer ||= update.blocksPlayer ?? false;
        cameraFocus ??= update.cameraFocus;
        playerPosition ??= update.playerPosition;
      }

      return { blocksPlayer, cameraFocus, playerPosition };
    },
    handleAction: (action) => {
      for (const feature of features) feature.handleAction(action);
    },
    reset: () => {
      for (const feature of features) feature.reset();
    },
    presentation: () => {
      const presentations = features.map((feature) => feature.presentation());
      const dialogue = presentations.find((view) => view.dialogue)?.dialogue;
      const intro = presentations.find((view) => view.intro)?.intro;
      const lightCarrier = presentations.find(
        (view) => view.lightCarrier,
      )?.lightCarrier;
      const encounter = presentations.find((view) => view.encounter)?.encounter;

      return {
        actors: presentations.flatMap((view) => view.actors),
        ...(encounter ? { encounter } : {}),
        ...(dialogue ? { dialogue } : {}),
        ...(intro ? { intro } : {}),
        showSkipButton: presentations.some((view) => view.showSkipButton),
        hidePlayer: presentations.some((view) => view.hidePlayer),
        ...(lightCarrier ? { lightCarrier } : {}),
      };
    },
  };
};
