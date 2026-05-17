import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { atlasManifest, requiredFrames } from './atlas-manifest.mjs';

const alphaThreshold = 8;
const edgeGuardPx = 2;
const validateOnly = process.argv.includes('--validate-only');

const repoRoot = process.cwd();
const resolvePath = (filePath) => path.resolve(repoRoot, filePath);

const getAlphaBounds = async (image) => {
  const { data, info } = await image
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha <= alphaThreshold) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

const cropFrame = async (frame) => {
  const image = sharp(resolvePath(frame.source)).ensureAlpha();
  if (!frame.crop) {
    return image;
  }
  const [left, top, width, height] = frame.crop;
  return image.extract({ left, top, width, height });
};

const prepareFrame = async (frame, cellSize) => {
  const croppedBuffer = await (await cropFrame(frame)).png().toBuffer();
  const bounds = await getAlphaBounds(sharp(croppedBuffer));
  if (!bounds) {
    throw new Error(`${frame.name} has no opaque pixels.`);
  }
  const trimmed = sharp(croppedBuffer).extract(bounds);
  const padding = frame.padding ?? 16;
  const maxSize = cellSize - padding * 2;
  const trimmedMeta = await trimmed.metadata();
  const scale = Math.min(maxSize / (trimmedMeta.width ?? maxSize), maxSize / (trimmedMeta.height ?? maxSize), 1);
  const resizedWidth = Math.max(1, Math.round((trimmedMeta.width ?? maxSize) * scale));
  const resizedHeight = Math.max(1, Math.round((trimmedMeta.height ?? maxSize) * scale));
  const resizedBuffer = await trimmed
    .resize(resizedWidth, resizedHeight, { fit: 'inside' })
    .png()
    .toBuffer();
  const left = Math.round((cellSize - resizedWidth) / 2);
  const top = frame.align === 'bottom'
    ? cellSize - padding - resizedHeight
    : Math.round((cellSize - resizedHeight) / 2);

  return {
    input: resizedBuffer,
    left,
    top,
    width: resizedWidth,
    height: resizedHeight,
  };
};

const makeAtlasJson = (atlas, width, height) => {
  const frames = {};
  atlas.frames.forEach((frame, index) => {
    const x = (index % atlas.columns) * atlas.cellSize;
    const y = Math.floor(index / atlas.columns) * atlas.cellSize;
    frames[frame.name] = {
      frame: { x, y, w: atlas.cellSize, h: atlas.cellSize },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: atlas.cellSize, h: atlas.cellSize },
      sourceSize: { w: atlas.cellSize, h: atlas.cellSize },
    };
  });
  return {
    frames,
    meta: {
      app: 'fairy-guild-defense atlas builder',
      image: path.basename(atlas.image),
      format: 'RGBA8888',
      size: { w: width, h: height },
      scale: '1',
    },
  };
};

const buildAtlas = async (atlasName, atlas) => {
  const rows = Math.ceil(atlas.frames.length / atlas.columns);
  const width = atlas.columns * atlas.cellSize;
  const height = rows * atlas.cellSize;
  const composites = [];

  for (const [index, frame] of atlas.frames.entries()) {
    const prepared = await prepareFrame(frame, atlas.cellSize);
    composites.push({
      input: prepared.input,
      left: (index % atlas.columns) * atlas.cellSize + prepared.left,
      top: Math.floor(index / atlas.columns) * atlas.cellSize + prepared.top,
    });
  }

  await fs.mkdir(path.dirname(resolvePath(atlas.image)), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(resolvePath(atlas.image));

  await fs.writeFile(resolvePath(atlas.json), `${JSON.stringify(makeAtlasJson(atlas, width, height), null, 2)}\n`);
  console.log(`built ${atlasName}: ${atlas.image}`);
};

const readAtlas = async (atlas) => {
  const json = JSON.parse(await fs.readFile(resolvePath(atlas.json), 'utf8'));
  const metadata = await sharp(resolvePath(atlas.image)).metadata();
  return { json, metadata };
};

const hasOpaqueEdgePixels = async (atlas, frame) => {
  const image = sharp(resolvePath(atlas.image))
    .ensureAlpha()
    .extract({
      left: frame.frame.x,
      top: frame.frame.y,
      width: frame.frame.w,
      height: frame.frame.h,
    });
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const nearEdge = x < edgeGuardPx
        || y < edgeGuardPx
        || x >= info.width - edgeGuardPx
        || y >= info.height - edgeGuardPx;
      if (!nearEdge) {
        continue;
      }
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha > alphaThreshold) {
        return true;
      }
    }
  }
  return false;
};

const validateAtlas = async (atlasName, atlas) => {
  const { json, metadata } = await readAtlas(atlas);
  const expected = requiredFrames[atlasName] ?? [];
  const missing = expected.filter((frameName) => !json.frames?.[frameName]);
  const errors = [];

  if (metadata.width % atlas.cellSize !== 0 || metadata.height % atlas.cellSize !== 0) {
    errors.push(`${atlas.image} dimensions must be multiples of ${atlas.cellSize}.`);
  }

  missing.forEach((frameName) => errors.push(`${atlasName} missing required frame ${frameName}.`));

  for (const [frameName, frameData] of Object.entries(json.frames ?? {})) {
    const frame = frameData.frame;
    if (frame.w !== atlas.cellSize || frame.h !== atlas.cellSize) {
      errors.push(`${atlasName}/${frameName} is ${frame.w}x${frame.h}, expected ${atlas.cellSize}x${atlas.cellSize}.`);
    }
    if (await hasOpaqueEdgePixels(atlas, frameData)) {
      errors.push(`${atlasName}/${frameName} has opaque pixels too close to a cell edge.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  console.log(`validated ${atlasName}: ${Object.keys(json.frames ?? {}).length} frames`);
};

const main = async () => {
  for (const [atlasName, atlas] of Object.entries(atlasManifest)) {
    if (!validateOnly) {
      await buildAtlas(atlasName, atlas);
    }
    await validateAtlas(atlasName, atlas);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
