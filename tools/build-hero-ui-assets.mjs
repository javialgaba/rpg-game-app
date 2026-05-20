import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'public/assets');

const ensureDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const createButtonSvg = ({
  width,
  height,
  fillA,
  fillB,
  border,
  innerBorder,
  jewel,
  accent,
  glyph,
}) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="outer" x1="0" y1="0" x2="0" y2="${height}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFF6C8"/>
      <stop offset="0.5" stop-color="${border}"/>
      <stop offset="1" stop-color="#915719"/>
    </linearGradient>
    <linearGradient id="inner" x1="0" y1="8" x2="0" y2="${height - 8}" gradientUnits="userSpaceOnUse">
      <stop stop-color="${fillA}"/>
      <stop offset="1" stop-color="${fillB}"/>
    </linearGradient>
    <radialGradient id="gloss" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${width * 0.36} ${height * 0.28}) rotate(34) scale(${width * 0.28} ${height * 0.34})">
      <stop stop-color="#FFFFFF" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#132130" flood-opacity="0.35"/>
    </filter>
  </defs>

  <g filter="url(#shadow)">
    <rect x="9" y="10" width="${width - 18}" height="${height - 22}" rx="28" fill="#1A2230" fill-opacity="0.56"/>
    <rect x="8" y="8" width="${width - 16}" height="${height - 20}" rx="28" fill="url(#outer)"/>
    <rect x="16" y="16" width="${width - 32}" height="${height - 36}" rx="22" fill="#2A3443"/>
    <rect x="21" y="21" width="${width - 42}" height="${height - 46}" rx="18" fill="url(#inner)" stroke="${innerBorder}" stroke-width="4"/>
    <ellipse cx="${width / 2}" cy="${height - 22}" rx="${width * 0.32}" ry="${height * 0.15}" fill="${accent}" fill-opacity="0.16"/>
    <ellipse cx="${width / 2}" cy="18" rx="${width * 0.26}" ry="8" fill="#FFFFFF" fill-opacity="0.2"/>
    <rect x="21" y="21" width="${width - 42}" height="${height - 46}" rx="18" fill="url(#gloss)"/>

    <path d="M34 58c10-16 23-22 34-22 10 0 18 4 25 12-17-2-28 3-39 16-6 7-11 11-20 14 3-8 4-13 0-20Z" fill="${accent}" fill-opacity="0.42"/>
    <path d="M${width - 34} 58c-10-16-23-22-34-22-10 0-18 4-25 12 17-2 28 3 39 16 6 7 11 11 20 14-3-8-4-13 0-20Z" fill="${accent}" fill-opacity="0.42"/>

    <path d="M${width / 2} 4l10 10-10 10-10-10 10-10Z" fill="${jewel}" stroke="#FFEAB0" stroke-width="3"/>
    <path d="M${width / 2} ${height - 4}l10-10-10-10-10 10 10 10Z" fill="${jewel}" stroke="#FFEAB0" stroke-width="3"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="26" fill="#FFFFFF" fill-opacity="0.12"/>
    ${glyph}
  </g>
</svg>`;

const buildRepairButtons = async () => {
  const width = 296;
  const height = 116;
  const buttons = [
    {
      output: path.join(ASSETS_DIR, 'repair-mode-confirm.png'),
      svg: createButtonSvg({
        width,
        height,
        fillA: '#8DF4A2',
        fillB: '#5DC06D',
        border: '#E6A744',
        innerBorder: '#CFFFF0',
        jewel: '#7ADCF6',
        accent: '#2B7C47',
        glyph: `<path d="M122 59l20 20 44-48" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`,
      }),
    },
    {
      output: path.join(ASSETS_DIR, 'repair-mode-cancel.png'),
      svg: createButtonSvg({
        width,
        height,
        fillA: '#FFB5B1',
        fillB: '#EA7C77',
        border: '#E6A744',
        innerBorder: '#FFE1DF',
        jewel: '#CDA6FF',
        accent: '#8C2F37',
        glyph: `<path d="M126 42l44 44M170 42l-44 44" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round"/>`,
      }),
    },
  ];

  for (const button of buttons) {
    await ensureDir(button.output);
    await sharp(Buffer.from(button.svg))
      .png()
      .toFile(button.output);
  }
};

const main = async () => {
  await buildRepairButtons();
  const princessSheet = path.join(ASSETS_DIR, 'princess-hero-sheet.png');
  await fs.access(princessSheet);
  console.log('Hero/UI assets ready.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
