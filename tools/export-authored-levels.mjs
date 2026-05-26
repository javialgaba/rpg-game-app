import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'levels', 'authored');
const SIZE = 29;
const PLAYABLE_MIN = 3;
const PLAYABLE_MAX = 25;
const CENTER = 14;
const LOW_SCENERY_ROLES = ['flowers', 'grass_tuft', 'magic_patch'];
const BUILDING_ROLES = new Set(['castle', 'cottage', 'bakery', 'market', 'well']);
const PLAIN_GRASS_KEEP_MODULUS = 6;

const makeCell = (terrain = 'grass', object = '', marker = '') => ({ terrain, object, marker });
const makeMap = () => Array.from({ length: SIZE }, (_, y) => (
  Array.from({ length: SIZE }, (_, x) => {
    const outside = x < PLAYABLE_MIN || y < PLAYABLE_MIN || x > PLAYABLE_MAX || y > PLAYABLE_MAX;
    const gateSightline = (x >= CENTER - 2 && x <= CENTER + 2) || (y >= CENTER - 2 && y <= CENTER + 2);
    return makeCell(
      outside ? 'forest_floor' : 'grass',
      outside && !gateSightline ? ((x + y) % 3 === 0 ? 'tree_broadleaf' : 'tree_conifer') : '',
    );
  })
));

const paint = (map, terrain, x, y) => {
  map[y][x].terrain = terrain;
};

const paintRect = (map, terrain, x0, y0, x1, y1) => {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      paint(map, terrain, x, y);
    }
  }
};

const paintRoad = (map, from, to) => {
  for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x += 1) {
    paint(map, 'stone_road', x, from.y);
  }
  for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y += 1) {
    paint(map, 'stone_road', to.x, y);
  }
};

const addObject = (map, object, x, y) => {
  map[y][x].object = object;
};

const addMarker = (map, marker, x, y) => {
  map[y][x].marker = marker;
};

const addGateNetwork = (map) => {
  paintRect(map, 'gate_road', CENTER - 1, 0, CENTER + 1, SIZE - 1);
  paintRect(map, 'gate_road', 0, CENTER - 1, SIZE - 1, CENTER + 1);
  [
    ['gate_n', 'enemy_threshold_n', CENTER, PLAYABLE_MIN],
    ['gate_e', 'enemy_threshold_e', PLAYABLE_MAX, CENTER],
    ['gate_s', 'enemy_threshold_s', CENTER, PLAYABLE_MAX],
    ['gate_w', 'enemy_threshold_w', PLAYABLE_MIN, CENTER],
  ].forEach(([object, marker, x, y]) => {
    addObject(map, object, x, y);
    addMarker(map, marker, x, y);
  });
  paintRect(map, 'plaza', 11, 11, 17, 17);
  paintRect(map, 'gate_road', CENTER - 1, 11, CENTER + 1, 17);
  paintRect(map, 'gate_road', 11, CENTER - 1, 17, CENTER + 1);
  addMarker(map, 'player_spawn', CENTER, CENTER);
};

const fillGarden = (map, points) => {
  points.forEach(([role, x, y]) => addObject(map, role, x, y));
  [
    [7, 7], [21, 7], [7, 21], [21, 21], [8, 17], [20, 11],
  ].forEach(([x, y]) => {
    if (!map[y][x].object) {
      map[y][x].terrain = 'flower_grass';
    }
  });
};

const isGateSightlineCell = (x, y) => (
  (x <= 8 && y >= CENTER - 3 && y <= CENTER + 3)
  || (x >= SIZE - 9 && y >= CENTER - 3 && y <= CENTER + 3)
  || (y <= 8 && x >= CENTER - 3 && x <= CENTER + 3)
  || (y >= SIZE - 9 && x >= CENTER - 3 && x <= CENTER + 3)
);

const isNearBuilding = (map, x, y) => map.some((row, rowIndex) => row.some((cell, columnIndex) => (
  BUILDING_ROLES.has(cell.object)
  && Math.max(Math.abs(columnIndex - x), Math.abs(rowIndex - y)) <= 2
)));

const isGateRoadOrMarker = (cell) => cell.terrain === 'gate_road' || cell.marker;

const shouldKeepPlainGrass = (x, y, variation) => (
  (x * 5 + y * 3 + variation) % PLAIN_GRASS_KEEP_MODULUS === 0
);

const dressVillageGreen = (map, variation) => {
  for (let y = PLAYABLE_MIN; y <= PLAYABLE_MAX; y += 1) {
    for (let x = PLAYABLE_MIN; x <= PLAYABLE_MAX; x += 1) {
      const cell = map[y][x];
      if (cell.terrain !== 'grass' || cell.object || isGateRoadOrMarker(cell)) {
        continue;
      }
      const pattern = (x * 7 + y * 11 + variation) % 17;
      if (!shouldKeepPlainGrass(x, y, variation) || pattern % 4 === 0 || pattern === 7) {
        cell.terrain = 'flower_grass';
      }
      if (
        !isGateSightlineCell(x, y)
        && !isNearBuilding(map, x, y)
        && (pattern === 1 || pattern === 9 || pattern === 14 || pattern === 16)
      ) {
        cell.object = LOW_SCENERY_ROLES[(x + y + variation) % LOW_SCENERY_ROLES.length];
      }
    }
  }
};

const createCrossroadsOne = () => {
  const map = makeMap();
  addGateNetwork(map);
  paintRoad(map, { x: 12, y: 10 }, { x: CENTER, y: 10 });
  paintRoad(map, { x: 17, y: 9 }, { x: CENTER, y: 9 });
  paintRoad(map, { x: 17, y: 19 }, { x: CENTER, y: 19 });
  paintRoad(map, { x: 9, y: 18 }, { x: CENTER, y: 18 });
  addObject(map, 'castle', 10, 10);
  addObject(map, 'cottage', 19, 9);
  addObject(map, 'market', 19, 19);
  addObject(map, 'well', 9, 19);
  fillGarden(map, [
    ['tree_broadleaf', 5, 5], ['tree_conifer', 23, 5],
    ['tree_broadleaf', 5, 23], ['tree_conifer', 23, 23],
    ['rock_large', 8, 6], ['pond', 21, 20],
    ['bush', 8, 20], ['lamp', 17, 12],
  ]);
  dressVillageGreen(map, 2);
  return map;
};

const createCrossroadsTwo = () => {
  const map = makeMap();
  addGateNetwork(map);
  paintRoad(map, { x: 17, y: 18 }, { x: CENTER, y: 18 });
  paintRoad(map, { x: 10, y: 9 }, { x: CENTER, y: 9 });
  paintRoad(map, { x: 18, y: 9 }, { x: CENTER, y: 9 });
  paintRoad(map, { x: 10, y: 19 }, { x: CENTER, y: 19 });
  addObject(map, 'castle', 19, 19);
  addObject(map, 'cottage', 9, 9);
  addObject(map, 'bakery', 19, 9);
  addObject(map, 'well', 9, 19);
  fillGarden(map, [
    ['tree_conifer', 5, 6], ['tree_broadleaf', 22, 6],
    ['tree_conifer', 6, 22], ['tree_broadleaf', 22, 22],
    ['rock_large', 20, 6], ['pond', 7, 20],
    ['bush', 20, 20], ['sign', 11, 12],
  ]);
  dressVillageGreen(map, 9);
  return map;
};

const encode = (map) => map.map((row) => (
  row.map((cell) => `${cell.terrain}|${cell.object}|${cell.marker}`).join(',')
)).join('\n') + '\n';

await fs.mkdir(OUTPUT_DIR, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(OUTPUT_DIR, 'village-crossroads-01.csv'), encode(createCrossroadsOne())),
  fs.writeFile(path.join(OUTPUT_DIR, 'village-crossroads-02.csv'), encode(createCrossroadsTwo())),
]);
console.log('exported authored village-crossroads-01.csv and village-crossroads-02.csv');
