import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(os.tmpdir(), `rpg-level-generation-tests-${process.pid}`);
const srcRoot = path.join(repoRoot, 'src');
const levelSrcRoot = path.join(srcRoot, 'levels');
const generatedLevelSrcRoot = path.join(outRoot, 'src', 'levels');

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

const compileLevelModules = async () => {
  await fs.rm(outRoot, { force: true, recursive: true });
  await fs.mkdir(generatedLevelSrcRoot, { recursive: true });
  await fs.writeFile(path.join(outRoot, 'package.json'), '{"type":"commonjs"}\n');

  await Promise.all([
    compileFile('src/gameConfig.ts'),
    compileFile('src/sceneVariants.ts'),
    ...(await fs.readdir(levelSrcRoot))
      .filter((fileName) => fileName.endsWith('.ts'))
      .map((fileName) => compileFile(path.join('src', 'levels', fileName))),
  ]);
};

const makeMatrix = () => (
  Array.from({ length: 19 }, (_, y) => (
    Array.from({ length: 19 }, (_, x) => {
      if (x === 2 && y === 2) {
        return 'monster-spawn';
      }
      if (x === 16 && y === 2) {
        return 'monster-spawn';
      }
      if (x === 16 && y === 16) {
        return 'monster-spawn';
      }
      if (x === 2 && y === 16) {
        return 'monster-spawn';
      }
      return 'grass';
    })
  ))
);

const makeBaseConfig = (matrix) => ({
  seed: 'level-generation-test',
  timeOfDay: 'morning',
  tileSize: 60,
  decorationDensity: 0,
  difficulty: 1,
  playableBounds: { minX: 2, minY: 2, maxX: 16, maxY: 16 },
  matrix,
});

const setCell = (matrix, token, x, y) => {
  matrix[y][x] = token;
};

const pointKey = (point) => `${point.x},${point.y}`;

const getCardinalNeighbors = (point) => [
  { x: point.x + 1, y: point.y },
  { x: point.x - 1, y: point.y },
  { x: point.x, y: point.y + 1 },
  { x: point.x, y: point.y - 1 },
];

const collectReachableRoads = (level) => {
  if (!level.playerSpawn) {
    return new Set();
  }
  const queue = [level.playerSpawn];
  const visited = new Set([pointKey(level.playerSpawn)]);
  while (queue.length > 0) {
    const current = queue.shift();
    getCardinalNeighbors(current).forEach((neighbor) => {
      if (!level.roadGrid[neighbor.y]?.[neighbor.x]) {
        return;
      }
      const key = pointKey(neighbor);
      if (visited.has(key)) {
        return;
      }
      visited.add(key);
      queue.push(neighbor);
    });
  }
  return visited;
};

await compileLevelModules();

const require = createRequire(path.join(outRoot, 'index.cjs'));
const { ASSET_REGISTRY } = require(path.join(outRoot, 'src', 'levels', 'assetRegistry.js'));
const { DEFAULT_VILLAGE_LEVEL } = require(path.join(outRoot, 'src', 'levels', 'defaultVillageLevel.js'));
const { generateLevel, validateGeneratedLevel } = require(path.join(outRoot, 'src', 'levels', 'generateLevel.js'));
const { buildSeasonBoardConfig } = require(path.join(outRoot, 'src', 'levels', 'buildSeasonBoard.js'));
const { parseAuthoredMapCsv } = require(path.join(outRoot, 'src', 'levels', 'authoredMap.js'));
const { SCENE_VARIANTS } = require(path.join(outRoot, 'src', 'sceneVariants.js'));

{
  const matrix = makeMatrix();
  setCell(matrix, 'player-spawn', 9, 13);
  setCell(matrix, 'castle', 8, 8);
  setCell(matrix, 'house-1', 11, 8);
  const level = generateLevel(makeBaseConfig(matrix), ASSET_REGISTRY);
  const validation = validateGeneratedLevel(level);
  assert(
    validation.errors.some((error) => error.includes('must keep 2 clear cells')),
    'crowded buildings should fail validation',
  );
}

for (const authoredMapId of ['village-crossroads-01', 'village-crossroads-02']) {
  const csv = await fs.readFile(
    path.join(repoRoot, 'public', 'levels', 'authored', `${authoredMapId}.csv`),
    'utf8',
  );
  const config = parseAuthoredMapCsv(authoredMapId, csv);
  assert.deepEqual(config.authoredMap.errors, [], `${authoredMapId} should satisfy its authored CSV contract`);
  const level = generateLevel(config, ASSET_REGISTRY);
  const validation = validateGeneratedLevel(level);
  assert.deepEqual(validation.errors, [], `${authoredMapId} should materialize into a valid runtime village`);
  assert.equal(level.gates.length, 4, `${authoredMapId} should provide four authored gates`);
  level.gates.forEach((gate) => {
    assert.equal(gate.clearCells.length, 15, `${authoredMapId} ${gate.id} should reserve a visible entrance corridor`);
  });
}

const blockingDecorationKinds = new Set(['rocks', 'sapling', 'fullTree', 'treeCluster', 'puddle']);
const seenBlockingKinds = new Set();

Object.keys(SCENE_VARIANTS).forEach((worldKey) => {
  for (let worldCycle = 0; worldCycle < 18; worldCycle += 1) {
    const boardConfig = buildSeasonBoardConfig(
      { ...DEFAULT_VILLAGE_LEVEL, decorationDensity: 1 },
      worldKey,
      worldCycle,
    );
    const level = generateLevel(boardConfig, ASSET_REGISTRY);
    const validation = validateGeneratedLevel(level);
    assert.deepEqual(validation.errors, [], `${worldKey} cycle ${worldCycle} should validate`);

    const reachableRoads = collectReachableRoads(level);
    const roadTargetKeys = new Set(
      level.protectedTargets.flatMap((target) => (
        target.attackCells
          .filter((cell) => level.roadGrid[cell.y]?.[cell.x])
          .map(pointKey)
      )),
    );
    assert(
      [...roadTargetKeys].some((key) => reachableRoads.has(key)),
      `${worldKey} cycle ${worldCycle} should have roads that guide to a building`,
    );

    level.roadGrid.forEach((row, y) => {
      row.forEach((isRoad, x) => {
        const insidePlayable = x >= level.playableBounds.minX
          && x <= level.playableBounds.maxX
          && y >= level.playableBounds.minY
          && y <= level.playableBounds.maxY;
        if (!insidePlayable) {
          assert(level.scenicTerrain.some((placement) => (
            placement.grid.x === x && placement.grid.y === y
          )), `scenic terrain should cover out-of-bounds cell at ${x},${y}`);
          return;
        }
        if (!isRoad) {
          assert.notEqual(level.config.matrix[y][x], 'path', `orphan path at ${x},${y}`);
          assert.notEqual(level.config.matrix[y][x], 'village-center', `orphan village-center at ${x},${y}`);
          return;
        }
        assert(reachableRoads.has(pointKey({ x, y })), `road at ${x},${y} should connect to player spawn`);
      });
    });

    assert.equal(level.width, 29, `${worldKey} cycle ${worldCycle} should use the expanded village width`);
    assert.equal(level.height, 29, `${worldKey} cycle ${worldCycle} should use the expanded village height`);
    assert.deepEqual(level.playableBounds, { minX: 3, minY: 3, maxX: 25, maxY: 25 }, `${worldKey} cycle ${worldCycle} should use the expanded playable bounds`);
    assert.equal(level.scenicTerrain.length, (29 * 29) - (23 * 23), `${worldKey} cycle ${worldCycle} should render its scenic boundary`);
    assert.equal(level.gates.length, 4, `${worldKey} cycle ${worldCycle} should generate four real gates`);
    assert.equal(
      level.scenicTerrain.filter((placement) => placement.token === 'path').length,
      36,
      `${worldKey} cycle ${worldCycle} should render four three-wide exterior gate approaches`,
    );
    level.gates.forEach((gate) => {
      assert.equal(gate.clearCells.length, 15, `${gate.id} should reserve its entire entrance corridor`);
      assert(gate.roadCells.length > gate.clearCells.length, `${gate.id} should extend an open avenue into the village`);
      assert(gate.sightlineCells.length > gate.roadCells.length, `${gate.id} should reserve a wider visual sightline`);
      assert.equal(
        [...level.scenicObjects, ...level.decorations].some((placement) => (
          placement.cells.some((cell) => gate.sightlineCells.some((reserved) => reserved.x === cell.x && reserved.y === cell.y))
        )),
        false,
        `${gate.id} sightline should remain clear of props and decoration`,
      );
    });

    level.decorations.forEach((decoration) => {
      if (!blockingDecorationKinds.has(decoration.decorationKind)) {
        return;
      }
      seenBlockingKinds.add(decoration.decorationKind);
      assert.equal(decoration.cells.length, 1, `${decoration.decorationKind} should occupy one cell`);
      assert.equal(decoration.blocksMovement, true, `${decoration.decorationKind} should block movement`);
      assert.equal(level.blockedGrid[decoration.grid.y]?.[decoration.grid.x], true, `${decoration.decorationKind} should block its anchor`);
      assert.equal(level.walkableGrid[decoration.grid.y]?.[decoration.grid.x], false, `${decoration.decorationKind} should make its anchor unwalkable`);
    });
  }
});

blockingDecorationKinds.forEach((kind) => {
  assert(seenBlockingKinds.has(kind), `expected generated ${kind} decoration coverage`);
});

console.log('validated generated and authored level constraints');
