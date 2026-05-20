import path from 'node:path';
import { rebuildWorldSheet, validateWorldSheet } from './process-world-sheet.mjs';

const root = process.cwd();
const validateOnly = process.argv.includes('--validate-only');

const manifest = [
  {
    key: 'day_spring-elite',
    inputPath: path.join(root, 'public/assets/world-monsters/sources/day_spring-elite-source.png'),
    sourceOutputPath: path.join(root, 'public/assets/world-monsters/sources/day_spring-elite-source.png'),
    outputPath: path.join(root, 'public/assets/world-monsters/day_spring-elite.png'),
    cellSize: 256,
    safeBorderPx: 16,
  },
  {
    key: 'afternoon_summer-elite',
    inputPath: path.join(root, 'public/assets/world-monsters/sources/afternoon_summer-elite-source.png'),
    sourceOutputPath: path.join(root, 'public/assets/world-monsters/sources/afternoon_summer-elite-source.png'),
    outputPath: path.join(root, 'public/assets/world-monsters/afternoon_summer-elite.png'),
    cellSize: 256,
    safeBorderPx: 16,
  },
  {
    key: 'night_spring-elite',
    inputPath: path.join(root, 'public/assets/world-monsters/sources/night_spring-elite-source.png'),
    sourceOutputPath: path.join(root, 'public/assets/world-monsters/sources/night_spring-elite-source.png'),
    outputPath: path.join(root, 'public/assets/world-monsters/night_spring-elite.png'),
    cellSize: 256,
    safeBorderPx: 16,
  },
  {
    key: 'noon_winter-elite',
    inputPath: path.join(root, 'public/assets/world-monsters/sources/noon_winter-elite-source.png'),
    sourceOutputPath: path.join(root, 'public/assets/world-monsters/sources/noon_winter-elite-source.png'),
    outputPath: path.join(root, 'public/assets/world-monsters/noon_winter-elite.png'),
    cellSize: 256,
    safeBorderPx: 16,
  },
  {
    key: 'day_spring-boss',
    inputPath: path.join(root, 'public/assets/world-bosses/sources/day_spring-boss-source.png'),
    sourceOutputPath: path.join(root, 'public/assets/world-bosses/sources/day_spring-boss-source.png'),
    outputPath: path.join(root, 'public/assets/world-bosses/day_spring-boss.png'),
    cellSize: 384,
    safeBorderPx: 24,
  },
  {
    key: 'afternoon_summer-boss',
    inputPath: path.join(root, 'public/assets/world-bosses/sources/afternoon_summer-boss-source.png'),
    sourceOutputPath: path.join(root, 'public/assets/world-bosses/sources/afternoon_summer-boss-source.png'),
    outputPath: path.join(root, 'public/assets/world-bosses/afternoon_summer-boss.png'),
    cellSize: 384,
    safeBorderPx: 24,
  },
  {
    key: 'night_spring-boss',
    inputPath: path.join(root, 'public/assets/world-bosses/sources/night_spring-boss-source.png'),
    sourceOutputPath: path.join(root, 'public/assets/world-bosses/sources/night_spring-boss-source.png'),
    outputPath: path.join(root, 'public/assets/world-bosses/night_spring-boss.png'),
    cellSize: 384,
    safeBorderPx: 24,
  },
  {
    key: 'noon_winter-boss',
    inputPath: path.join(root, 'public/assets/world-bosses/sources/noon_winter-boss-source.png'),
    sourceOutputPath: path.join(root, 'public/assets/world-bosses/sources/noon_winter-boss-source.png'),
    outputPath: path.join(root, 'public/assets/world-bosses/noon_winter-boss.png'),
    cellSize: 384,
    safeBorderPx: 24,
  },
];

const results = [];

for (const entry of manifest) {
  if (validateOnly) {
    await validateWorldSheet(entry);
    results.push({ key: entry.key, status: 'validated' });
    continue;
  }
  const result = await rebuildWorldSheet(entry);
  results.push({ key: entry.key, ...result });
}

console.log(JSON.stringify(results, null, 2));
