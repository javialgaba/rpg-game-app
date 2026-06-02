import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const GENERATED_CLASS_DIR = 'public/assets/atlas-sources/generated/class-ui';
const GENERATED_CARD_DIR = 'public/assets/atlas-sources/generated/card-ui';
const ALPHA_THRESHOLD = 8;
const TRANSPARENT_DISTANCE = 34;
const OPAQUE_DISTANCE = 150;
const HERO_TRANSPARENT_DISTANCE = 18;
const HERO_OPAQUE_DISTANCE = 90;
const CHROMA_RESIDUE_DISTANCE = 34;
const SAFE_MARGIN_RATIO = 0.16;
const HERO_SHEET_SIZE = [2048, 1024];
const HERO_SHEET_COLS = 8;
const HERO_SHEET_ROWS = 4;
const HERO_FRAME_SAFE_MARGIN = 40;
const LEGACY_HERO_FRAME_SAFE_MARGIN = 16;
const HERO_PLAYER_MIN_PIXELS = 6500;
const HERO_PLAYER_MIN_WIDTH = 56;
const HERO_PLAYER_MIN_HEIGHT = 104;
const HERO_DETACHED_FRAGMENT_MIN_PIXELS = 25;
const HERO_DETACHED_FRAGMENT_MAX_PIXELS = 900;
const HERO_CHARACTER_ROW_FRAGMENT_MIN_PIXELS = 100;
const HERO_ROW_SCALE_TOLERANCE_PX = 2;
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
    name: 'warrior hero sheet',
    source: 'public/assets/warrior-hero-sheet-source.png',
    output: 'public/assets/warrior-hero-sheet.png',
    expectedSize: HERO_SHEET_SIZE,
    heroSheet: true,
    validateSourceFrames: true,
    preserveSourceLayout: true,
    playerOnlyRows: new Set([0, 1, 2]),
    rowHeightTargets: new Map([
      [1, 0.97],
      [2, 0.95],
    ]),
  },
  {
    name: 'archer hero sheet',
    source: 'public/assets/archer-hero-sheet-source.png',
    output: 'public/assets/archer-hero-sheet.png',
    expectedSize: HERO_SHEET_SIZE,
    heroSheet: true,
    validateSourceFrames: true,
    preserveSourceLayout: true,
    playerOnlyRows: new Set([0, 1]),
  },
  {
    name: 'sorcerer hero sheet',
    source: 'public/assets/sorcerer-hero-sheet-source.png',
    output: 'public/assets/sorcerer-hero-sheet.png',
    expectedSize: HERO_SHEET_SIZE,
    heroSheet: true,
    validateSourceFrames: true,
    preserveSourceLayout: true,
    playerOnlyRows: new Set([0, 1]),
  },
  {
    name: 'legacy princess hero sheet',
    source: 'public/assets/princess-hero-sheet-source.png',
    output: 'public/assets/princess-hero-sheet.png',
    expectedSize: HERO_SHEET_SIZE,
    heroSheet: true,
    frameSafeMargin: LEGACY_HERO_FRAME_SAFE_MARGIN,
    readonly: true,
  },
];

const resolvePath = (filePath) => path.resolve(ROOT, filePath);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function clearTransparentPixels(data, info) {
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index + 3] <= ALPHA_THRESHOLD) {
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 0;
    }
  }
}

function scrubChromaResidue(data, info, chromaKey) {
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index + 3] <= ALPHA_THRESHOLD) {
      continue;
    }
    const distance = Math.hypot(data[index] - chromaKey.r, data[index + 1] - chromaKey.g, data[index + 2] - chromaKey.b);
    if (distance <= CHROMA_RESIDUE_DISTANCE) {
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 0;
    }
  }
}

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

async function removeChromaKey(sourcePath, options = {}) {
  const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = Buffer.from(data);
  const chromaKey = sampleCornerKey(data, info);
  const transparentDistance = options.transparentDistance ?? TRANSPARENT_DISTANCE;
  const opaqueDistance = options.opaqueDistance ?? OPAQUE_DISTANCE;
  const span = opaqueDistance - transparentDistance;
  const keyChannels = [chromaKey.r, chromaKey.g, chromaKey.b];

  for (let index = 0; index < result.length; index += info.channels) {
    const colors = [result[index], result[index + 1], result[index + 2]];
    const distance = Math.hypot(
      colors[0] - chromaKey.r,
      colors[1] - chromaKey.g,
      colors[2] - chromaKey.b,
    );
    const alphaFactor = clamp((distance - transparentDistance) / span, 0, 1);
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

function getFrameVisibleBounds(data, info, left, top, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[((top + y) * info.width + left + x) * info.channels + 3];
      if (alpha > ALPHA_THRESHOLD) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

async function resizeRaw(data, info, width, height) {
  const pipeline = sharp(data, { raw: info }).resize(width, height, { fit: 'fill' });
  return pipeline.raw().toBuffer({ resolveWithObject: true });
}

async function normalizeHeroSheet(data, info, frameSafeMargin) {
  const frameWidth = Math.round(info.width / HERO_SHEET_COLS);
  const frameHeight = Math.round(info.height / HERO_SHEET_ROWS);
  const maxContentWidth = frameWidth - frameSafeMargin * 2;
  const maxContentHeight = frameHeight - frameSafeMargin * 2;
  const composites = [];

  for (let row = 0; row < HERO_SHEET_ROWS; row += 1) {
    for (let col = 0; col < HERO_SHEET_COLS; col += 1) {
      const frameLeft = col * frameWidth;
      const frameTop = row * frameHeight;
      const bounds = getFrameVisibleBounds(data, info, frameLeft, frameTop, frameWidth, frameHeight);
      if (!bounds) {
        continue;
      }

      const contentWidth = bounds.maxX - bounds.minX + 1;
      const contentHeight = bounds.maxY - bounds.minY + 1;
      const scale = Math.min(1, maxContentWidth / contentWidth, maxContentHeight / contentHeight);
      const targetWidth = Math.max(1, Math.round(contentWidth * scale));
      const targetHeight = Math.max(1, Math.round(contentHeight * scale));
      const input = await sharp(data, { raw: info })
        .extract({
          left: frameLeft + bounds.minX,
          top: frameTop + bounds.minY,
          width: contentWidth,
          height: contentHeight,
        })
        .resize(targetWidth, targetHeight, { fit: 'fill' })
        .png()
        .toBuffer();

      composites.push({
        input,
        left: frameLeft + Math.round((frameWidth - targetWidth) / 2),
        top: frameTop + frameHeight - frameSafeMargin - targetHeight,
      });
    }
  }

  return sharp({
    create: {
      width: info.width,
      height: info.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function buildAsset(asset) {
  const sourcePath = resolvePath(asset.source);
  const outputPath = resolvePath(asset.output);
  const frameSafeMargin = asset.frameSafeMargin ?? HERO_FRAME_SAFE_MARGIN;
  const chromaOptions = asset.heroSheet
    ? { transparentDistance: HERO_TRANSPARENT_DISTANCE, opaqueDistance: HERO_OPAQUE_DISTANCE }
    : {};
  let { data, info, chromaKey } = await removeChromaKey(sourcePath, chromaOptions);
  if (asset.expectedSize && (info.width !== asset.expectedSize[0] || info.height !== asset.expectedSize[1])) {
    ({ data, info } = await resizeRaw(data, info, asset.expectedSize[0], asset.expectedSize[1]));
  }
  if (asset.heroSheet) {
    clearTransparentPixels(data, info);
    if (!asset.preserveSourceLayout) {
      ({ data, info } = await normalizeHeroSheet(data, info, frameSafeMargin));
    }
    scrubChromaResidue(data, info, chromaKey);
    clearTransparentPixels(data, info);
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(data, { raw: info }).png().toFile(outputPath);
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

function getFrameComponents(data, info, left, top, width, height) {
  const seen = new Uint8Array(width * height);
  const components = [];
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let startY = 0; startY < height; startY += 1) {
    for (let startX = 0; startX < width; startX += 1) {
      const startIndex = startY * width + startX;
      if (seen[startIndex]) {
        continue;
      }
      seen[startIndex] = 1;
      const startAlpha = data[((top + startY) * info.width + left + startX) * info.channels + 3];
      if (startAlpha <= ALPHA_THRESHOLD) {
        continue;
      }

      const queue = [[startX, startY]];
      let queueIndex = 0;
      let pixelCount = 0;
      let minX = startX;
      let minY = startY;
      let maxX = startX;
      let maxY = startY;

      while (queueIndex < queue.length) {
        const [x, y] = queue[queueIndex];
        queueIndex += 1;
        pixelCount += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        neighbors.forEach(([offsetX, offsetY]) => {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) {
            return;
          }
          const nextIndex = nextY * width + nextX;
          if (seen[nextIndex]) {
            return;
          }
          seen[nextIndex] = 1;
          const alpha = data[((top + nextY) * info.width + left + nextX) * info.channels + 3];
          if (alpha > ALPHA_THRESHOLD) {
            queue.push([nextX, nextY]);
          }
        });
      }

      components.push({
        pixelCount,
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
    }
  }

  return components.sort((a, b) => b.pixelCount - a.pixelCount);
}

function getPlayerSizedComponent(components, frameWidth) {
  const centralMinX = Math.floor(frameWidth * 0.25);
  const centralMaxX = Math.ceil(frameWidth * 0.75);
  return components.find((component) => (
    component.pixelCount >= HERO_PLAYER_MIN_PIXELS
    && component.width >= HERO_PLAYER_MIN_WIDTH
    && component.height >= HERO_PLAYER_MIN_HEIGHT
    && component.maxX >= centralMinX
    && component.minX <= centralMaxX
  ));
}

function median(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function overlapsHorizontally(a, b) {
  return a.minX <= b.maxX && b.minX <= a.maxX;
}

function assertNoDetachedLowerFragments(components, playerComponent, outputPath, row, col) {
  const lowerPlayerY = Math.max(
    playerComponent.minY + Math.floor(playerComponent.height * 0.55),
    playerComponent.maxY - 16,
  );
  const detachedFragments = components.filter((component) => (
    component !== playerComponent
    && component.pixelCount >= HERO_DETACHED_FRAGMENT_MIN_PIXELS
    && component.pixelCount <= HERO_DETACHED_FRAGMENT_MAX_PIXELS
    && component.maxY >= lowerPlayerY
    && !overlapsHorizontally(component, playerComponent)
  ));

  if (detachedFragments.length > 0) {
    throw new Error(`${outputPath} frame ${row},${col} has detached lower fragments outside the player body.`);
  }
}

function assertNoDetachedCharacterRowFragments(components, playerComponent, outputPath, row, col) {
  const detachedFragments = components.filter((component) => (
    component !== playerComponent
    && component.pixelCount >= HERO_CHARACTER_ROW_FRAGMENT_MIN_PIXELS
  ));

  if (detachedFragments.length > 0) {
    throw new Error(`${outputPath} frame ${row},${col} has detached fragments outside the player body.`);
  }
}

function assertHeroFrameQuality(data, info, outputPath, options) {
  const { frameSafeMargin, playerOnlyRows, requirePlayerComponent, rowHeightTargets } = options;
  const frameWidth = Math.round(info.width / HERO_SHEET_COLS);
  const frameHeight = Math.round(info.height / HERO_SHEET_ROWS);
  const playerComponentsByRow = Array.from({ length: HERO_SHEET_ROWS }, () => []);
  for (let row = 0; row < HERO_SHEET_ROWS; row += 1) {
    for (let col = 0; col < HERO_SHEET_COLS; col += 1) {
      const bounds = getFrameVisibleBounds(
        data,
        info,
        col * frameWidth,
        row * frameHeight,
        frameWidth,
        frameHeight,
      );
      if (!bounds) {
        throw new Error(`${outputPath} frame ${row},${col} must not be empty.`);
      }
      if (bounds.minX < frameSafeMargin
        || bounds.minY < frameSafeMargin
        || bounds.maxX >= frameWidth - frameSafeMargin
        || bounds.maxY >= frameHeight - frameSafeMargin) {
        throw new Error(`${outputPath} frame ${row},${col} visible content must stay inside a ${frameSafeMargin}px per-frame margin.`);
      }
      if (requirePlayerComponent) {
        const components = getFrameComponents(
          data,
          info,
          col * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight,
        );
        const playerComponent = getPlayerSizedComponent(components, frameWidth);
        if (!playerComponent) {
          throw new Error(`${outputPath} frame ${row},${col} must contain a player-sized character component.`);
        }
        playerComponentsByRow[row].push({ col, component: playerComponent });
        if (playerOnlyRows?.has(row)) {
          assertNoDetachedCharacterRowFragments(components, playerComponent, outputPath, row, col);
        } else {
          assertNoDetachedLowerFragments(components, playerComponent, outputPath, row, col);
        }
      }
    }
  }
  if (rowHeightTargets) {
    const baselineHeight = median(playerComponentsByRow[0].map(({ component }) => component.height));
    if (!baselineHeight) {
      throw new Error(`${outputPath} row 0 must contain player-sized frames for row-scale validation.`);
    }
    rowHeightTargets.forEach((ratio, row) => {
      const minimumHeight = Math.floor(baselineHeight * ratio) - HERO_ROW_SCALE_TOLERANCE_PX;
      playerComponentsByRow[row].forEach(({ col, component }) => {
        if (component.height < minimumHeight) {
          throw new Error(`${outputPath} frame ${row},${col} player height ${component.height}px is below the ${minimumHeight}px row-scale target.`);
        }
      });
    });
  }
}

async function validateAsset(asset) {
  const sourcePath = resolvePath(asset.source);
  const outputPath = resolvePath(asset.output);
  const frameSafeMargin = asset.frameSafeMargin ?? HERO_FRAME_SAFE_MARGIN;
  const sourceMetadata = await sharp(sourcePath).metadata();
  if (asset.square && sourceMetadata.width !== sourceMetadata.height) {
    throw new Error(`${asset.source} must be a square individual source image.`);
  }
  if (asset.expectedSize && (sourceMetadata.width !== asset.expectedSize[0] || sourceMetadata.height !== asset.expectedSize[1])) {
    throw new Error(`${asset.source} must be ${asset.expectedSize[0]}x${asset.expectedSize[1]}.`);
  }
  if (asset.heroSheet && asset.validateSourceFrames) {
    const { data: sourceFrameData, info: sourceFrameInfo } = await removeChromaKey(sourcePath, {
      transparentDistance: HERO_TRANSPARENT_DISTANCE,
      opaqueDistance: HERO_OPAQUE_DISTANCE,
    });
    clearTransparentPixels(sourceFrameData, sourceFrameInfo);
    assertHeroFrameQuality(sourceFrameData, sourceFrameInfo, asset.source, {
      frameSafeMargin,
      playerOnlyRows: asset.playerOnlyRows,
      requirePlayerComponent: true,
      rowHeightTargets: asset.rowHeightTargets,
    });
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
  if (asset.heroSheet) {
    assertHeroFrameQuality(data, info, asset.output, {
      frameSafeMargin,
      playerOnlyRows: asset.playerOnlyRows,
      requirePlayerComponent: Boolean(asset.validateSourceFrames),
      rowHeightTargets: asset.rowHeightTargets,
    });
  }
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
    if (!validateOnly && !asset.readonly) {
      await buildAsset(asset);
    } else if (!validateOnly && asset.readonly) {
      console.log(`kept ${asset.name}: ${asset.output}`);
    }
    await validateAsset(asset);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
