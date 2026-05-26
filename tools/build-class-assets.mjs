import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const GENERATED_CLASS_DIR = 'public/assets/atlas-sources/generated/class-ui';
const GENERATED_CARD_DIR = 'public/assets/atlas-sources/generated/card-ui';
const ALPHA_THRESHOLD = 8;
const TRANSPARENT_DISTANCE = 34;
const OPAQUE_DISTANCE = 150;
const CHROMA_RESIDUE_DISTANCE = 34;
const SAFE_MARGIN_RATIO = 0.16;
const validateOnly = process.argv.includes('--validate-only');

const SQUARE_FRAME_NAMES = [
  'smoke_puff_01',
  'sparkle_burst_01',
  'arrow_01',
  'magic_splash_01',
  'shield_glow_01',
  'hammer_badge_01',
  'crossed_swords_01',
  'trap_ground_01',
  'magic_shield_field_01',
  'touch_sword_01',
  'touch_bow_01',
  'touch_spell_01',
  'touch_repair_01',
  'touch_guard_01',
  'touch_trap_01',
  'touch_magic_shield_01',
  'card_swift_boots_01',
  'card_stronger_strikes_01',
  'card_quick_hands_01',
  'card_reinforced_walls_01',
  'card_tough_heart_01',
  'card_magic_repair_01',
];

const ASSETS = [
  ...SQUARE_FRAME_NAMES.map((frameName) => ({
    name: frameName,
    source: `${GENERATED_CLASS_DIR}/${frameName}-source.png`,
    output: `${GENERATED_CLASS_DIR}/${frameName}.png`,
    square: true,
    safeMarginRatio: SAFE_MARGIN_RATIO,
  })),
  ...[
    'class_warrior_tile_01',
    'class_archer_tile_01',
    'class_sorcerer_tile_01',
  ].map((frameName) => ({
    name: frameName,
    source: `${GENERATED_CARD_DIR}/${frameName}-source.png`,
    output: `${GENERATED_CARD_DIR}/${frameName}.png`,
    square: true,
    safeMarginRatio: SAFE_MARGIN_RATIO,
  })),
  {
    name: 'shared card box',
    source: `${GENERATED_CARD_DIR}/shared_card_box_01-source.png`,
    output: `${GENERATED_CARD_DIR}/shared_card_box_01.png`,
  },
  {
    name: 'archer hero sheet',
    source: 'public/assets/archer-hero-sheet-source.png',
    output: 'public/assets/archer-hero-sheet.png',
    expectedSize: [1774, 887],
    repairReleaseFrame: true,
  },
  {
    name: 'sorcerer hero sheet',
    source: 'public/assets/sorcerer-hero-sheet-source.png',
    output: 'public/assets/sorcerer-hero-sheet.png',
    expectedSize: [1774, 887],
  },
];

const resolvePath = (filePath) => path.resolve(ROOT, filePath);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function sampleCornerKey(data, info) {
  const cornerOffsets = [
    0,
    (info.width - 1) * info.channels,
    ((info.height - 1) * info.width) * info.channels,
    ((info.height * info.width) - 1) * info.channels,
  ];
  return cornerOffsets.reduce((key, index) => ({
    r: key.r + data[index] / cornerOffsets.length,
    g: key.g + data[index + 1] / cornerOffsets.length,
    b: key.b + data[index + 2] / cornerOffsets.length,
  }), { r: 0, g: 0, b: 0 });
}

async function removeChromaKey(sourcePath) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = Buffer.from(data);
  const chromaKey = sampleCornerKey(data, info);
  const span = OPAQUE_DISTANCE - TRANSPARENT_DISTANCE;
  const keyChannels = [chromaKey.r, chromaKey.g, chromaKey.b];

  for (let index = 0; index < result.length; index += info.channels) {
    const colors = [result[index], result[index + 1], result[index + 2]];
    const distance = Math.hypot(
      colors[0] - chromaKey.r,
      colors[1] - chromaKey.g,
      colors[2] - chromaKey.b,
    );
    const alphaFactor = clamp((distance - TRANSPARENT_DISTANCE) / span, 0, 1);
    result[index + 3] = Math.round(result[index + 3] * alphaFactor);
    if (alphaFactor < 1) {
      const spill = (1 - alphaFactor) * 0.72;
      keyChannels.forEach((keyChannel, channelIndex) => {
        const keyWeight = keyChannel / 255;
        result[index + channelIndex] = Math.round(colors[channelIndex] * (1 - spill * keyWeight));
      });
    }
  }

  return { data: result, info, chromaKey };
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
  const { data, info } = await removeChromaKey(sourcePath);
  if (asset.repairReleaseFrame) {
    replaceArcherReleaseFrame(data, info);
  }
  let pipeline = sharp(data, { raw: info });
  if (asset.expectedSize && (info.width !== asset.expectedSize[0] || info.height !== asset.expectedSize[1])) {
    pipeline = pipeline.resize(asset.expectedSize[0], asset.expectedSize[1], { fit: 'fill' });
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await pipeline.png().toFile(outputPath);
  console.log(`built ${asset.name}: ${asset.output}`);
}

function assertTransparentEdges(data, info, outputPath) {
  const edgeIndices = [];
  for (let x = 0; x < info.width; x += 1) {
    edgeIndices.push((x * info.channels) + 3);
    edgeIndices.push((((info.height - 1) * info.width + x) * info.channels) + 3);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    edgeIndices.push(((y * info.width) * info.channels) + 3);
    edgeIndices.push(((y * info.width + info.width - 1) * info.channels) + 3);
  }
  if (edgeIndices.some((index) => data[index] > ALPHA_THRESHOLD)) {
    throw new Error(`${outputPath} must have transparent outer edges after chroma removal.`);
  }
}

function getVisibleBounds(data, info) {
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > ALPHA_THRESHOLD) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) {
    throw new Error('Processed image is fully transparent.');
  }
  return { minX, minY, maxX, maxY };
}

async function validateAsset(asset) {
  const sourcePath = resolvePath(asset.source);
  const outputPath = resolvePath(asset.output);
  const sourceMetadata = await sharp(sourcePath).metadata();
  if (asset.square && sourceMetadata.width !== sourceMetadata.height) {
    throw new Error(`${asset.source} must be a square individual source image.`);
  }

  const metadata = await sharp(outputPath).metadata();
  if (asset.expectedSize && (metadata.width !== asset.expectedSize[0] || metadata.height !== asset.expectedSize[1])) {
    throw new Error(`${asset.output} must be ${asset.expectedSize[0]}x${asset.expectedSize[1]}.`);
  }
  if (asset.square && metadata.width !== metadata.height) {
    throw new Error(`${asset.output} must remain square after processing.`);
  }
  if (!metadata.hasAlpha) {
    throw new Error(`${asset.output} must have transparency.`);
  }

  const { data, info } = await sharp(outputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assertTransparentEdges(data, info, asset.output);
  const bounds = getVisibleBounds(data, info);
  if (asset.safeMarginRatio) {
    const marginX = Math.floor(info.width * asset.safeMarginRatio);
    const marginY = Math.floor(info.height * asset.safeMarginRatio);
    if (bounds.minX < marginX || bounds.minY < marginY
      || bounds.maxX >= info.width - marginX || bounds.maxY >= info.height - marginY) {
      throw new Error(`${asset.output} visible content must stay at least ${Math.round(asset.safeMarginRatio * 100)}% inside every edge.`);
    }
  }

  const { data: sourceData, info: sourceInfo } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const key = sampleCornerKey(sourceData, sourceInfo);
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index + 3] <= ALPHA_THRESHOLD) {
      continue;
    }
    const distance = Math.hypot(data[index] - key.r, data[index + 1] - key.g, data[index + 2] - key.b);
    if (distance <= CHROMA_RESIDUE_DISTANCE) {
      throw new Error(`${asset.output} contains visible chroma-key residue.`);
    }
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
