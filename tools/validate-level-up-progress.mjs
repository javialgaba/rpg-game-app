import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(os.tmpdir(), `rpg-level-up-progress-tests-${process.pid}`);

const compileFile = async (relativePath) => {
  const sourcePath = path.join(repoRoot, relativePath);
  const outPath = path.join(outRoot, relativePath).replace(/\.ts$/, '.js');
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
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, compiled.outputText);
};

await fs.rm(outRoot, { force: true, recursive: true });
await fs.mkdir(outRoot, { recursive: true });
await fs.writeFile(path.join(outRoot, 'package.json'), '{"type":"commonjs"}\n');
await compileFile('src/gameConfig.ts');

const require = createRequire(path.join(outRoot, 'index.cjs'));
const {
  BOW_EVOLUTION_POWER_BONUS,
  LEVEL_UP_MAX_PIPS,
  PLAYER_BASE,
  getBowLevelUpProgress,
  getRangeLevelUpPresentationForStats,
  isBowEvolutionReadyForStats,
} = require(path.join(outRoot, 'src', 'gameConfig.js'));

const stats = (bowPower, bowEvolved = false) => ({
  ...PLAYER_BASE,
  bowPower,
  bowEvolved,
});

const baseBow = stats(PLAYER_BASE.bowPower);
assert.equal(getBowLevelUpProgress(baseBow), 0, 'base bow should show no pips');
assert.equal(getRangeLevelUpPresentationForStats(baseBow).label, 'Range Damage');

const maxBow = stats(PLAYER_BASE.bowPower + LEVEL_UP_MAX_PIPS);
assert.equal(getBowLevelUpProgress(maxBow), LEVEL_UP_MAX_PIPS, 'max normal bow should show full pips');
assert.equal(isBowEvolutionReadyForStats(maxBow), true, 'max normal bow should be ready to evolve');
assert.equal(getRangeLevelUpPresentationForStats(maxBow).label, 'Bow Evolution');

const evolvedBow = stats(PLAYER_BASE.bowPower + LEVEL_UP_MAX_PIPS + BOW_EVOLUTION_POWER_BONUS, true);
assert.equal(getBowLevelUpProgress(evolvedBow), 0, 'evolved bow should reset pips');
assert.equal(isBowEvolutionReadyForStats(evolvedBow), false, 'evolved bow should not show pending evolution');
assert.equal(getRangeLevelUpPresentationForStats(evolvedBow).label, 'Evolved Bow');

const trainedEvolvedBow = stats(evolvedBow.bowPower + 1, true);
assert.equal(getBowLevelUpProgress(trainedEvolvedBow), 1, 'one evolved bow lesson should show one pip');
assert.equal(getRangeLevelUpPresentationForStats(trainedEvolvedBow).detail, '+1 master bow');

console.log('validated level-up progress states');
