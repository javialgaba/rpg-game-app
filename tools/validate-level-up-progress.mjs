import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(os.tmpdir(), `village-card-progress-tests-${process.pid}`);
const sourcePath = path.join(repoRoot, 'src/gameConfig.ts');
const outPath = path.join(outRoot, 'gameConfig.js');
const source = await fs.readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    isolatedModules: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
});

await fs.rm(outRoot, { force: true, recursive: true });
await fs.mkdir(outRoot, { recursive: true });
await fs.writeFile(path.join(outRoot, 'package.json'), '{"type":"commonjs"}\n');
await fs.writeFile(outPath, compiled.outputText);

const require = createRequire(path.join(outRoot, 'index.cjs'));
const {
  CARD_DEFINITIONS,
  CARD_TIER_PERCENTAGES,
  HERO_CLASSES,
  LEVEL_UP_MAX_PIPS,
  SKILL_LEVELS,
  WAVE_BUDGETS,
} = require(outPath);

assert.deepEqual(Object.keys(HERO_CLASSES), ['warrior', 'archer', 'sorcerer']);
assert.equal(HERO_CLASSES.warrior.maxHealth, 4);
assert.equal(HERO_CLASSES.archer.attackRange, 9);
assert.equal(HERO_CLASSES.sorcerer.skill, 'Magic Shield');
assert.equal(CARD_DEFINITIONS.length, 6);
assert.equal(CARD_DEFINITIONS.filter((card) => card.persistent).length, 5);
assert.equal(CARD_TIER_PERCENTAGES.swiftBoots.length, LEVEL_UP_MAX_PIPS);
assert.deepEqual(SKILL_LEVELS, [3, 5, 7, 9]);
assert.deepEqual(WAVE_BUDGETS, [6, 9, 12, 16, 20, 24, 29, 34, 40]);

console.log('validated class, card, skill, and wave progression configuration');
