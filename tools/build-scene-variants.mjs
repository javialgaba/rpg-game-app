import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCES_DIR = path.join(ROOT, 'public/assets/scene-variants/sources');
const OUTPUT_DIR = path.join(ROOT, 'public/assets/scene-variants');
const SCENE_SIZE = { width: 2048, height: 1152 };
const CHROMA_KEY = { r: 255, g: 0, b: 255 };
const PRESETS = ['day_spring', 'afternoon_summer', 'night_spring', 'noon_winter'];

const WINTER_SOURCE_MAP = {
  'winter-grass-source.png': { output: 'winter-grass-01.png', mode: 'diamondTile' },
  'winter-path-source.png': { output: 'winter-path-01.png', mode: 'diamondTile' },
  'winter-pine-source.png': { output: 'winter-pine-01.png', mode: 'chroma' },
  'winter-oak-source.png': { output: 'winter-oak-01.png', mode: 'chroma' },
  'winter-flower-source.png': { output: 'winter-flower-patch-01.png', mode: 'chroma' },
};

const ensureDir = async (target) => {
  await fs.mkdir(target, { recursive: true });
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const resizeCover = (input) => (
  sharp(input)
    .resize(SCENE_SIZE.width, SCENE_SIZE.height, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
);

const createPlayableCutoutSvg = () => {
  const { width, height } = SCENE_SIZE;
  const cx = width / 2;
  const cy = height / 2 + 24;
  const top = `${cx},${height * 0.305}`;
  const right = `${width * 0.732},${cy}`;
  const bottom = `${cx},${height * 0.775}`;
  const left = `${width * 0.268},${cy}`;
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="${top} ${right} ${bottom} ${left}" fill="white"/>
    </svg>
  `);
};

const chromaKeyImage = async (inputPath, options = {}) => {
  const {
    transparentThreshold = 44,
    opaqueThreshold = 120,
    despillStrength = 0.72,
  } = options;
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = Buffer.from(data);
  const span = Math.max(1, opaqueThreshold - transparentThreshold);

  for (let i = 0; i < result.length; i += 4) {
    const dr = result[i] - CHROMA_KEY.r;
    const dg = result[i + 1] - CHROMA_KEY.g;
    const db = result[i + 2] - CHROMA_KEY.b;
    const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));

    let alphaFactor = 1;
    if (distance <= transparentThreshold) {
      alphaFactor = 0;
    } else if (distance < opaqueThreshold) {
      alphaFactor = (distance - transparentThreshold) / span;
    }
    alphaFactor = clamp(alphaFactor, 0, 1);

    result[i + 3] = Math.round(result[i + 3] * alphaFactor);

    if (alphaFactor < 1) {
      const reduce = (1 - alphaFactor) * despillStrength;
      result[i] = Math.round(result[i] * (1 - reduce));
      result[i + 2] = Math.round(result[i + 2] * (1 - reduce));
    }
  }

  return sharp(result, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  });
};

const createDiamondMaskSvg = (size) => Buffer.from(`
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${size / 2},18 ${size - 18},${size / 2} ${size / 2},${size - 18} 18,${size / 2}" fill="white"/>
  </svg>
`);

const buildPreset = async (preset) => {
  const sceneSource = path.join(SOURCES_DIR, `${preset}-scene-source.png`);
  const fgSource = path.join(SOURCES_DIR, `${preset}-fg-source.png`);
  const bgOut = path.join(OUTPUT_DIR, `${preset}-bg.png`);
  const frameOut = path.join(OUTPUT_DIR, `${preset}-frame.png`);
  const fgOut = path.join(OUTPUT_DIR, `${preset}-fg.png`);

  await resizeCover(sceneSource)
    .png()
    .toFile(bgOut);

  await resizeCover(sceneSource)
    .ensureAlpha()
    .composite([{ input: createPlayableCutoutSvg(), blend: 'dest-out' }])
    .png()
    .toFile(frameOut);

  const fgAlpha = await chromaKeyImage(fgSource, {
    transparentThreshold: 28,
    opaqueThreshold: 98,
    despillStrength: 0.9,
  });
  await fgAlpha
    .resize(SCENE_SIZE.width, SCENE_SIZE.height, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toFile(fgOut);
};

const buildWinterAsset = async (sourceFile, outFile) => {
  const source = path.join(SOURCES_DIR, sourceFile);
  const output = path.join(OUTPUT_DIR, outFile);
  const alphaImage = await chromaKeyImage(source, {
    transparentThreshold: 28,
    opaqueThreshold: 96,
    despillStrength: 0.88,
  });
  await alphaImage
    .png()
    .toFile(output);
};

const buildWinterDiamondTile = async (sourceFile, outFile) => {
  const source = path.join(SOURCES_DIR, sourceFile);
  const output = path.join(OUTPUT_DIR, outFile);
  const cropSize = 220;
  const tileSize = 256;
  const sourceMeta = await sharp(source).metadata();
  const left = Math.max(0, Math.round((sourceMeta.width - cropSize) / 2));
  const top = Math.max(0, Math.round((sourceMeta.height - cropSize) / 2));
  const diamond = await sharp(source)
    .extract({ left, top, width: cropSize, height: cropSize })
    .resize(tileSize, tileSize, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .composite([{ input: createDiamondMaskSvg(tileSize), blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: tileSize,
      height: tileSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: diamond }])
    .png()
    .toFile(output);
};

const main = async () => {
  await ensureDir(OUTPUT_DIR);
  for (const preset of PRESETS) {
    await buildPreset(preset);
  }
  for (const [source, config] of Object.entries(WINTER_SOURCE_MAP)) {
    if (config.mode === 'diamondTile') {
      await buildWinterDiamondTile(source, config.output);
      continue;
    }
    await buildWinterAsset(source, config.output);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
