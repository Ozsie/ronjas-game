import {
  advanceDialog,
  currentDialogNode,
  startDialog,
  type DialogNode,
  type DialogState,
} from '../../../../../dialog';
import type { Entity } from '../../../../../engine/entity';
import type { Area } from '../../../../area';
import { STRANGE_MAN } from './actor';
import { STRANGE_MAN_DIALOG } from './dialog';

export type StrangeManDialogue = {
  kind: 'greeting' | 'conversation';
  line: DialogNode;
};

export type StrangeManInteraction = {
  requestUse: () => void;
  update: (player: Entity, area: Area) => boolean;
  currentDialogue: () => StrangeManDialogue | null;
  reset: () => void;
};

export const createStrangeManInteraction = (): StrangeManInteraction => {
  let dialogue: {
    kind: StrangeManDialogue['kind'];
    session: DialogState;
  } | null = null;
  let greetingIndex = 0;
  let wasNear = false;
  let useRequested = false;

  const isNear = (player: Entity, area: Area): boolean =>
    area.id === 'street' &&
    Math.hypot(
      player.x - (STRANGE_MAN.cellX + 0.5) * area.tilemap.cellSize,
      player.y - (STRANGE_MAN.cellY + 0.5) * area.tilemap.cellSize,
    ) <=
      area.tilemap.cellSize * 1.5;

  return {
    requestUse: () => {
      useRequested = true;
    },
    update: (player, area) => {
      const near = isNear(player, area);
      if (!near && dialogue?.kind === 'greeting') {
        dialogue = null;
      }
      if (near && !wasNear && !dialogue) {
        const greetingNode =
          greetingIndex % 2 === 0 ? 'greeting-first' : 'greeting-second';
        dialogue = {
          kind: 'greeting',
          session: startDialog(STRANGE_MAN_DIALOG, greetingNode),
        };
        greetingIndex += 1;
      }
      wasNear = near;

      if (useRequested) {
        useRequested = false;
        if (near) {
          if (dialogue?.kind === 'conversation') {
            const session = advanceDialog(dialogue.session);
            dialogue = currentDialogNode(session)
              ? { kind: 'conversation', session }
              : null;
          } else {
            dialogue = {
              kind: 'conversation',
              session: startDialog(STRANGE_MAN_DIALOG, 'machine'),
            };
          }
        }
      }

      if (dialogue?.kind === 'conversation' && !near) {
        dialogue = null;
      }
      return dialogue?.kind === 'conversation';
    },
    currentDialogue: () => {
      if (!dialogue) return null;
      const line = currentDialogNode(dialogue.session);
      return line ? { kind: dialogue.kind, line } : null;
    },
    reset: () => {
      dialogue = null;
      wasNear = false;
    },
  };
};
