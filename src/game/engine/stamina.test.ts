import { describe, expect, it } from 'vitest';
import {
  advanceStamina,
  createStaminaPool,
  LOW_STAMINA_THRESHOLD,
  MAX_STAMINA,
  STAMINA_DRAIN_PER_SECOND,
} from './stamina';

describe('stamina pool', () => {
  it('starts full and drains at the configured rate while running', () => {
    const stamina = advanceStamina(createStaminaPool(), true, 1);

    expect(stamina.value).toBe(MAX_STAMINA - STAMINA_DRAIN_PER_SECOND);
    expect(stamina.running).toBe(true);
  });

  it('recovers at two points per second when stopping at or above the threshold', () => {
    const running = advanceStamina(
      createStaminaPool(),
      true,
      (MAX_STAMINA - LOW_STAMINA_THRESHOLD) / STAMINA_DRAIN_PER_SECOND,
    );
    const resting = advanceStamina(running, false, 1);

    expect(running.value).toBe(LOW_STAMINA_THRESHOLD);
    expect(resting.value).toBe(LOW_STAMINA_THRESHOLD + 2);
  });

  it('recovers at one point per second when stopping below the threshold', () => {
    const running = advanceStamina(
      createStaminaPool(),
      true,
      (MAX_STAMINA - (LOW_STAMINA_THRESHOLD - 1)) / STAMINA_DRAIN_PER_SECOND,
    );
    const resting = advanceStamina(running, false, 1);

    expect(running.value).toBe(LOW_STAMINA_THRESHOLD - 1);
    expect(resting.value).toBe(LOW_STAMINA_THRESHOLD);
  });

  it('never drains below zero or recovers above maximum', () => {
    const exhausted = advanceStamina(createStaminaPool(), true, 10);
    const full = advanceStamina(createStaminaPool(), false, 10);

    expect(exhausted.value).toBe(0);
    expect(full.value).toBe(MAX_STAMINA);
  });
});
