import type { DialogLine } from './dialog';

export type DialogPanelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const dialogPanelBounds = (
  width: number,
  height: number,
): DialogPanelBounds => {
  const panelWidth = Math.max(0, Math.min(width - 32, 560));
  const panelHeight = 148;
  return {
    x: (width - panelWidth) / 2,
    y: Math.max(12, height - panelHeight - 24),
    width: panelWidth,
    height: panelHeight,
  };
};

export const isDialogPanelHit = (
  bounds: DialogPanelBounds,
  x: number,
  y: number,
): boolean =>
  x >= bounds.x &&
  x <= bounds.x + bounds.width &&
  y >= bounds.y &&
  y <= bounds.y + bounds.height;

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export const drawDialogPanel = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  line: DialogLine,
  prompt: string,
): void => {
  const bounds = dialogPanelBounds(width, height);
  ctx.save();
  ctx.fillStyle = 'rgba(23, 17, 15, 0.9)';
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.strokeStyle = '#E5A72F';
  ctx.lineWidth = 2;
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFD45E';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(line.speaker ?? '', bounds.x + 24, bounds.y + 18);
  ctx.fillStyle = '#F4ECE5';
  ctx.font = '16px sans-serif';
  wrapText(ctx, line.text, bounds.width - 48).forEach((textLine, index) => {
    ctx.fillText(textLine, bounds.x + 24, bounds.y + 50 + index * 21);
  });
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFD45E';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(prompt, bounds.x + bounds.width - 24, bounds.y + 118);
  ctx.restore();
};
