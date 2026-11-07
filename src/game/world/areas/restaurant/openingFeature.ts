import type {
  AreaFeatureFactory,
  AreaFeaturePresentation,
} from '../../areaFeatures';
import {
  createOpeningState,
  openingDialogue,
  skipOpening,
  updateOpening,
} from '../../../opening';
import { customerCharacterForDay } from '../../../scene/characters';
import { RESTAURANT_STATIONS } from './stations';

export const createOpeningFeature: AreaFeatureFactory = ({ area, player }) => {
  const opening = createOpeningState(area.tilemap, RESTAURANT_STATIONS);
  let handoffPending = false;

  return {
    update: (stepMs, collisionEnv) => {
      const wasActive = !opening.complete;
      if (wasActive) {
        updateOpening(
          opening,
          stepMs,
          area.tilemap,
          RESTAURANT_STATIONS,
          collisionEnv,
        );
        handoffPending ||= opening.complete;
      }

      const focus = opening.customer
        ? {
            x: (opening.ronja.x + opening.customer.x) / 2,
            y: (opening.ronja.y + opening.customer.y) / 2,
          }
        : {
            x: (opening.ronja.x + player.x) / 2,
            y: (opening.ronja.y + player.y) / 2,
          };
      const playerPosition = handoffPending
        ? { x: opening.ronja.x, y: opening.ronja.y }
        : undefined;
      handoffPending = false;

      return {
        blocksPlayer: wasActive || playerPosition !== undefined,
        ...(wasActive ? { cameraFocus: focus } : {}),
        ...(playerPosition ? { playerPosition } : {}),
      };
    },
    handleAction: (action) => {
      if (action === 'skip' && !opening.complete) {
        skipOpening(opening, area.tilemap, RESTAURANT_STATIONS);
        handoffPending = true;
      }
    },
    reset: () => {},
    presentation: (): AreaFeaturePresentation => {
      const active = !opening.complete;
      const intro = active ? openingDialogue(opening) : null;
      return {
        actors: active
          ? [
              { entity: opening.ronja, characterId: 'barista' },
              ...(opening.customer
                ? [
                    {
                      entity: opening.customer,
                      characterId: customerCharacterForDay(opening.dayIndex),
                    },
                  ]
                : []),
            ]
          : [],
        ...(intro ? { intro } : {}),
        showSkipButton: active,
        hidePlayer: active,
        ...(active ? { lightCarrier: opening.ronja } : {}),
      };
    },
  };
};
