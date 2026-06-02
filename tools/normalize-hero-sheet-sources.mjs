import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const HERO_SHEETS = [
  {
    source: 'public/assets/warrior-hero-sheet-source.png',
    playerOnlyRows: new Set([0, 1, 2]),
    baselineRow: 0,
    rowHeightTargets: new Map([
      [1, 0.97],
      [2, 0.95],
    ]),
  },
  {
    source: 'public/assets/archer-hero-sheet-source.png',
    playerOnlyRows: new Set([0, 1]),
  },
  {
    source: 'public/assets/sorcerer-hero-sheet-source.png',
    playerOnlyRows: new Set([0, 1]),
  },
];
const ALPHA_THRESHOLD = 8;
const TRANSPARENT_DISTANCE = 18;
const OPAQUE_DISTANCE = 90;
const HERO_SHEET_COLS = 8;
const HERO_SHEET_ROWS = 4;
const HERO_FRAME_SIZE = 256;
const HERO_FRAME_SAFE_MARGIN = 40;
const HERO_PLAYER_MIN_PIXELS = 6500;
const HERO_PLAYER_MIN_WIDTH = 56;
const HERO_PLAYER_MIN_HEIGHT = 104;

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

function removeChromaKey(data, info, chromaKey) {
  const result = Buffer.from(data);
  const span = OPAQUE_DISTANCE - TRANSPARENT_DISTANCE;
  for (let index = 0; index < result.length; index += info.channels) {
    const distance = Math.hypot(
      result[index] - chromaKey.r,
      result[index + 1] - chromaKey.g,
      result[index + 2] - chromaKey.b,
    );
    result[index + 3] = Math.round(result[index + 3] * clamp((distance - TRANSPARENT_DISTANCE) / span, 0, 1));
    if (result[index + 3] <= ALPHA_THRESHOLD) {
      result[index] = 0;
      result[index + 1] = 0;
      result[index + 2] = 0;
      result[index + 3] = 0;
    }
  }
  return result;
}

function getFrameVisibleBounds(data, info, left, top) {
  let minX = HERO_FRAME_SIZE;
  let minY = HERO_FRAME_SIZE;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < HERO_FRAME_SIZE; y += 1) {
    for (let x = 0; x < HERO_FRAME_SIZE; x += 1) {
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

function getFrameComponents(data, info, left, top) {
  const seen = new Uint8Array(HERO_FRAME_SIZE * HERO_FRAME_SIZE);
  const components = [];
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let startY = 0; startY < HERO_FRAME_SIZE; startY += 1) {
    for (let startX = 0; startX < HERO_FRAME_SIZE; startX += 1) {
      const startIndex = startY * HERO_FRAME_SIZE + startX;
      if (seen[startIndex]) {
        continue;
      }
      seen[startIndex] = 1;
      const startAlpha = data[((top + startY) * info.width + left + startX) * info.channels + 3];
      if (startAlpha <= ALPHA_THRESHOLD) {
        continue;
      }

      const queue = [[startX, startY]];
      const pixels = [];
      let queueIndex = 0;
      let minX = startX;
      let minY = startY;
      let maxX = startX;
      let maxY = startY;

      while (queueIndex < queue.length) {
        const [x, y] = queue[queueIndex];
        queueIndex += 1;
        pixels.push([x, y]);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);

        neighbors.forEach(([offsetX, offsetY]) => {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= HERO_FRAME_SIZE || nextY < 0 || nextY >= HERO_FRAME_SIZE) {
            return;
          }
          const nextIndex = nextY * HERO_FRAME_SIZE + nextX;
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
        pixelCount: pixels.length,
        pixels,
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

function getPlayerComponent(components) {
  const centralMinX = Math.floor(HERO_FRAME_SIZE * 0.25);
  const centralMaxX = Math.ceil(HERO_FRAME_SIZE * 0.75);
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

function copyFrameComponent(data, info, frameLeft, frameTop, component) {
  const frameData = Buffer.alloc(HERO_FRAME_SIZE * HERO_FRAME_SIZE * info.channels);
  component.pixels.forEach(([x, y]) => {
    const sourceIndex = ((frameTop + y) * info.width + frameLeft + x) * info.channels;
    const targetIndex = (y * HERO_FRAME_SIZE + x) * info.channels;
    for (let channel = 0; channel < info.channels; channel += 1) {
      frameData[targetIndex + channel] = data[sourceIndex + channel];
    }
  });
  return {
    data: frameData,
    info: {
      width: HERO_FRAME_SIZE,
      height: HERO_FRAME_SIZE,
      channels: info.channels,
    },
  };
}

function getHeroSheetConfig(sourcePath) {
  return HERO_SHEETS.find((config) => config.source === sourcePath) ?? {
    source: sourcePath,
    playerOnlyRows: new Set([0, 1]),
  };
}

async function normalizeHeroSheetSource(config) {
  const { source: sourcePath, playerOnlyRows, baselineRow = 0, rowHeightTargets } = config;
  const absolutePath = resolvePath(sourcePath);
  const { data, info } = await sharp(absolutePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== HERO_SHEET_COLS * HERO_FRAME_SIZE || info.height !== HERO_SHEET_ROWS * HERO_FRAME_SIZE) {
    throw new Error(`${sourcePath} must be ${HERO_SHEET_COLS * HERO_FRAME_SIZE}x${HERO_SHEET_ROWS * HERO_FRAME_SIZE}.`);
  }

  const chromaKey = sampleCornerKey(data, info);
  const alphaData = removeChromaKey(data, info, chromaKey);
  const maxContentSize = HERO_FRAME_SIZE - HERO_FRAME_SAFE_MARGIN * 2;
  const baselineHeights = [];
  const composites = [];

  if (rowHeightTargets) {
    for (let col = 0; col < HERO_SHEET_COLS; col += 1) {
      const frameLeft = col * HERO_FRAME_SIZE;
      const frameTop = baselineRow * HERO_FRAME_SIZE;
      const playerComponent = getPlayerComponent(getFrameComponents(alphaData, info, frameLeft, frameTop));
      if (playerComponent) {
        baselineHeights.push(playerComponent.height);
      }
    }
  }

  const baselineHeight = median(baselineHeights);

  for (let row = 0; row < HERO_SHEET_ROWS; row += 1) {
    for (let col = 0; col < HERO_SHEET_COLS; col += 1) {
      const frameLeft = col * HERO_FRAME_SIZE;
      const frameTop = row * HERO_FRAME_SIZE;
      let frameData = alphaData;
      let frameInfo = info;
      let boundsLeft = frameLeft;
      let boundsTop = frameTop;
      if (playerOnlyRows.has(row)) {
        const playerComponent = getPlayerComponent(getFrameComponents(alphaData, info, frameLeft, frameTop));
        if (!playerComponent) {
          throw new Error(`${sourcePath} frame ${row},${col} must contain a player-sized character component.`);
        }
        ({ data: frameData, info: frameInfo } = copyFrameComponent(alphaData, info, frameLeft, frameTop, playerComponent));
        boundsLeft = 0;
        boundsTop = 0;
      }
      const bounds = getFrameVisibleBounds(frameData, frameInfo, boundsLeft, boundsTop);
      if (!bounds) {
        throw new Error(`${sourcePath} frame ${row},${col} must not be empty.`);
      }

      const contentWidth = bounds.maxX - bounds.minX + 1;
      const contentHeight = bounds.maxY - bounds.minY + 1;
      const targetHeightRatio = rowHeightTargets?.get(row);
      let scaleX = Math.min(1, maxContentSize / contentWidth, maxContentSize / contentHeight);
      let scaleY = scaleX;
      if (baselineHeight && targetHeightRatio) {
        const desiredHeight = Math.min(maxContentSize, Math.round(baselineHeight * targetHeightRatio));
        scaleY = desiredHeight / contentHeight;
        scaleX = Math.min(scaleY, maxContentSize / contentWidth);
      }
      const targetWidth = Math.max(1, Math.round(contentWidth * scaleX));
      const targetHeight = Math.max(1, Math.round(contentHeight * scaleY));
      const input = await sharp(frameData, { raw: frameInfo })
        .extract({
          left: boundsLeft + bounds.minX,
          top: boundsTop + bounds.minY,
          width: contentWidth,
          height: contentHeight,
        })
        .resize(targetWidth, targetHeight, { fit: 'fill' })
        .png()
        .toBuffer();

      composites.push({
        input,
        left: frameLeft + Math.round((HERO_FRAME_SIZE - targetWidth) / 2),
        top: frameTop + HERO_FRAME_SIZE - HERO_FRAME_SAFE_MARGIN - targetHeight,
      });
    }
  }

  await sharp({
    create: {
      width: info.width,
      height: info.height,
      channels: 4,
      background: {
        r: Math.round(chromaKey.r),
        g: Math.round(chromaKey.g),
        b: Math.round(chromaKey.b),
        alpha: 1,
      },
    },
  })
    .composite(composites)
    .png()
    .toFile(absolutePath);
  console.log(`normalized ${sourcePath}`);
}

async function main() {
  const sourcePaths = process.argv.slice(2);
  const configs = sourcePaths.length > 0
    ? sourcePaths.map(getHeroSheetConfig)
    : HERO_SHEETS;
  for (const config of configs) {
    await normalizeHeroSheetSource(config);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
