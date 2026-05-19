import sharp from 'sharp';
import path from 'node:path';

const [, , inputPath, outputPath, cellSizeArg, targetAspectArg] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node tools/process-world-sheet.mjs <input> <output> [targetWidth]');
  process.exit(1);
}

const frameCount = 8;
const cellSize = Number(cellSizeArg ?? 256);
const targetAspect = Number.isFinite(Number(targetAspectArg)) ? Number(targetAspectArg) : null;
const magenta = { r: 255, g: 0, b: 255 };
const transparentDistance = 42;
const featherDistance = 92;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const distanceToMagenta = (r, g, b) => Math.sqrt(
  ((r - magenta.r) ** 2)
  + ((g - magenta.g) ** 2)
  + ((b - magenta.b) ** 2),
);

const source = sharp(inputPath).ensureAlpha();
const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
const output = Buffer.from(data);

for (let index = 0; index < output.length; index += info.channels) {
  const r = output[index];
  const g = output[index + 1];
  const b = output[index + 2];
  const alphaIndex = index + 3;
  const distance = distanceToMagenta(r, g, b);

  if (distance <= transparentDistance) {
    output[alphaIndex] = 0;
    continue;
  }

  if (distance < featherDistance) {
    const ratio = (distance - transparentDistance) / (featherDistance - transparentDistance);
    output[alphaIndex] = Math.round(clamp(ratio, 0, 1) * 255);
  }
}

const cleanedBuffer = await sharp(output, { raw: info }).png().toBuffer();
const cells = [];
const background = { r: 0, g: 0, b: 0, alpha: 0 };
const usableCell = cellSize - 24;

for (let col = 0; col < frameCount; col += 1) {
  const left = Math.round((info.width / frameCount) * col);
  const right = Math.round((info.width / frameCount) * (col + 1));
  const extractedWidth = Math.max(1, right - left);
  const extractedBuffer = await sharp(cleanedBuffer)
    .extract({
      left,
      top: 0,
      width: extractedWidth,
      height: info.height,
    })
    .png()
    .toBuffer();
  const trimmed = sharp(extractedBuffer).trim();
  const metadata = await trimmed.metadata();
  const hasTrimmedPixels = Boolean(metadata.width && metadata.height);
  const source = hasTrimmedPixels ? trimmed : sharp(extractedBuffer);
  const sourceWidth = (hasTrimmedPixels ? metadata.width : extractedWidth) ?? extractedWidth;
  const sourceHeight = (hasTrimmedPixels ? metadata.height : info.height) ?? info.height;
  const scale = Math.min(usableCell / sourceWidth, usableCell / sourceHeight);
  const proportionalWidth = Math.max(1, Math.round(sourceWidth * scale));
  const proportionalHeight = Math.max(1, Math.round(sourceHeight * scale));
  const targetHeight = proportionalHeight;
  const targetWidth = targetAspect
    ? Math.max(proportionalWidth, Math.min(usableCell, Math.round(targetHeight * targetAspect)))
    : proportionalWidth;
  const rendered = await source
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  const cellLeft = Math.round((cellSize - targetWidth) / 2);
  const cellTop = Math.round(cellSize - 12 - targetHeight);
  const cell = await sharp({
    create: {
      width: cellSize,
      height: cellSize,
      channels: 4,
      background,
    },
  })
    .composite([{ input: rendered, left: cellLeft, top: Math.max(0, cellTop) }])
    .png()
    .toBuffer();
  cells.push(cell);
}

const composites = cells.map((cell, index) => ({
  input: cell,
  left: index * cellSize,
  top: 0,
}));

await sharp({
  create: {
    width: cellSize * frameCount,
    height: cellSize,
    channels: 4,
    background,
  },
})
  .composite(composites)
  .png()
  .toFile(outputPath);

console.log(JSON.stringify({
  input: path.basename(inputPath),
  output: path.basename(outputPath),
  size: `${cellSize * frameCount}x${cellSize}`,
}, null, 2));
