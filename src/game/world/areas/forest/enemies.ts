import { createEntity } from '../../../engine/entity';
import { moveAabb, type CollisionEnv } from '../../../engine/physics';
import type { Entity } from '../../../engine/entity';
import type {
  AreaFeatureActor,
  AreaFeatureEncounter,
  AreaFeatureFactory,
} from '../../areaFeatures';
import { cellCenter } from '../../tilemap';
import type { CharacterId } from '../../../scene/characters';

export const FOREST_ENEMIES = [
  { id: 'forest-rogue', characterId: 'rogue', cellX: 50, cellY: 22 },
  {
    id: 'forest-vampire-count',
    characterId: 'vampire-count',
    cellX: 35,
    cellY: 46,
  },
  {
    id: 'forest-vampire-countess',
    characterId: 'vampire-countess',
    cellX: 65,
    cellY: 46,
  },
  {
    id: 'forest-blood-alchemist',
    characterId: 'blood-alchemist',
    cellX: 50,
    cellY: 70,
  },
] as const satisfies ReadonlyArray<{
  id: string;
  characterId: CharacterId;
  cellX: number;
  cellY: number;
}>;

const ENEMY_HALF_EXTENTS = { halfWidth: 8, halfHeight: 8 };
const CHASE_RADIUS_CELLS = 8;
const ENEMY_SPEED_PX_PER_S = 56;

const isTouching = (first: Entity, second: Entity): boolean =>
  Math.abs(first.x - second.x) <= first.halfWidth + second.halfWidth &&
  Math.abs(first.y - second.y) <= first.halfHeight + second.halfHeight;

const moveEnemy = (
  enemy: Entity,
  player: Entity,
  collisionEnv: CollisionEnv,
  stepMs: number,
): void => {
  const deltaX = player.x - enemy.x;
  const deltaY = player.y - enemy.y;
  const distance = Math.hypot(deltaX, deltaY);
  const chaseRadius = collisionEnv.cellSize * CHASE_RADIUS_CELLS;
  if (distance > chaseRadius || distance === 0 || stepMs <= 0) {
    enemy.vx = 0;
    enemy.vy = 0;
    return;
  }

  const seconds = stepMs / 1000;
  const movement = moveAabb(
    enemy,
    (deltaX / distance) * ENEMY_SPEED_PX_PER_S * seconds,
    (deltaY / distance) * ENEMY_SPEED_PX_PER_S * seconds,
    collisionEnv,
  );
  enemy.vx = (movement.x - enemy.x) / seconds;
  enemy.vy = (movement.y - enemy.y) / seconds;
  enemy.x = movement.x;
  enemy.y = movement.y;
};

export const createForestEnemiesFeature: AreaFeatureFactory = ({
  area,
  player,
}) => {
  const enemies: AreaFeatureActor[] = FOREST_ENEMIES.map((definition) => ({
    entity: createEntity(
      definition.id,
      cellCenter(area.tilemap, definition.cellX, definition.cellY),
      ENEMY_HALF_EXTENTS,
    ),
    characterId: definition.characterId,
  }));
  let encounter: AreaFeatureEncounter | null = null;

  return {
    update: (stepMs, collisionEnv) => {
      if (encounter) return { blocksPlayer: true };

      for (const enemy of enemies) {
        if (isTouching(player, enemy.entity)) {
          encounter = { enemy };
          break;
        }
        moveEnemy(enemy.entity, player, collisionEnv, stepMs);
        if (isTouching(player, enemy.entity)) {
          enemy.entity.vx = 0;
          enemy.entity.vy = 0;
          encounter = { enemy };
          break;
        }
      }

      return { blocksPlayer: encounter !== null };
    },
    handleAction: (action) => {
      if (action !== 'escape' || !encounter) return;

      const enemyIndex = enemies.indexOf(encounter.enemy);
      if (enemyIndex !== -1) enemies.splice(enemyIndex, 1);
      encounter = null;
    },
    reset: () => {
      encounter = null;
      enemies.forEach(({ entity }) => {
        entity.vx = 0;
        entity.vy = 0;
      });
    },
    presentation: () => ({
      actors: enemies,
      ...(encounter ? { encounter } : {}),
    }),
  };
};
