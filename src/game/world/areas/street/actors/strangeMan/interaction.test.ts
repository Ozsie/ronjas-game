import { describe, expect, it } from 'vitest';
import { createEntity } from '../../../../../engine/entity';
import { getArea } from '../../../../areas';
import { createStrangeManInteraction } from './interaction';

describe('Strange Man interaction', () => {
  it('alternates approach greetings and advances the conversation on use', () => {
    const interaction = createStrangeManInteraction();
    const street = getArea('street');
    const player = createEntity(
      'player',
      { x: 2.5 * street.tilemap.cellSize, y: 10.5 * street.tilemap.cellSize },
      { halfWidth: 8, halfHeight: 8 },
    );

    expect(interaction.update(player, street)).toBe(false);
    expect(interaction.currentDialogue()?.line.text).toBe(
      'Hey, come here for a bit.',
    );

    player.x += street.tilemap.cellSize * 2;
    interaction.update(player, street);
    player.x -= street.tilemap.cellSize * 2;
    interaction.update(player, street);
    expect(interaction.currentDialogue()?.line.text).toBe(
      'You, I think I know something you need.',
    );

    interaction.requestUse();
    expect(interaction.update(player, street)).toBe(true);
    expect(interaction.currentDialogue()).toMatchObject({
      kind: 'conversation',
      line: {
        text: 'There is a legendary ice cream machine said to be somewhere in the forest.',
      },
    });

    interaction.requestUse();
    interaction.update(player, street);
    expect(interaction.currentDialogue()?.line.text).toBe(
      'The forest can be dangerous.',
    );
    interaction.requestUse();
    expect(interaction.update(player, street)).toBe(false);
    expect(interaction.currentDialogue()).toBeNull();
  });

  it('ends a conversation after the player leaves the street actor', () => {
    const interaction = createStrangeManInteraction();
    const street = getArea('street');
    const player = createEntity(
      'player',
      { x: 2.5 * street.tilemap.cellSize, y: 10.5 * street.tilemap.cellSize },
      { halfWidth: 8, halfHeight: 8 },
    );
    interaction.update(player, street);
    interaction.requestUse();
    interaction.update(player, street);

    player.x += street.tilemap.cellSize * 2;
    expect(interaction.update(player, street)).toBe(false);
    expect(interaction.currentDialogue()).toBeNull();
  });
});
