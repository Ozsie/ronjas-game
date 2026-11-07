export const MAX_STAMINA = 12;
export const STAMINA_DRAIN_PER_SECOND = 4;

export const LOW_STAMINA_THRESHOLD = MAX_STAMINA * 0.3;
const NORMAL_RECOVERY_PER_SECOND = 2;
const LOW_RECOVERY_PER_SECOND = 1;

export type StaminaPool = {
  value: number;
  running: boolean;
  recoveryPerSecond: number;
};

export const createStaminaPool = (): StaminaPool => ({
  value: MAX_STAMINA,
  running: false,
  recoveryPerSecond: NORMAL_RECOVERY_PER_SECOND,
});

export const advanceStamina = (
  pool: StaminaPool,
  running: boolean,
  deltaSeconds: number,
): StaminaPool => {
  const delta = Math.max(deltaSeconds, 0);
  if (running && pool.value > 0) {
    return {
      ...pool,
      value: Math.max(0, pool.value - STAMINA_DRAIN_PER_SECOND * delta),
      running: true,
    };
  }

  const recoveryPerSecond = pool.running
    ? pool.value >= LOW_STAMINA_THRESHOLD
      ? NORMAL_RECOVERY_PER_SECOND
      : LOW_RECOVERY_PER_SECOND
    : pool.recoveryPerSecond;
  return {
    value: Math.min(MAX_STAMINA, pool.value + recoveryPerSecond * delta),
    running: false,
    recoveryPerSecond,
  };
};
