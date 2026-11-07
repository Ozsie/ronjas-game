import { describe, expect, it } from 'vitest';
import {
  advanceDialog,
  currentDialogNode,
  startDialog,
} from '../../../../../dialog';
import { STRANGE_MAN_DIALOG } from './dialog';

describe('Strange Man dialogue', () => {
  it('offers the two approach greetings and the forest information sequence', () => {
    expect(currentDialogNode(startDialog(STRANGE_MAN_DIALOG))?.text).toBe(
      'Hey, come here for a bit.',
    );
    expect(
      currentDialogNode(startDialog(STRANGE_MAN_DIALOG, 'greeting-second'))
        ?.text,
    ).toBe('You, I think I know something you need.');

    const machine = startDialog(STRANGE_MAN_DIALOG, 'machine');
    expect(currentDialogNode(machine)?.text).toBe(
      'There is a legendary ice cream machine said to be somewhere in the forest.',
    );
    const warning = advanceDialog(machine);
    expect(currentDialogNode(warning)?.text).toBe(
      'The forest can be dangerous.',
    );
    expect(currentDialogNode(advanceDialog(warning))).toBeNull();
  });
});
