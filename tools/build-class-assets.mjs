import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const ALPHA_THRESHOLD = 8;
const TRANSPARENT_DISTANCE = 16;
const OPAQUE_DISTANCE = 128;
const validateOnly = process.argv.includes('--validate-only');

const ASSETS = [
  {
    name: 'class card icons',
    source: 'public/assets/atlas-sources/generated/class-card-icons-source.png',
    output: 'public/assets/atlas-sources/generated/class-card-icons.png',
    expectedSize: [1254, 1254],
  },
  {
    name: 'archer hero sheet',
    source: 'public/assets/archer-hero-sheet-source.png',
    output: 'public/assets/archer-hero-sheet.png',
    expectedSize: [1774, 887],
    repairReleaseFrame: true,
  },
];

const resolvePath = (filePath) => path.resolve(ROOT, filePath);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

async function removeMagentaKey(sourcePath) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = Buffer.from(data);
  const cornerOffsets = [
    0,
    (info.width - 1) * info.channels,
    ((info.height - 1) * info.width) * info.channels,
    ((info.height * info.width) - 1) * info.channels,
  ];
  const chromaKey = cornerOffsets.reduce((key, index) => ({
    r: key.r + data[index] / cornerOffsets.length,
    g: key.g + data[index + 1] / cornerOffsets.length,
    b: key.b + data[index + 2] / cornerOffsets.length,
  }), { r: 0, g: 0, b: 0 });
  const span = OPAQUE_DISTANCE - TRANSPARENT_DISTANCE;
  for (let index = 0; index < result.length; index += info.channels) {
    const red = result[index];
    const green = result[index + 1];
    const blue = result[index + 2];
    const distance = Math.hypot(red - chromaKey.r, green - chromaKey.g, blue - chromaKey.b);
    const alphaFactor = clamp((distance - TRANSPARENT_DISTANCE) / span, 0, 1);
    result[index + 3] = Math.round(result[index + 3] * alphaFactor);
    if (alphaFactor < 1) {
      const magentaSpill = (1 - alphaFactor) * 0.72;
      result[index] = Math.round(red * (1 - magentaSpill));
      result[index + 2] = Math.round(blue * (1 - magentaSpill));
    }
  }
  return { data: result, info };
}

function replaceArcherReleaseFrame(data, info) {
  const cols = 8;
  const rows = 4;
  const sourceCol = 5;
  const targetCol = 6;
  const row = 2;
  const sourceLeft = Math.round(info.width * sourceCol / cols);
  const sourceRight = Math.round(info.width * (sourceCol + 1) / cols);
  const targetLeft = Math.round(info.width * targetCol / cols);
  const targetRight = Math.round(info.width * (targetCol + 1) / cols);
  const top = Math.round(info.height * row / rows);
  const bottom = Math.round(info.height * (row + 1) / rows);
  const sourceWidth = sourceRight - sourceLeft;
  const targetWidth = targetRight - targetLeft;

  for (let y = top; y < bottom; y += 1) {
    for (let targetX = targetLeft; targetX < targetRight; targetX += 1) {
      const relativeX = (targetX - targetLeft) / Math.max(1, targetWidth - 1);
      const sourceX = sourceLeft + Math.round(relativeX * Math.max(0, sourceWidth - 1));
      const sourceIndex = (y * info.width + sourceX) * info.channels;
      const targetIndex = (y * info.width + targetX) * info.channels;
      data.copy(data, targetIndex, sourceIndex, sourceIndex + info.channels);
    }
  }
}

async function buildAsset(asset) {
  const sourcePath = resolvePath(asset.source);
  const outputPath = resolvePath(asset.output);
  const { data, info } = await removeMagentaKey(sourcePath);
  if (asset.repairReleaseFrame) {
    replaceArcherReleaseFrame(data, info);
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(data, { raw: info }).png().toFile(outputPath);
  console.log(`built ${asset.name}: ${asset.output}`);
}

async function validateAsset(asset) {
  const outputPath = resolvePath(asset.output);
  const metadata = await sharp(outputPath).metadata();
  if (metadata.width !== asset.expectedSize[0] || metadata.height !== asset.expectedSize[1]) {
    throw new Error(`${asset.output} must be ${asset.expectedSize[0]}x${asset.expectedSize[1]}.`);
  }
  if (!metadata.hasAlpha) {
    throw new Error(`${asset.output} must have transparency.`);
  }
  const { data, info } = await sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cornerIndices = [
    3,
    (info.width - 1) * info.channels + 3,
    ((info.height - 1) * info.width) * info.channels + 3,
    ((info.height * info.width) - 1) * info.channels + 3,
  ];
  if (cornerIndices.some((index) => data[index] > ALPHA_THRESHOLD)) {
    throw new Error(`${asset.output} does not have transparent corners after chroma removal.`);
  }
  console.log(`validated ${asset.name}: ${asset.output}`);
}

async function main() {
  for (const asset of ASSETS) {
    if (!validateOnly) {
      await buildAsset(asset);
    }
    await validateAsset(asset);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
