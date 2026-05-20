import sharp from 'sharp';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , inputPath, outputPath, cellSizeArg, safeBorderArg, sourceOutputPathArg] = process.argv;

const DEFAULT_FRAME_COUNT = 8;
const DEFAULT_SAFE_BORDER = 16;
const DEFAULT_VERTICAL_GROUND_MARGIN = 12;
const MAGENTA = { r: 255, g: 0, b: 255 };
const TRANSPARENT_DISTANCE = 42;
const FEATHER_DISTANCE = 92;
const ALPHA_THRESHOLD = 10;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const distanceToMagenta = (r, g, b) => Math.sqrt(
  ((r - MAGENTA.r) ** 2)
  + ((g - MAGENTA.g) ** 2)
  + ((b - MAGENTA.b) ** 2),
);

const ensureArgs = () => {
  if (!inputPath || !outputPath) {
    console.error(
      'Usage: node tools/process-world-sheet.mjs <input> <output> [cellSize] [safeBorderPx] [sourceOutputPath]',
    );
    process.exit(1);
  }
};

const createRawImage = (buffer, info) => sharp(buffer, { raw: info });

const keyOutMagenta = async (input) => {
  const source = sharp(input).ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.from(data);

  for (let index = 0; index < output.length; index += info.channels) {
    const r = output[index];
    const g = output[index + 1];
    const b = output[index + 2];
    const alphaIndex = index + 3;
    const distance = distanceToMagenta(r, g, b);

    if (distance <= TRANSPARENT_DISTANCE) {
      output[alphaIndex] = 0;
      continue;
    }

    if (distance < FEATHER_DISTANCE) {
      const ratio = (distance - TRANSPARENT_DISTANCE) / (FEATHER_DISTANCE - TRANSPARENT_DISTANCE);
      output[alphaIndex] = Math.round(clamp(ratio, 0, 1) * 255);
    }
  }

  return {
    raw: output,
    info,
    png: await sharp(output, { raw: info }).png().toBuffer(),
  };
};

const buildColumnWeights = (raw, info) => {
  const weights = [];
  for (let x = 0; x < info.width; x += 1) {
    let weight = 0;
    for (let y = 0; y < info.height; y += 1) {
      const alpha = raw[(y * info.width + x) * info.channels + 3];
      if (alpha >= ALPHA_THRESHOLD) {
        weight += alpha;
      }
    }
    weights.push(weight);
  }
  return weights;
};

const pickSplitBoundaries = (columnWeights, width, frameCount) => {
  const approximateCellWidth = width / frameCount;
  const searchWindow = Math.max(24, Math.round(approximateCellWidth * 0.22));
  const boundaries = [0];

  for (let index = 1; index < frameCount; index += 1) {
    const expected = Math.round(approximateCellWidth * index);
    const start = Math.max(boundaries[index - 1] + 8, expected - searchWindow);
    const end = Math.min(width - 8, expected + searchWindow);
    let bestX = expected;
    let bestWeight = Number.POSITIVE_INFINITY;

    for (let x = start; x <= end; x += 1) {
      const neighborhood = (
        (columnWeights[x - 1] ?? columnWeights[x] ?? 0)
        + (columnWeights[x] ?? 0)
        + (columnWeights[x + 1] ?? columnWeights[x] ?? 0)
      );
      if (neighborhood < bestWeight) {
        bestWeight = neighborhood;
        bestX = x;
      }
    }

    boundaries.push(bestX);
  }

  boundaries.push(width);
  return boundaries;
};

const findClusterBounds = (raw, info, run) => {
  let minX = info.width;
  let maxX = -1;
  let minY = info.height;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = run.start; x <= run.end; x += 1) {
      const alpha = raw[(y * info.width + x) * info.channels + 3];
      if (alpha < ALPHA_THRESHOLD) {
        continue;
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`Could not find opaque pixels for run ${run.start}-${run.end}.`);
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    bottom: maxY,
  };
};

const buildClusters = (raw, info, frameCount) => {
  const columnWeights = buildColumnWeights(raw, info);
  const boundaries = pickSplitBoundaries(columnWeights, info.width, frameCount);
  const clusters = [];
  for (let index = 0; index < frameCount; index += 1) {
    clusters.push(findClusterBounds(raw, info, {
      start: boundaries[index],
      end: boundaries[index + 1] - 1,
    }));
  }
  return clusters;
};

const findFrameBounds = (raw, info, cellIndex, cellSize) => {
  const cellLeft = cellIndex * cellSize;
  const cellRight = cellLeft + cellSize - 1;
  let minX = cellSize;
  let maxX = -1;
  let minY = cellSize;
  let maxY = -1;

  for (let y = 0; y < cellSize; y += 1) {
    for (let x = cellLeft; x <= cellRight; x += 1) {
      const alpha = raw[(y * info.width + x) * info.channels + 3];
      if (alpha < ALPHA_THRESHOLD) {
        continue;
      }
      const localX = x - cellLeft;
      minX = Math.min(minX, localX);
      maxX = Math.max(maxX, localX);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`Frame ${cellIndex} has no visible pixels.`);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
  };
};

const validateSheetBuffer = async ({ buffer, cellSize, frameCount, safeBorderPx, label }) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const expectedWidth = cellSize * frameCount;
  if (info.width !== expectedWidth || info.height !== cellSize) {
    throw new Error(
      `${label}: expected ${expectedWidth}x${cellSize}, received ${info.width}x${info.height}.`,
    );
  }

  for (let index = 0; index < frameCount; index += 1) {
    const bounds = findFrameBounds(data, info, index, cellSize);
    if (bounds.minX < safeBorderPx) {
      throw new Error(`${label}: frame ${index} touches left border (${bounds.minX}px).`);
    }
    if ((cellSize - 1 - bounds.maxX) < safeBorderPx) {
      throw new Error(`${label}: frame ${index} touches right border (${cellSize - 1 - bounds.maxX}px).`);
    }
    if (bounds.minY < safeBorderPx) {
      throw new Error(`${label}: frame ${index} touches top border (${bounds.minY}px).`);
    }
    if ((cellSize - 1 - bounds.maxY) < Math.max(8, Math.floor(safeBorderPx / 2))) {
      throw new Error(`${label}: frame ${index} is too close to bottom border.`);
    }
  }
};

export const rebuildWorldSheet = async ({
  inputPath: sourceInputPath,
  outputPath: finalOutputPath,
  sourceOutputPath,
  cellSize,
  safeBorderPx = DEFAULT_SAFE_BORDER,
  frameCount = DEFAULT_FRAME_COUNT,
}) => {
  const cleaned = await keyOutMagenta(sourceInputPath);
  const clusters = buildClusters(cleaned.raw, cleaned.info, frameCount);
  const innerPaddingPx = Math.max(safeBorderPx + 8, Math.round(cellSize * 0.12));
  const composites = [];

  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index];
    const extractedBuffer = await createRawImage(cleaned.raw, cleaned.info)
      .extract({
        left: cluster.left,
        top: cluster.top,
        width: cluster.width,
        height: cluster.height,
      })
      .png()
      .toBuffer();

    const usableCell = cellSize - innerPaddingPx * 2;
    const scale = Math.min(usableCell / cluster.width, usableCell / cluster.height);
    const renderedWidth = Math.max(1, Math.round(cluster.width * scale));
    const renderedHeight = Math.max(1, Math.round(cluster.height * scale));
    const rendered = await sharp(extractedBuffer)
      .resize({
        width: renderedWidth,
        height: renderedHeight,
        fit: 'fill',
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer();

    const left = index * cellSize + Math.round((cellSize - renderedWidth) / 2);
    const top = Math.max(0, Math.round(cellSize - DEFAULT_VERTICAL_GROUND_MARGIN - renderedHeight));
    composites.push({
      input: rendered,
      left,
      top,
    });
  }

  const sourceSheet = await sharp({
    create: {
      width: cellSize * frameCount,
      height: cellSize,
      channels: 4,
      background: { r: MAGENTA.r, g: MAGENTA.g, b: MAGENTA.b, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const finalSheet = await sharp({
    create: {
      width: cellSize * frameCount,
      height: cellSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  await validateSheetBuffer({
    buffer: finalSheet,
    cellSize,
    frameCount,
    safeBorderPx,
    label: path.basename(finalOutputPath),
  });

  if (sourceOutputPath) {
    await sharp(sourceSheet).png().toFile(sourceOutputPath);
  }
  await sharp(finalSheet).png().toFile(finalOutputPath);

  return {
    input: path.basename(sourceInputPath),
    output: path.basename(finalOutputPath),
    source: sourceOutputPath ? path.basename(sourceOutputPath) : null,
    size: `${cellSize * frameCount}x${cellSize}`,
  };
};

export const validateWorldSheet = async ({
  outputPath: finalOutputPath,
  cellSize,
  safeBorderPx = DEFAULT_SAFE_BORDER,
  frameCount = DEFAULT_FRAME_COUNT,
}) => {
  const buffer = await sharp(finalOutputPath).png().toBuffer();
  await validateSheetBuffer({
    buffer,
    cellSize,
    frameCount,
    safeBorderPx,
    label: path.basename(finalOutputPath),
  });
};

const runCli = async () => {
  ensureArgs();
  const cellSize = Number(cellSizeArg ?? 256);
  const safeBorderPx = Number(safeBorderArg ?? DEFAULT_SAFE_BORDER);
  const sourceOutputPath = sourceOutputPathArg || null;
  const result = await rebuildWorldSheet({
    inputPath,
    outputPath,
    sourceOutputPath,
    cellSize,
    safeBorderPx,
  });
  console.log(JSON.stringify(result, null, 2));
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
