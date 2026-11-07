import { describe, expect, it } from 'vitest';
import {
  advanceDialog,
  chooseDialogOption,
  currentDialogNode,
  startDialog,
  type DialogDefinition,
} from './dialog';

const DIALOG: DialogDefinition = {
  start: 'greeting',
  nodes: {
    greeting: {
      speaker: 'Guide',
      text: 'Welcome.',
      next: 'question',
    },
    question: {
      text: 'What would you like to do?',
      choices: [
        { id: 'stay', text: 'Stay here.', next: 'stay' },
        { id: 'leave', text: 'Leave.' },
      ],
    },
    stay: { text: 'All right.' },
  },
};

describe('dialog runtime', () => {
  it('starts at the initial node and advances through sequential lines', () => {
    const state = startDialog(DIALOG);

    expect(currentDialogNode(state)).toMatchObject({
      speaker: 'Guide',
      text: 'Welcome.',
    });
    expect(currentDialogNode(advanceDialog(state))?.text).toBe(
      'What would you like to do?',
    );
  });

  it('can start a sequence at a named node for separately triggered beats', () => {
    const state = startDialog(DIALOG, 'question');

    expect(currentDialogNode(state)?.text).toBe('What would you like to do?');
  });

  it('waits for a choice and follows the selected branch', () => {
    const question = advanceDialog(startDialog(DIALOG));

    expect(advanceDialog(question)).toBe(question);
    expect(chooseDialogOption(question, 'missing')).toBe(question);
    expect(currentDialogNode(chooseDialogOption(question, 'stay'))?.text).toBe(
      'All right.',
    );
    expect(currentDialogNode(chooseDialogOption(question, 'leave'))).toBeNull();
  });

  it('ends after the final line and leaves ended state unchanged', () => {
    const ended = advanceDialog(
      chooseDialogOption(advanceDialog(startDialog(DIALOG)), 'stay'),
    );

    expect(currentDialogNode(ended)).toBeNull();
    expect(advanceDialog(ended)).toBe(ended);
  });

  it('rejects missing destinations and ambiguous nodes', () => {
    expect(() =>
      startDialog({ start: 'missing', nodes: { line: { text: 'Text.' } } }),
    ).toThrow(/starting dialog node/);
    expect(() =>
      startDialog({
        start: 'line',
        nodes: { line: { text: 'Text.', next: 'missing' } },
      }),
    ).toThrow(/Unknown next dialog node/);
    expect(() =>
      startDialog({
        start: 'line',
        nodes: {
          line: {
            text: 'Text.',
            next: 'end',
            choices: [{ id: 'choice', text: 'Choose.' }],
          },
          end: { text: 'Done.' },
        },
      }),
    ).toThrow(/both next and choices/);
  });
});
