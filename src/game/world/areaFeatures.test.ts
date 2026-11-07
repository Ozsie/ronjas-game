import { describe, expect, it } from 'vitest';
import { createEntity } from '../engine/entity';
import { RESTAURANT_STATIONS } from './areas/restaurant/area';
import { getArea, createAreaCollisionEnv } from './areas';
import { createAreaFeatureController } from './areaFeatures';
import { cellCenter } from './tilemap';

describe('area feature registration', () => {
  it('updates and presents the street interaction registered by its area', () => {
    const area = getArea('street');
    const player = createEntity('player', cellCenter(area.tilemap, 2, 10), {
      halfWidth: 8,
      halfHeight: 8,
    });
    const features = createAreaFeatureController(area, player);

    features.update(16, createAreaCollisionEnv(area));
    expect(features.presentation().actors).toHaveLength(1);
    expect(features.presentation().dialogue?.line.text).toBe(
      'Hey, come here for a bit.',
    );

    features.handleAction('interact');
    expect(features.update(16, createAreaCollisionEnv(area)).blocksPlayer).toBe(
      true,
    );
    expect(features.presentation().dialogue?.line.text).toBe(
      'There is a legendary ice cream machine said to be somewhere in the forest.',
    );
  });

  it('registers the restaurant script and hands control back after skipping', () => {
    const area = getArea('restaurant');
    const player = createEntity(
      'player',
      cellCenter(area.tilemap, area.spawnCell.x, area.spawnCell.y),
      { halfWidth: 8, halfHeight: 8 },
    );
    const features = createAreaFeatureController(area, player);

    expect(features.presentation()).toMatchObject({
      hidePlayer: true,
      showSkipButton: true,
    });

    features.handleAction('skip');
    const handoff = features.update(16, createAreaCollisionEnv(area));
    expect(handoff).toMatchObject({
      blocksPlayer: true,
      playerPosition: {
        x: (RESTAURANT_STATIONS.iceCreamMachine.x + 0.5) * 32,
        y: (RESTAURANT_STATIONS.iceCreamMachine.y + 0.5) * 32,
      },
    });
    expect(features.presentation()).toMatchObject({
      hidePlayer: false,
      showSkipButton: false,
    });
    expect(features.update(16, createAreaCollisionEnv(area)).blocksPlayer).toBe(
      false,
    );
  });
});
