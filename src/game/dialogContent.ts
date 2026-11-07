import type { DialogDefinition } from './dialog';

export const STRANGE_MAN_DIALOG: DialogDefinition = {
  start: 'greeting-first',
  nodes: {
    'greeting-first': {
      speaker: 'Strange Man',
      text: 'Hey, come here for a bit.',
    },
    'greeting-second': {
      speaker: 'Strange Man',
      text: 'You, I think I know something you need.',
    },
    machine: {
      speaker: 'Strange Man',
      text: 'There is a legendary ice cream machine said to be somewhere in the forest.',
      next: 'warning',
    },
    warning: {
      speaker: 'Strange Man',
      text: 'The forest can be dangerous.',
    },
  },
};
