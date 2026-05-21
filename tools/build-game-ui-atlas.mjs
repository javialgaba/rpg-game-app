import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE = 'public/assets/atlas-sources/generated/game-ui-tiles-source.png';
const ATLAS_IMAGE = 'public/assets/game_ui_atlas.png';
const ATLAS_JSON = 'public/assets/game_ui_atlas.json';
const validateOnly = process.argv.includes('--validate-only');

const REQUIRED_FRAMES = [
  'panel_corner_tl',
  'panel_edge_top',
  'panel_corner_tr',
  'panel_fill',
  'panel_edge_left',
  'title_plaque',
  'title_left',
  'title_mid',
  'title_right',
  'panel_edge_right',
  'content_slot',
  'panel_corner_bl',
  'panel_edge_bottom',
  'panel_corner_br',
  'button_frame',
  'button_left',
  'button_mid',
  'button_right',
  'health_full_01',
  'health_empty_01',
  'mana_frame',
  'mana_left',
  'mana_mid',
  'mana_right',
  'hud_chip_left',
  'hud_chip_mid',
  'hud_chip_right',
  'coin_badge_01',
];

const SOURCE_CELLS = [
  ['panel_corner_tl', 'panel_edge_top', 'panel_corner_tr', 'panel_fill_source'],
  ['panel_edge_left', 'title_plaque', 'panel_edge_right', 'content_slot'],
  ['panel_corner_bl', 'panel_edge_bottom', 'panel_corner_br', 'button_frame'],
  ['health_full_01', 'health_empty_01', 'mana_frame', 'coin_badge_01'],
];

const resolvePath = (filePath) => path.resolve(ROOT, filePath);

const readRgba = async (image) => image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const chromaKeyBuffer = ({ data, info }) => {
  const next = Buffer.from(data);
  for (let index = 0; index < next.length; index += info.channels) {
    const red = next[index];
    const green = next[index + 1];
    const blue = next[index + 2];
    const alphaIndex = index + 3;
    const isKey = green > 150 && red < 95 && blue < 95;
    if (isKey) {
      next[alphaIndex] = 0;
      continue;
    }
    if (green > 110 && red < 120 && blue < 120) {
      next[index + 1] = Math.max(0, green - 24);
    }
  }
  return sharp(next, { raw: info });
};

const alphaBounds = async (image) => {
  const { data, info } = await readRgba(image);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha <= 8) {
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

const cropCell = async (source, metadata, col, row) => {
  const left = Math.round((metadata.width * col) / 4) + 4;
  const top = Math.round((metadata.height * row) / 4) + 4;
  const right = Math.round((metadata.width * (col + 1)) / 4) - 4;
  const bottom = Math.round((metadata.height * (row + 1)) / 4) - 4;
  const crop = source.extract({
    left,
    top,
    width: right - left,
    height: bottom - top,
  });
  return chromaKeyBuffer(await readRgba(crop));
};

const trimFrame = async (name, image, inset = 0) => {
  const bounds = await alphaBounds(image);
  if (!bounds) {
    throw new Error(`${name} has no visible pixels.`);
  }
  const metadata = await image.metadata();
  const left = Math.min(Math.max(0, bounds.left + inset), (metadata.width ?? 1) - 1);
  const top = Math.min(Math.max(0, bounds.top + inset), (metadata.height ?? 1) - 1);
  const right = Math.max(left + 1, Math.min((metadata.width ?? left + 1), bounds.left + bounds.width - inset));
  const bottom = Math.max(top + 1, Math.min((metadata.height ?? top + 1), bounds.top + bounds.height - inset));
  const buffer = await image
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
  const trimmed = sharp(buffer);
  const trimmedMetadata = await trimmed.metadata();
  return {
    name,
    buffer,
    width: trimmedMetadata.width ?? right - left,
    height: trimmedMetadata.height ?? bottom - top,
  };
};

const averageColorFrame = async (name, image, size = 64) => {
  const bounds = await alphaBounds(image);
  if (!bounds) {
    throw new Error(`${name} has no visible pixels.`);
  }
  const sampleSize = Math.min(96, bounds.width, bounds.height);
  const left = Math.round(bounds.left + bounds.width / 2 - sampleSize / 2);
  const top = Math.round(bounds.top + bounds.height / 2 - sampleSize / 2);
  const { data, info } = await readRgba(image.extract({ left, top, width: sampleSize, height: sampleSize }));
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index + 3] <= 8) {
      continue;
    }
    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    alpha += data[index + 3];
    count += 1;
  }
  if (count <= 0) {
    throw new Error(`${name} has no sampled visible pixels.`);
  }
  const buffer = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: {
        r: Math.round(red / count),
        g: Math.round(green / count),
        b: Math.round(blue / count),
        alpha: Math.round(alpha / count) / 255,
      },
    },
  }).png().toBuffer();
  return { name, buffer, width: size, height: size };
};

const splitHorizontal = async (frame, parts) => {
  const frames = [];
  for (const part of parts) {
    const left = Math.round(frame.width * part.from);
    const right = Math.round(frame.width * part.to);
    const width = Math.max(1, right - left);
    const buffer = await sharp(frame.buffer)
      .extract({ left, top: 0, width, height: frame.height })
      .png()
      .toBuffer();
    frames.push({ name: part.name, buffer, width, height: frame.height });
  }
  return frames;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const cropFrame = async (frame, name, left, top, width, height) => {
  const safeLeft = clamp(Math.round(left), 0, frame.width - 1);
  const safeTop = clamp(Math.round(top), 0, frame.height - 1);
  const safeWidth = Math.max(1, Math.min(Math.round(width), frame.width - safeLeft));
  const safeHeight = Math.max(1, Math.min(Math.round(height), frame.height - safeTop));
  const buffer = await sharp(frame.buffer)
    .extract({ left: safeLeft, top: safeTop, width: safeWidth, height: safeHeight })
    .png()
    .toBuffer();
  return { name, buffer, width: safeWidth, height: safeHeight };
};

const verticalAverageFrame = async (frame, name, left, top, width, height, outputWidth = 24) => {
  const crop = sharp(frame.buffer).extract({
    left: clamp(Math.round(left), 0, frame.width - 1),
    top: clamp(Math.round(top), 0, frame.height - 1),
    width: Math.max(1, Math.min(Math.round(width), frame.width - Math.round(left))),
    height: Math.max(1, Math.min(Math.round(height), frame.height - Math.round(top))),
  });
  const { data, info } = await readRgba(crop);
  const out = Buffer.alloc(outputWidth * info.height * info.channels);
  for (let y = 0; y < info.height; y += 1) {
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;
    let count = 0;
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * info.channels;
      const isChroma = data[index + 1] > 120 && data[index] < 130 && data[index + 2] < 130;
      if (data[index + 3] <= 8 || isChroma) {
        continue;
      }
      red += data[index];
      green += data[index + 1];
      blue += data[index + 2];
      alpha += data[index + 3];
      count += 1;
    }
    const rowColor = [
      count > 0 ? Math.round(red / count) : 0,
      count > 0 ? Math.round(green / count) : 0,
      count > 0 ? Math.round(blue / count) : 0,
      count > 0 ? Math.round(alpha / count) : 0,
    ];
    for (let x = 0; x < outputWidth; x += 1) {
      const outIndex = (y * outputWidth + x) * info.channels;
      out[outIndex] = rowColor[0];
      out[outIndex + 1] = rowColor[1];
      out[outIndex + 2] = rowColor[2];
      out[outIndex + 3] = rowColor[3];
    }
  }
  const buffer = await sharp(out, {
    raw: {
      width: outputWidth,
      height: info.height,
      channels: info.channels,
    },
  }).png().toBuffer();
  return { name, buffer, width: outputWidth, height: info.height };
};

const svgFrame = async (name, width, height, body) => {
  const buffer = await sharp(Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${body}
    </svg>
  `)).png().toBuffer();
  return { name, buffer, width, height };
};

const hudChipFrames = async () => {
  const height = 42;
  return [
    await svgFrame('hud_chip_left', 30, height, `
      <path d="M30 5 H14 Q5 5 5 14 V28 Q5 37 14 37 H30 Z" fill="#f2c760" stroke="#8a5a20" stroke-width="4"/>
      <path d="M30 10 H15 Q10 10 10 15 V27 Q10 32 15 32 H30" fill="#f7dda0" stroke="#fff0be" stroke-width="2"/>
    `),
    await svgFrame('hud_chip_mid', 18, height, `
      <path d="M0 5 H18 V37 H0 Z" fill="#f2c760" stroke="#8a5a20" stroke-width="4"/>
      <path d="M0 10 H18 V32 H0 Z" fill="#f7dda0" stroke="#fff0be" stroke-width="2"/>
    `),
    await svgFrame('hud_chip_right', 30, height, `
      <path d="M0 5 H16 Q25 5 25 14 V28 Q25 37 16 37 H0 Z" fill="#f2c760" stroke="#8a5a20" stroke-width="4"/>
      <path d="M0 10 H15 Q20 10 20 15 V27 Q20 32 15 32 H0" fill="#f7dda0" stroke="#fff0be" stroke-width="2"/>
    `),
  ];
};

const prepareFrames = async () => {
  const source = sharp(resolvePath(SOURCE));
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`${SOURCE} is missing dimensions.`);
  }
  const frames = [];
  const cellImages = new Map();
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const name = SOURCE_CELLS[row][col];
      const image = await cropCell(source.clone(), metadata, col, row);
      cellImages.set(name, image);
      if (name === 'panel_fill_source') {
        frames.push(await averageColorFrame('panel_fill', image));
      } else {
        frames.push(await trimFrame(name, image));
      }
    }
  }
  const buttonFrame = frames.find((frame) => frame.name === 'button_frame');
  const manaFrame = frames.find((frame) => frame.name === 'mana_frame');
  const titleFrame = frames.find((frame) => frame.name === 'title_plaque');
  if (!buttonFrame || !manaFrame || !titleFrame) {
    throw new Error('Missing derived slice source frames.');
  }
  frames.push(
    await cropFrame(titleFrame, 'title_left', 0, 0, 92, titleFrame.height),
    await verticalAverageFrame(titleFrame, 'title_mid', 84, 0, 24, titleFrame.height, 18),
    await cropFrame(titleFrame, 'title_right', titleFrame.width - 92, 0, 92, titleFrame.height),
  );
  frames.push(...await splitHorizontal(buttonFrame, [
    { name: 'button_left', from: 0, to: 0.28 },
    { name: 'button_right', from: 0.72, to: 1 },
  ]));
  frames.push(await verticalAverageFrame(buttonFrame, 'button_mid', 112, 0, 58, buttonFrame.height, 24));
  frames.push(...await hudChipFrames());
  frames.push(...await splitHorizontal(manaFrame, [
    { name: 'mana_left', from: 0, to: 0.20 },
    { name: 'mana_right', from: 0.80, to: 1 },
  ]));
  frames.push(await verticalAverageFrame(manaFrame, 'mana_mid', 104, 0, 78, manaFrame.height, 28));
  return frames;
};

const packFrames = (frames) => {
  const padding = 6;
  const atlasWidth = 1024;
  let x = padding;
  let y = padding;
  let rowHeight = 0;
  const placements = [];
  frames.forEach((frame) => {
    if (x + frame.width + padding > atlasWidth) {
      x = padding;
      y += rowHeight + padding;
      rowHeight = 0;
    }
    placements.push({ ...frame, x, y });
    x += frame.width + padding;
    rowHeight = Math.max(rowHeight, frame.height);
  });
  return {
    width: atlasWidth,
    height: y + rowHeight + padding,
    placements,
  };
};

const atlasJson = ({ width, height, placements }) => {
  const frames = {};
  placements.forEach((frame) => {
    frames[frame.name] = {
      frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: frame.width, h: frame.height },
      sourceSize: { w: frame.width, h: frame.height },
    };
  });
  return {
    frames,
    meta: {
      app: 'fairy-guild-defense game ui atlas builder',
      image: path.basename(ATLAS_IMAGE),
      format: 'RGBA8888',
      size: { w: width, h: height },
      scale: '1',
    },
  };
};

const buildAtlas = async () => {
  const frames = await prepareFrames();
  const packed = packFrames(frames);
  await fs.mkdir(path.dirname(resolvePath(ATLAS_IMAGE)), { recursive: true });
  await sharp({
    create: {
      width: packed.width,
      height: packed.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(packed.placements.map((frame) => ({ input: frame.buffer, left: frame.x, top: frame.y })))
    .png()
    .toFile(resolvePath(ATLAS_IMAGE));
  await fs.writeFile(resolvePath(ATLAS_JSON), `${JSON.stringify(atlasJson(packed), null, 2)}\n`);
  console.log(`built game ui atlas: ${ATLAS_IMAGE}`);
};

const validateAtlas = async () => {
  const [jsonRaw, metadata] = await Promise.all([
    fs.readFile(resolvePath(ATLAS_JSON), 'utf8'),
    sharp(resolvePath(ATLAS_IMAGE)).metadata(),
  ]);
  const json = JSON.parse(jsonRaw);
  const missing = REQUIRED_FRAMES.filter((frameName) => !json.frames?.[frameName]);
  const errors = [];
  missing.forEach((frameName) => errors.push(`game ui atlas missing ${frameName}`));
  if (metadata.width !== json.meta?.size?.w || metadata.height !== json.meta?.size?.h) {
    errors.push('game ui atlas metadata dimensions do not match image dimensions');
  }
  Object.entries(json.frames ?? {}).forEach(([frameName, frameData]) => {
    const frame = frameData.frame;
    if (!frame.w || !frame.h) {
      errors.push(`${frameName} has empty dimensions`);
    }
    if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > (metadata.width ?? 0) || frame.y + frame.h > (metadata.height ?? 0)) {
      errors.push(`${frameName} is outside atlas bounds`);
    }
  });
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  console.log(`validated game ui atlas: ${Object.keys(json.frames ?? {}).length} frames`);
};

const main = async () => {
  if (!validateOnly) {
    await buildAtlas();
  }
  await validateAtlas();
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
