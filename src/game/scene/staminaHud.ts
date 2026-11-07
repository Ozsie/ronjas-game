import { LOW_STAMINA_THRESHOLD, MAX_STAMINA } from '../engine/stamina';
import type { AreaFeaturePresentation } from '../world/areaFeatures';

const HUD_X = 16;
const HUD_Y = 16;
const BAR_WIDTH = 160;
const BAR_HEIGHT = 12;

export const shouldShowStaminaHud = (
  features: AreaFeaturePresentation,
): boolean =>
  !features.intro &&
  !features.hidePlayer &&
  !features.showSkipButton &&
  !features.dialogue?.blocksMovement;

export const drawStaminaHud = (
  ctx: CanvasRenderingContext2D,
  stamina: number,
  elapsedMs: number,
): void => {
  const value = Math.max(0, Math.min(MAX_STAMINA, stamina));
  const isLow = value < LOW_STAMINA_THRESHOLD;
  const flashingWhite = isLow && Math.floor(elapsedMs / 250) % 2 === 0;

  ctx.save();
  ctx.fillStyle = 'rgba(23, 17, 15, 0.8)';
  ctx.fillRect(HUD_X - 8, HUD_Y - 8, BAR_WIDTH + 56, 48);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('STAMINA', HUD_X, HUD_Y);

  ctx.fillStyle = '#26352B';
  ctx.fillRect(HUD_X, HUD_Y + 20, BAR_WIDTH, BAR_HEIGHT);
  ctx.fillStyle = flashingWhite ? '#FFFFFF' : '#35C759';
  ctx.fillRect(
    HUD_X,
    HUD_Y + 20,
    (value / MAX_STAMINA) * BAR_WIDTH,
    BAR_HEIGHT,
  );
  ctx.restore();
};
