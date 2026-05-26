import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCES_DIR = path.join(ROOT, 'public/assets/scene-variants/sources');
const OUTPUT_DIR = path.join(ROOT, 'public/assets/scene-variants');
const SCENE_SIZE = { width: 2048, height: 1152 };
const CHROMA_KEY = { r: 255, g: 0, b: 255 };
const PRESETS = ['day_spring', 'afternoon_summer', 'night_spring', 'noon_winter'];
const VISUAL_THEMES = ['spring', 'summer', 'twilight_autumn', 'winter'];
const validateOnly = process.argv.includes('--validate-only');
const ALPHA_THRESHOLD = 8;
const EDGE_GUARD_PX = 2;
const CHROMA_FRINGE_DISTANCE = 28;
const TERRAIN_FLAT_RATIO_MIN = 1.75;
const TERRAIN_FLAT_RATIO_MAX = 2.15;

const WINTER_SOURCE_MAP = {
  'winter-grass-source.png': { output: 'winter-grass-01.png', mode: 'diamondTile' },
  'winter-path-source.png': { output: 'winter-path-01.png', mode: 'diamondTile' },
  'winter-pine-source.png': { output: 'winter-pine-01.png', mode: 'chroma' },
  'winter-oak-source.png': { output: 'winter-oak-01.png', mode: 'chroma' },
  'winter-flower-source.png': { output: 'winter-flower-patch-01.png', mode: 'chroma' },
};

const TERRAIN_NAMES = ['grass_01', 'grass_02', 'grass_03', 'path_01', 'path_02', 'plaza_01'];
const TREE_NAMES = ['conifer_01', 'broadleaf_01', 'signature_tree_01', 'sapling_01', 'tree_cluster_01'];
const PROP_NAMES = [
  'rocks_small_01',
  'rocks_medium_01',
  'rocks_large_01',
  'pond_01',
  'pond_02',
  'bush_01',
  'flowers_01',
  'grass_tuft_01',
  'magic_patch_01',
  'lamp_01',
  'fence_01',
  'sign_01',
];
const LEGACY_GATE_SOURCE_INDEXES = {
  gate_n_01: 0,
  gate_e_01: 2,
  gate_s_01: 3,
};
const BUILDING_NAMES = [
  'castle_01',
  'cottage_01',
  'inn_01',
  'bakery_01',
  'smithy_01',
  'market_01',
  'apothecary_01',
  'well_01',
  'shrine_01',
];

const createSheetFrames = (sheetName, columns, rows, names, padding, align) => (
  VISUAL_THEMES.flatMap((theme) => names.map((name, index) => ({
    name: `${theme}_${name}`,
    source: path.join(SOURCES_DIR, theme, `${sheetName}-source.png`),
    columns,
    rows,
    index,
    padding,
    align,
  })))
);

const createTerrainFrames = () => VISUAL_THEMES.flatMap((theme) => TERRAIN_NAMES.map((name) => ({
  name: `${theme}_${name}`,
  source: path.join(SOURCES_DIR, theme, 'terrain', `${name}.png`),
  columns: 1,
  rows: 1,
  index: 0,
  padding: 8,
  align: 'center',
  preprocessed: true,
  terrain: true,
})));

const createGateFrames = () => VISUAL_THEMES.flatMap((theme) => [
  ...Object.entries(LEGACY_GATE_SOURCE_INDEXES).map(([name, index]) => ({
    name: `${theme}_${name}`,
    source: path.join(SOURCES_DIR, theme, 'gates-source.png'),
    columns: 2,
    rows: 2,
    index,
    padding: 20,
    align: 'bottom',
  })),
  {
    name: `${theme}_gate_w_01`,
    source: path.join(SOURCES_DIR, theme, 'gate-w-source.png'),
    columns: 1,
    rows: 1,
    index: 0,
    padding: 20,
    align: 'bottom',
  },
]);

const SEASONAL_ATLASES = {
  terrain: {
    outputImage: path.join(OUTPUT_DIR, 'scene_variant_terrain_atlas.png'),
    outputJson: path.join(OUTPUT_DIR, 'scene_variant_terrain_atlas.json'),
    cellSize: 256,
    columns: 8,
    terrain: true,
    frames: createTerrainFrames(),
  },
  props: {
    outputImage: path.join(OUTPUT_DIR, 'scene_variant_props_atlas.png'),
    outputJson: path.join(OUTPUT_DIR, 'scene_variant_props_atlas.json'),
    cellSize: 384,
    columns: 8,
    frames: [
      ...createSheetFrames('trees', 3, 2, TREE_NAMES, 16, 'bottom'),
      ...createSheetFrames('props', 4, 3, PROP_NAMES, 16, 'bottom'),
      ...createGateFrames(),
    ],
  },
  buildings: {
    outputImage: path.join(OUTPUT_DIR, 'scene_variant_buildings_atlas.png'),
    outputJson: path.join(OUTPUT_DIR, 'scene_variant_buildings_atlas.json'),
    cellSize: 384,
    columns: 6,
    frames: createSheetFrames('buildings', 3, 3, BUILDING_NAMES, 16, 'bottom'),
  },
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
  const cy = height / 2;
  const top = `${cx},${height * 0.055}`;
  const right = `${width * 0.97},${cy}`;
  const bottom = `${cx},${height * 0.955}`;
  const left = `${width * 0.03},${cy}`;
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

const getAlphaBounds = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
  };
};

const keepPrimaryComponent = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const visited = new Uint8Array(info.width * info.height);
  let primary = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const pixelIndex = y * info.width + x;
      if (visited[pixelIndex] || data[pixelIndex * info.channels + 3] <= ALPHA_THRESHOLD) {
        continue;
      }
      const component = [];
      const queue = [pixelIndex];
      visited[pixelIndex] = 1;
      while (queue.length > 0) {
        const current = queue.pop();
        component.push(current);
        const currentX = current % info.width;
        const currentY = Math.floor(current / info.width);
        [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1],
        ].forEach(([nextX, nextY]) => {
          if (nextX < 0 || nextY < 0 || nextX >= info.width || nextY >= info.height) {
            return;
          }
          const nextIndex = nextY * info.width + nextX;
          if (visited[nextIndex] || data[nextIndex * info.channels + 3] <= ALPHA_THRESHOLD) {
            return;
          }
          visited[nextIndex] = 1;
          queue.push(nextIndex);
        });
      }
      if (component.length > primary.length) {
        primary = component;
      }
    }
  }
  if (primary.length === 0) {
    return buffer;
  }
  const retained = new Uint8Array(info.width * info.height);
  primary.forEach((pixelIndex) => {
    retained[pixelIndex] = 1;
  });
  const cleaned = Buffer.from(data);
  for (let pixelIndex = 0; pixelIndex < retained.length; pixelIndex += 1) {
    if (!retained[pixelIndex]) {
      cleaned[pixelIndex * info.channels + 3] = 0;
    }
  }
  return sharp(cleaned, { raw: info }).png().toBuffer();
};

const getGridCrop = (metadata, columns, rows, index) => {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const left = Math.round((metadata.width * column) / columns);
  const right = Math.round((metadata.width * (column + 1)) / columns);
  const top = Math.round((metadata.height * row) / rows);
  const bottom = Math.round((metadata.height * (row + 1)) / rows);
  return { left, top, width: right - left, height: bottom - top };
};

const keyedSourceCache = new Map();

const readKeyedSource = async (sourcePath) => {
  if (!keyedSourceCache.has(sourcePath)) {
    const keyed = await chromaKeyImage(sourcePath, {
      transparentThreshold: 44,
      opaqueThreshold: 120,
      despillStrength: 0.92,
    });
    keyedSourceCache.set(sourcePath, keyed.png().toBuffer());
  }
  return keyedSourceCache.get(sourcePath);
};

const getFrameSource = async (frame) => {
  await fs.access(frame.source);
  return {
    source: frame.source,
    columns: frame.columns,
    rows: frame.rows,
    index: frame.index,
    preprocessed: frame.preprocessed,
  };
};

const readFrameSource = async (frameSource) => {
  if (frameSource.preprocessed) {
    return fs.readFile(frameSource.source);
  }
  return readKeyedSource(frameSource.source);
};

const prepareSeasonalFrame = async (frame, cellSize) => {
  const frameSource = await getFrameSource(frame);
  const sourceBuffer = await readFrameSource(frameSource);
  const metadata = await sharp(sourceBuffer).metadata();
  const crop = getGridCrop(metadata, frameSource.columns, frameSource.rows, frameSource.index);
  const rawCropBuffer = await sharp(sourceBuffer).extract(crop).png().toBuffer();
  const cropBuffer = await keepPrimaryComponent(rawCropBuffer);
  const bounds = await getAlphaBounds(cropBuffer);
  if (!bounds) {
    throw new Error(`${frame.name} has no visible pixels after chroma-key extraction.`);
  }
  const content = sharp(cropBuffer).extract(bounds);
  const maxSize = cellSize - frame.padding * 2;
  const scale = Math.min(maxSize / bounds.width, maxSize / bounds.height, 1);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const resized = await content.resize(width, height, { fit: 'fill', kernel: sharp.kernel.lanczos3 }).png().toBuffer();
  const cleaned = await chromaKeyImage(resized, {
    transparentThreshold: CHROMA_FRINGE_DISTANCE,
    opaqueThreshold: 64,
    despillStrength: 1,
  });
  const input = await cleaned.png().toBuffer();
  return {
    input,
    left: Math.round((cellSize - width) / 2),
    top: frame.align === 'bottom' ? cellSize - frame.padding - height : Math.round((cellSize - height) / 2),
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
      app: 'fairy-guild-defense seasonal atlas builder',
      image: path.basename(atlas.outputImage),
      format: 'RGBA8888',
      size: { w: width, h: height },
      scale: '1',
    },
  };
};

const buildSeasonalAtlas = async (name, atlas) => {
  const rows = Math.ceil(atlas.frames.length / atlas.columns);
  const width = atlas.columns * atlas.cellSize;
  const height = rows * atlas.cellSize;
  const composites = [];
  for (const [index, frame] of atlas.frames.entries()) {
    const prepared = await prepareSeasonalFrame(frame, atlas.cellSize);
    composites.push({
      input: prepared.input,
      left: (index % atlas.columns) * atlas.cellSize + prepared.left,
      top: Math.floor(index / atlas.columns) * atlas.cellSize + prepared.top,
    });
  }
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite(composites).png().toFile(atlas.outputImage);
  await fs.writeFile(atlas.outputJson, `${JSON.stringify(makeAtlasJson(atlas, width, height), null, 2)}\n`);
  console.log(`built seasonal ${name}: ${path.basename(atlas.outputImage)}`);
};

const validateSeasonalAtlas = async (name, atlas) => {
  const expectedNames = atlas.frames.map((frame) => frame.name);
  const json = JSON.parse(await fs.readFile(atlas.outputJson, 'utf8'));
  const missing = expectedNames.filter((frameName) => !json.frames?.[frameName]);
  const metadata = await sharp(atlas.outputImage).metadata();
  const expectedRows = Math.ceil(expectedNames.length / atlas.columns);
  const errors = missing.map((frameName) => `${name} is missing frame ${frameName}.`);
  if (metadata.width !== atlas.columns * atlas.cellSize || metadata.height !== expectedRows * atlas.cellSize) {
    errors.push(`${name} has invalid atlas dimensions.`);
  }
  for (const frameName of expectedNames) {
    const frame = json.frames?.[frameName]?.frame;
    if (!frame) {
      continue;
    }
    const { data, info } = await sharp(atlas.outputImage)
      .extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let visiblePixels = 0;
    let minX = info.width;
    let minY = info.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const index = (y * info.width + x) * info.channels;
        const alpha = data[index + 3];
        if (alpha <= ALPHA_THRESHOLD) {
          continue;
        }
        visiblePixels += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        const chromaDistance = Math.hypot(
          data[index] - CHROMA_KEY.r,
          data[index + 1] - CHROMA_KEY.g,
          data[index + 2] - CHROMA_KEY.b,
        );
        if (chromaDistance <= CHROMA_FRINGE_DISTANCE) {
          errors.push(`${frameName} has visible chroma-key fringe.`);
          y = info.height;
          break;
        }
        const nearEdge = x < EDGE_GUARD_PX
          || y < EDGE_GUARD_PX
          || x >= info.width - EDGE_GUARD_PX
          || y >= info.height - EDGE_GUARD_PX;
        if (nearEdge) {
          errors.push(`${frameName} has visible pixels touching its atlas cell edge.`);
          y = info.height;
          break;
        }
      }
    }
    if (visiblePixels === 0) {
      errors.push(`${frameName} is empty.`);
    } else if (atlas.terrain) {
      const visibleWidth = maxX - minX + 1;
      const visibleHeight = maxY - minY + 1;
      const ratio = visibleWidth / visibleHeight;
      if (ratio < TERRAIN_FLAT_RATIO_MIN || ratio > TERRAIN_FLAT_RATIO_MAX) {
        errors.push(`${frameName} is ${visibleWidth}x${visibleHeight}; expected a flat 2:1 diamond.`);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  console.log(`validated seasonal ${name}: ${expectedNames.length} frames`);
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
  if (!validateOnly) {
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
    for (const [name, atlas] of Object.entries(SEASONAL_ATLASES)) {
      await buildSeasonalAtlas(name, atlas);
    }
  }
  for (const [name, atlas] of Object.entries(SEASONAL_ATLASES)) {
    await validateSeasonalAtlas(name, atlas);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
