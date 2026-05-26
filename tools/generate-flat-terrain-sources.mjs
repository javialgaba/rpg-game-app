import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCES_DIR = path.join(ROOT, 'public/assets/scene-variants/sources');
const SIZE = 512;
const KEY = { r: 255, g: 0, b: 255, alpha: 1 };
const THEMES = ['spring', 'summer', 'twilight_autumn', 'winter'];
const TERRAIN_NAMES = ['grass_01', 'grass_02', 'grass_03', 'path_01', 'path_02', 'plaza_01'];
const SOURCE_COLUMNS = 3;
const SOURCE_ROWS = 2;
const ALPHA_THRESHOLD = 8;
const DIAMOND_POINTS = [
  [256, 149],
  [470, 256],
  [256, 363],
  [42, 256],
];
const TARGET_BOUNDS = {
  left: 42,
  top: 149,
  width: 428,
  height: 214,
};

const toHex = (value) => value.toString(16).padStart(2, '0');

const diamondFillSvg = ({ r, g, b }) => Buffer.from(`
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <polygon points="${DIAMOND_POINTS.map((point) => point.join(',')).join(' ')}" fill="#${toHex(r)}${toHex(g)}${toHex(b)}"/>
</svg>`);

const targetDiamondMaskSvg = Buffer.from(`
<svg width="${TARGET_BOUNDS.width}" height="${TARGET_BOUNDS.height}" viewBox="0 0 ${TARGET_BOUNDS.width} ${TARGET_BOUNDS.height}" xmlns="http://www.w3.org/2000/svg">
  <polygon points="${TARGET_BOUNDS.width / 2},0 ${TARGET_BOUNDS.width},${TARGET_BOUNDS.height / 2} ${TARGET_BOUNDS.width / 2},${TARGET_BOUNDS.height} 0,${TARGET_BOUNDS.height / 2}" fill="white"/>
</svg>`);

const getGridCrop = (metadata, columns, rows, index) => {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const left = Math.round((metadata.width * column) / columns);
  const right = Math.round((metadata.width * (column + 1)) / columns);
  const top = Math.round((metadata.height * row) / rows);
  const bottom = Math.round((metadata.height * (row + 1)) / rows);
  return { left, top, width: right - left, height: bottom - top };
};

const removeChromaKey = async (input) => {
  const { data, info } = await sharp(input)
    .resize(SIZE, SIZE, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = Buffer.from(data);

  for (let index = 0; index < result.length; index += 4) {
    const distance = Math.hypot(
      result[index] - KEY.r,
      result[index + 1] - KEY.g,
      result[index + 2] - KEY.b,
    );
    if (distance < 150) {
      result[index + 3] = 0;
    }
  }

  return sharp(result, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  }).png().toBuffer();
};

const getAlphaBounds = async (input) => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] <= ALPHA_THRESHOLD) {
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
    right: maxX,
    bottom: maxY,
  };
};

const isOpaqueSampleRect = (data, info, rect) => {
  const step = 8;
  for (let y = rect.top; y <= rect.top + rect.height - 1; y += step) {
    for (let x = rect.left; x <= rect.left + rect.width - 1; x += step) {
      if (data[(y * info.width + x) * info.channels + 3] <= ALPHA_THRESHOLD) {
        return false;
      }
    }
  }
  return [
    [rect.left, rect.top],
    [rect.left + rect.width - 1, rect.top],
    [rect.left, rect.top + rect.height - 1],
    [rect.left + rect.width - 1, rect.top + rect.height - 1],
  ].every(([x, y]) => data[(y * info.width + x) * info.channels + 3] > ALPHA_THRESHOLD);
};

const findTopSampleRect = async (input, label) => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const centerX = Math.round(info.width / 2);
  let best = null;
  for (let height = 132; height >= 64; height -= 4) {
    const width = height * 2;
    const left = centerX - Math.round(width / 2);
    for (let top = 132; top <= 292 - height; top += 2) {
      const rect = { left, top, width, height };
      if (isOpaqueSampleRect(data, info, rect)) {
        const centerDistance = Math.abs((top + height / 2) - 226);
        if (!best || height > best.height || (height === best.height && centerDistance < best.centerDistance)) {
          best = { ...rect, centerDistance };
        }
      }
    }
  }
  if (!best) {
    throw new Error(`${label} has no clean 2:1 top-surface sample rectangle.`);
  }
  return {
    left: best.left,
    top: best.top,
    width: best.width,
    height: best.height,
  };
};

const validateFlatDiamond = async (buffer, label) => {
  const bounds = await getAlphaBounds(buffer);
  if (!bounds) {
    throw new Error(`${label} generated no visible terrain pixels.`);
  }
  const ratio = bounds.width / bounds.height;
  if (ratio < 1.75 || ratio > 2.15) {
    throw new Error(`${label} is ${bounds.width}x${bounds.height}; expected a flat 2:1 diamond.`);
  }
  if (bounds.bottom > DIAMOND_POINTS[2][1] + 1) {
    throw new Error(`${label} has visible pixels below the flat diamond mask.`);
  }
};

const getAverageColor = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const diamondMidY = DIAMOND_POINTS[1][1];

  for (let y = 0; y <= diamondMidY; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * info.channels;
      if (data[index + 3] <= ALPHA_THRESHOLD) {
        continue;
      }
      r += data[index];
      g += data[index + 1];
      b += data[index + 2];
      count += 1;
    }
  }

  if (count === 0) {
    return { r: 128, g: 128, b: 128 };
  }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
};

const createKeyedPreview = async (transparentBuffer) => sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 4,
    background: KEY,
  },
})
  .composite([{ input: transparentBuffer }])
  .png()
  .toBuffer();

const buildTile = async (theme, frame, sourceMetadata) => {
  const sourcePath = path.join(SOURCES_DIR, theme, 'terrain-source.png');
  const dir = path.join(SOURCES_DIR, theme, 'terrain');
  const index = TERRAIN_NAMES.indexOf(frame);
  const crop = getGridCrop(sourceMetadata, SOURCE_COLUMNS, SOURCE_ROWS, index);
  const rawCell = await sharp(sourcePath).extract(crop).png().toBuffer();
  const transparentCell = await removeChromaKey(rawCell);
  const sampleRect = await findTopSampleRect(transparentCell, `${theme}/${frame}`);
  const sampledTopArt = await sharp(transparentCell)
    .extract(sampleRect)
    .resize(TARGET_BOUNDS.width, TARGET_BOUNDS.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .composite([{ input: targetDiamondMaskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const maskedArt = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: sampledTopArt, left: TARGET_BOUNDS.left, top: TARGET_BOUNDS.top }])
    .png()
    .toBuffer();
  const flatDiamond = await sharp(diamondFillSvg(await getAverageColor(maskedArt)))
    .composite([{ input: maskedArt }])
    .png()
    .toBuffer();

  await validateFlatDiamond(flatDiamond, `${theme}/${frame}`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${frame}.png`), flatDiamond);
  await fs.writeFile(path.join(dir, `${frame}-source.png`), await createKeyedPreview(flatDiamond));
};

const main = async () => {
  for (const theme of THEMES) {
    const sourcePath = path.join(SOURCES_DIR, theme, 'terrain-source.png');
    const sourceMetadata = await sharp(sourcePath).metadata();
    for (const frame of TERRAIN_NAMES) {
      await buildTile(theme, frame, sourceMetadata);
    }
  }
  console.log(`generated ${THEMES.length * TERRAIN_NAMES.length} flat terrain source tiles`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
