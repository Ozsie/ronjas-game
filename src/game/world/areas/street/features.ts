import { createEntity } from '../../../engine/entity';
import { cellCenter } from '../../tilemap';
import type {
  AreaFeatureFactory,
  AreaFeaturePresentation,
} from '../../areaFeatures';
import { STRANGE_MAN } from './actors/strangeMan/actor';
import { createStrangeManInteraction } from './actors/strangeMan/interaction';

export const createStrangeManFeature: AreaFeatureFactory = ({
  area,
  player,
}) => {
  const actor = createEntity(
    STRANGE_MAN.id,
    cellCenter(area.tilemap, STRANGE_MAN.cellX, STRANGE_MAN.cellY),
    STRANGE_MAN.halfExtents,
  );
  const interaction = createStrangeManInteraction();

  return {
    update: () => ({ blocksPlayer: interaction.update(player, area) }),
    handleAction: (action) => {
      if (action === 'interact') interaction.requestUse();
    },
    reset: interaction.reset,
    presentation: (): AreaFeaturePresentation => {
      const dialogue = interaction.currentDialogue();
      return {
        actors: [
          {
            entity: actor,
            characterId: STRANGE_MAN.characterId,
            displayName: STRANGE_MAN.displayName,
            displayNameDistance: area.tilemap.cellSize * 1.5,
          },
        ],
        ...(dialogue
          ? {
              dialogue: {
                line: dialogue.line,
                prompt:
                  dialogue.kind === 'greeting'
                    ? 'E / TAP TO TALK'
                    : 'E / TAP TO CONTINUE',
                blocksMovement: dialogue.kind === 'conversation',
              },
            }
          : {}),
      };
    },
  };
};
