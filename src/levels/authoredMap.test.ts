import { describe, expect, it } from 'vitest';
import crossroads01Csv from '../../public/levels/authored/village-crossroads-01.csv?raw';
import crossroads02Csv from '../../public/levels/authored/village-crossroads-02.csv?raw';
import { ASSET_REGISTRY } from './assetRegistry';
import { parseAuthoredMapCsv } from './authoredMap';
import { generateLevel, validateGeneratedLevel } from './generateLevel';
import { resolveLevelConfigFromParams } from './levelCatalog';

const authoredMaps = {
  'village-crossroads-01': crossroads01Csv,
  'village-crossroads-02': crossroads02Csv,
};

const readMap = (name: keyof typeof authoredMaps) => authoredMaps[name];
const pointKey = (point: { x: number; y: number }) => `${point.x},${point.y}`;
const expectedGateThresholds = {
  north: { x: 14, y: 3, object: 'gate_n', marker: 'enemy_threshold_n' },
  east: { x: 25, y: 14, object: 'gate_e', marker: 'enemy_threshold_e' },
  south: { x: 14, y: 25, object: 'gate_s', marker: 'enemy_threshold_s' },
  west: { x: 3, y: 14, object: 'gate_w', marker: 'enemy_threshold_w' },
} as const;

const findAuthoredObject = (
  config: ReturnType<typeof parseAuthoredMapCsv>,
  object: string,
) => {
  for (let y = 0; y < (config.authoredMap?.cells.length ?? 0); y += 1) {
    const row = config.authoredMap?.cells[y] ?? [];
    for (let x = 0; x < row.length; x += 1) {
      if (row[x].object === object) {
        return { x, y };
      }
    }
  }
  return null;
};

describe('authored CSV maps', () => {
  it('parses layered cell roles and preserves matching gate objects', () => {
    const config = parseAuthoredMapCsv('village-crossroads-01', readMap('village-crossroads-01'));
    expect(config.authoredMap?.cells).toHaveLength(29);
    expect(config.authoredMap?.cells[3][14]).toEqual({
      terrain: 'gate_road',
      object: 'gate_n',
      marker: 'enemy_threshold_n',
    });
    expect(config.gates?.map((gate) => gate.direction)).toEqual(['north', 'east', 'south', 'west']);
    config.gates?.forEach((gate) => {
      const expected = expectedGateThresholds[gate.direction];
      expect(gate.threshold).toEqual({ x: expected.x, y: expected.y });
      expect(config.authoredMap?.cells[expected.y][expected.x]).toEqual({
        terrain: 'gate_road',
        object: expected.object,
        marker: expected.marker,
      });
      expect(gate.clearCells).toHaveLength(15);
      expect(gate.roadCells).toHaveLength(8);
      expect(gate.sightlineCells.length).toBeGreaterThan(gate.roadCells.length);
    });
    expect(config.authoredMap?.errors).toEqual([]);
  });

  it('keeps authored crossroads maps centered on castles with slim gate lanes', () => {
    (['village-crossroads-01', 'village-crossroads-02'] as const).forEach((id) => {
      const config = parseAuthoredMapCsv(id, readMap(id));
      const cells = config.authoredMap?.cells;
      expect(findAuthoredObject(config, 'castle')).toEqual({ x: 14, y: 14 });
      expect(cells?.[17][14]).toEqual({
        terrain: 'stone_road',
        marker: 'player_spawn',
        object: undefined,
      });

      const roadTerrain = new Set(['gate_road', 'stone_road']);
      [
        ...Array.from({ length: 10 }, (_, index) => ({ x: 14, y: 3 + index })),
        ...Array.from({ length: 10 }, (_, index) => ({ x: 16 + index, y: 14 })),
        ...Array.from({ length: 10 }, (_, index) => ({ x: 14, y: 16 + index })),
        ...Array.from({ length: 10 }, (_, index) => ({ x: 3 + index, y: 14 })),
      ].forEach((cell) => {
        expect(roadTerrain.has(cells?.[cell.y][cell.x].terrain ?? '')).toBe(true);
      });

      const gateRoadCells = cells?.flatMap((row, y) => row.flatMap((cell, x) => (
        cell.terrain === 'gate_road' ? [{ x, y }] : []
      ))) ?? [];
      expect(gateRoadCells).toHaveLength(32);
      [
        { x: 13, y: 3 }, { x: 15, y: 3 },
        { x: 13, y: 7 }, { x: 15, y: 7 },
        { x: 3, y: 13 }, { x: 3, y: 15 },
        { x: 25, y: 13 }, { x: 25, y: 15 },
        { x: 13, y: 25 }, { x: 15, y: 25 },
      ].forEach((cell) => {
        expect(roadTerrain.has(cells?.[cell.y][cell.x].terrain ?? '')).toBe(false);
      });
    });
  });

  it('places player spawns off the centered castle attack cells', () => {
    (['village-crossroads-01', 'village-crossroads-02'] as const).forEach((id) => {
      const level = generateLevel(
        parseAuthoredMapCsv(id, readMap(id)),
        ASSET_REGISTRY,
      );
      const validation = validateGeneratedLevel(level);
      const castle = level.protectedTargets.find((target) => target.token === 'castle');
      expect(validation.errors).toEqual([]);
      expect(level.playerSpawn).toEqual({ x: 14, y: 17 });
      expect(castle?.grid).toEqual({ x: 14, y: 14 });
      expect(castle?.attackCells.map(pointKey)).not.toContain(pointKey(level.playerSpawn!));
    });
  });

  it('materializes each editable starter map into a valid village', () => {
    (['village-crossroads-01', 'village-crossroads-02'] as const).forEach((id) => {
      const level = generateLevel(parseAuthoredMapCsv(id, readMap(id)), ASSET_REGISTRY);
      expect(validateGeneratedLevel(level).errors).toEqual([]);
      expect(level.config.authoredMap?.id).toBe(id);
      expect(level.decorations.some((decoration) => decoration.authoredObjectRole === 'rock_large')).toBe(true);
      expect(level.decorations.some((decoration) => decoration.authoredObjectRole === 'pond')).toBe(true);
      expect(level.decorations.some((decoration) => (
        decoration.authoredObjectRole === 'flowers'
        || decoration.authoredObjectRole === 'grass_tuft'
        || decoration.authoredObjectRole === 'magic_patch'
      ))).toBe(true);
      const terrainCells = new Set(level.terrain.map((placement) => pointKey(placement.grid)));
      level.protectedTargets.forEach((target) => {
        target.cells.forEach((cell) => expect(terrainCells.has(pointKey(cell))).toBe(true));
      });
    });
  });

  it('defaults blank authored terrain layers to rendered grass flooring', () => {
    const config = parseAuthoredMapCsv('blank-floor', readMap('village-crossroads-01').replace(',grass||,', ',||,'));
    const level = generateLevel(config, ASSET_REGISTRY);
    expect(config.authoredMap?.errors).toEqual([]);
    expect(config.authoredMap?.cells.flat().some((cell) => cell.terrain === 'grass')).toBe(true);
    expect(level.terrain.length + level.scenicTerrain.length).toBe(29 * 29);
  });

  it('selects an explicit or resume-stable authored map before random selection', () => {
    const explicit = resolveLevelConfigFromParams(new URLSearchParams('?map=village-crossroads-02'), null, () => 0);
    expect(explicit.id).toBe('village-crossroads-02');
    const resumed = resolveLevelConfigFromParams(new URLSearchParams(), 'village-crossroads-02', () => 0);
    expect(resumed.id).toBe('village-crossroads-02');
    const randomSecond = resolveLevelConfigFromParams(new URLSearchParams(), null, () => 0.99);
    expect(randomSecond.id).toBe('village-crossroads-02');
  });

  it('reports malformed and unknown authored cell roles with coordinates', () => {
    const rows = Array.from({ length: 29 }, () => Array.from({ length: 29 }, () => 'grass||').join(','));
    rows[4] = rows[4].replace('grass||', 'lava|tree_mystery|unknown_marker');
    const config = parseAuthoredMapCsv('invalid-map', rows.join('\n'));
    expect(config.authoredMap?.errors.some((error) => error.includes('cell 0,4') && error.includes('unknown terrain'))).toBe(true);
    expect(config.authoredMap?.errors.some((error) => error.includes('unknown object'))).toBe(true);
    expect(config.authoredMap?.errors.some((error) => error.includes('unknown marker'))).toBe(true);
  });

  it('rejects visually incorrect gate road tiles and missing player spawns', () => {
    const csv = readMap('village-crossroads-01')
      .replace('gate_road|gate_n|enemy_threshold_n', 'grass|gate_n|enemy_threshold_n')
      .replace('stone_road||player_spawn', 'stone_road||');
    const config = parseAuthoredMapCsv('broken-entrance', csv);
    expect(config.authoredMap?.errors.some((error) => (
      error.includes('north entrance centerline cell 14,3') && error.includes('gate_road')
    ))).toBe(true);
    expect(config.authoredMap?.errors.some((error) => error.includes('missing its player_spawn'))).toBe(true);
  });

  it('rejects broad undressed grass clearings in authored village space', () => {
    const csv = readMap('village-crossroads-01')
      .replaceAll('flower_grass||', 'grass||')
      .replaceAll('flower_grass|flowers|', 'grass||')
      .replaceAll('flower_grass|grass_tuft|', 'grass||')
      .replaceAll('flower_grass|magic_patch|', 'grass||')
      .replaceAll('grass|flowers|', 'grass||')
      .replaceAll('grass|grass_tuft|', 'grass||')
      .replaceAll('grass|magic_patch|', 'grass||');
    const config = parseAuthoredMapCsv('undressed-village', csv);
    expect(config.authoredMap?.errors.some((error) => (
      error.includes('undressed 5x5 grass clearing') || error.includes('undressed plain grass region')
    ))).toBe(true);
  });

  it('rejects duplicate player spawn markers', () => {
    const csv = readMap('village-crossroads-02').replace('grass||', 'grass||player_spawn');
    const config = parseAuthoredMapCsv('duplicate-spawn', csv);
    expect(config.authoredMap?.errors.some((error) => (
      error.includes('2 player_spawn markers')
    ))).toBe(true);
  });
});
