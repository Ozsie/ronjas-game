import { describe, expect, it } from 'vitest';
import {
  CHARACTER_IDS,
  characterFrame,
  characterDirectionForMotion,
  customerCharacterForDay,
} from './characters';

describe('character sprites', () => {
  it('registers the requested character assets', () => {
    expect(CHARACTER_IDS).toEqual([
      'barista',
      'resident',
      'office-worker',
      'courier',
      'maintenance-worker',
      'rogue',
      'vampire-count',
      'vampire-countess',
      'blood-alchemist',
    ]);
  });

  it('uses the resident, office-worker and courier across the opening days', () => {
    expect([0, 1, 2].map(customerCharacterForDay)).toEqual([
      'resident',
      'office-worker',
      'courier',
    ]);
  });

  it('keeps the previous facing direction while idle and faces movement', () => {
    expect(characterDirectionForMotion(0, 0, 'west')).toBe('west');
    expect(characterDirectionForMotion(1, 0, 'south')).toBe('east');
    expect(characterDirectionForMotion(0, -1, 'south')).toBe('north');
  });

  it('keeps a stable facing near diagonal movement and changes on a clear turn', () => {
    expect(characterDirectionForMotion(1, 1.1, 'east')).toBe('east');
    expect(characterDirectionForMotion(1, 1.1, 'south')).toBe('south');
    expect(characterDirectionForMotion(1, 1.3, 'east')).toBe('south');
    expect(characterDirectionForMotion(-1, 0.2, 'east')).toBe('west');
  });

  it('selects directional idle and walking atlas frames at their authored rates', () => {
    expect(characterFrame('idle', 'east', 600)).toEqual({
      sx: 128,
      sy: 64,
      sw: 64,
      sh: 64,
    });
    expect(characterFrame('walk', 'west', 800)).toEqual({
      sx: 0,
      sy: 192,
      sw: 64,
      sh: 64,
    });
  });

  it('selects frames from the 80-pixel enemy atlases', () => {
    expect(characterFrame('walk', 'west', 800, 80, 8)).toEqual({
      sx: 0,
      sy: 240,
      sw: 80,
      sh: 80,
    });
  });
});
