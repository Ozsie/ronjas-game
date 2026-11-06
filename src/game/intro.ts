export type IntroBeat = {
  day: string;
  speaker: string;
  text: string;
};

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

export const drawIntroOverlay = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  beat: IntroBeat,
): void => {
  const panelWidth = Math.max(0, Math.min(width - 32, 560));
  const panelHeight = 142;
  const panelX = (width - panelWidth) / 2;
  const panelY = Math.max(12, height - panelHeight - 24);

  ctx.save();
  ctx.fillStyle = 'rgba(23, 17, 15, 0.9)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = '#E5A72F';
  ctx.lineWidth = 2;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#FFD45E';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText("RONJA'S SHIFT · McDONALD'S", panelX + 24, panelY + 18);

  ctx.fillStyle = '#F1B53A';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(beat.day, panelX + 24, panelY + 48);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(beat.speaker, panelX + 24, panelY + 70);

  ctx.fillStyle = '#F4ECE5';
  ctx.font = '16px sans-serif';
  const lines = wrapText(ctx, beat.text, panelWidth - 48);
  lines.forEach((line, index) => {
    ctx.fillText(line, panelX + 24, panelY + 94 + index * 21);
  });
  ctx.restore();
};
