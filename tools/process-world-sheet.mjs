import sharp from 'sharp';
import path from 'node:path';

const [, , inputPath, outputPath, targetWidthArg] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node tools/process-world-sheet.mjs <input> <output> [targetWidth]');
  process.exit(1);
}

const targetWidth = Number(targetWidthArg ?? 2048);
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

const normalizedWidth = Math.max(8, Math.round(targetWidth / 8) * 8);
const scale = normalizedWidth / info.width;
const normalizedHeight = Math.max(1, Math.round(info.height * scale));

await sharp(output, { raw: info })
  .resize({
    width: normalizedWidth,
    height: normalizedHeight,
    fit: 'fill',
    kernel: sharp.kernel.lanczos3,
  })
  .png()
  .toFile(outputPath);

console.log(JSON.stringify({
  input: path.basename(inputPath),
  output: path.basename(outputPath),
  size: `${normalizedWidth}x${normalizedHeight}`,
}, null, 2));
