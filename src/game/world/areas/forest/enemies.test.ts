import { describe, expect, it } from 'vitest';
import { createEntity } from '../../../engine/entity';
import { createAreaCollisionEnv, getArea } from '../../areas';
import { createAreaFeatureController } from '../../areaFeatures';
import { cellCenter, isSolidCell } from '../../tilemap';
import { FOREST_ENEMIES } from './enemies';

describe('forest enemies', () => {
  it('places all four enemy characters in walkable forest cells', () => {
    const area = getArea('forest');
    const player = createEntity(
      'player',
      cellCenter(area.tilemap, area.spawnCell.x, area.spawnCell.y),
      { halfWidth: 8, halfHeight: 8 },
    );
    const features = createAreaFeatureController(area, player);

    expect(
      FOREST_ENEMIES.every(
        ({ cellX, cellY }) => !isSolidCell(area.tilemap, cellX, cellY),
      ),
    ).toBe(true);
    expect(features.presentation().actors).toMatchObject([
      { entity: { id: 'forest-rogue' }, characterId: 'rogue' },
      { entity: { id: 'forest-vampire-count' }, characterId: 'vampire-count' },
      {
        entity: { id: 'forest-vampire-countess' },
        characterId: 'vampire-countess',
      },
      {
        entity: { id: 'forest-blood-alchemist' },
        characterId: 'blood-alchemist',
      },
    ]);
  });

  it('keeps enemies at their spawn points until the player comes close', () => {
    const area = getArea('forest');
    const player = createEntity(
      'player',
      cellCenter(area.tilemap, area.spawnCell.x, area.spawnCell.y),
      { halfWidth: 8, halfHeight: 8 },
    );
    const features = createAreaFeatureController(area, player);
    const actors = features.presentation().actors;
    const startingPositions = actors.map(({ entity }) => ({
      x: entity.x,
      y: entity.y,
    }));

    features.update(1000, createAreaCollisionEnv(area));
    expect(actors.map(({ entity }) => ({ x: entity.x, y: entity.y }))).toEqual(
      startingPositions,
    );

    const rogue = actors[0]?.entity;
    if (!rogue) throw new Error('forest rogue is missing');
    player.x = rogue.x + area.tilemap.cellSize * 6;
    player.y = rogue.y;
    const previousDistance = Math.hypot(player.x - rogue.x, player.y - rogue.y);

    features.update(1000, createAreaCollisionEnv(area));
    expect(Math.hypot(player.x - rogue.x, player.y - rogue.y)).toBeLessThan(
      previousDistance,
    );
  });

  it('starts a paused combat encounter when the player touches an enemy', () => {
    const area = getArea('forest');
    const player = createEntity(
      'player',
      cellCenter(area.tilemap, area.spawnCell.x, area.spawnCell.y),
      { halfWidth: 8, halfHeight: 8 },
    );
    const features = createAreaFeatureController(area, player);
    const rogue = features.presentation().actors[0]?.entity;
    if (!rogue) throw new Error('forest rogue is missing');
    player.x = rogue.x;
    player.y = rogue.y;

    const update = features.update(16, createAreaCollisionEnv(area));

    expect(update.blocksPlayer).toBe(true);
    expect(features.presentation().encounter).toMatchObject({
      enemy: { characterId: 'rogue' },
    });
  });

  it('leaves combat and removes the encountered enemy on escape', () => {
    const area = getArea('forest');
    const player = createEntity(
      'player',
      cellCenter(area.tilemap, area.spawnCell.x, area.spawnCell.y),
      { halfWidth: 8, halfHeight: 8 },
    );
    const features = createAreaFeatureController(area, player);
    const rogue = features.presentation().actors[0]?.entity;
    if (!rogue) throw new Error('forest rogue is missing');
    player.x = rogue.x;
    player.y = rogue.y;
    features.update(16, createAreaCollisionEnv(area));

    features.handleAction('escape');

    expect(features.presentation().encounter).toBeUndefined();
    expect(
      features.presentation().actors.map(({ entity }) => entity.id),
    ).not.toContain('forest-rogue');
    expect(features.update(16, createAreaCollisionEnv(area)).blocksPlayer).toBe(
      false,
    );
  });
});
