import { describe, expect, it } from 'vitest';
import crossroads01Csv from '../../public/levels/authored/village-crossroads-01.csv?raw';
import { parseAuthoredMapCsv } from '../levels/authoredMap';
import {
  MARKER_OPTIONS,
  OBJECT_OPTIONS,
  TERRAIN_OPTIONS,
} from './palettes';
import {
  applyEditorChange,
  createEmptyEditorCells,
  encodeEditorCells,
  getEditorLayerFootprintCells,
  moveEditorLayer,
  parseEditorCsv,
  validateEditorCells,
} from './serialization';

describe('map editor serialization', () => {
  it('round-trips authored CSV cells through the editor encoder', () => {
    const cells = parseEditorCsv('roundtrip', crossroads01Csv);
    const reparsed = parseEditorCsv('roundtrip', encodeEditorCells(cells));
    expect(reparsed).toEqual(cells);
    expect(validateEditorCells('roundtrip', reparsed).valid).toBe(true);
  });

  it('keeps editor role palettes aligned with the authored map parser allowlists', () => {
    TERRAIN_OPTIONS.forEach((option) => {
      const rows = Array.from({ length: 29 }, () => Array.from({ length: 29 }, () => 'grass||').join(','));
      rows[0] = rows[0].replace('grass||', `${option.value}||`);
      const config = parseAuthoredMapCsv(`terrain-${option.value}`, rows.join('\n'));
      expect(config.authoredMap?.errors.some((error) => error.includes('unknown terrain'))).toBe(false);
    });

    OBJECT_OPTIONS.forEach((option) => {
      const rows = Array.from({ length: 29 }, () => Array.from({ length: 29 }, () => 'grass||').join(','));
      rows[0] = rows[0].replace('grass||', `grass|${option.value}|`);
      const config = parseAuthoredMapCsv(`object-${option.value}`, rows.join('\n'));
      expect(config.authoredMap?.errors.some((error) => error.includes('unknown object'))).toBe(false);
    });

    MARKER_OPTIONS.forEach((option) => {
      const rows = Array.from({ length: 29 }, () => Array.from({ length: 29 }, () => 'grass||').join(','));
      rows[0] = rows[0].replace('grass||', `grass||${option.value}`);
      const config = parseAuthoredMapCsv(`marker-${option.value}`, rows.join('\n'));
      expect(config.authoredMap?.errors.some((error) => error.includes('unknown marker'))).toBe(false);
    });
  });

  it('rejects duplicate single-instance building placement', () => {
    let cells = createEmptyEditorCells();
    const first = applyEditorChange(cells, { x: 8, y: 8 }, {
      tool: 'object',
      activeLayer: 'object',
      selection: { terrain: 'grass', object: 'castle', marker: 'player_spawn' },
    });
    expect(first.changed).toBe(true);
    cells = first.cells;
    const second = applyEditorChange(cells, { x: 12, y: 12 }, {
      tool: 'object',
      activeLayer: 'object',
      selection: { terrain: 'grass', object: 'castle', marker: 'player_spawn' },
    });
    expect(second.changed).toBe(false);
    expect(second.message).toContain('already exists');
  });

  it('replaces exclusive markers instead of duplicating them', () => {
    let cells = createEmptyEditorCells();
    cells = applyEditorChange(cells, { x: 8, y: 8 }, {
      tool: 'marker',
      activeLayer: 'marker',
      selection: { terrain: 'grass', object: 'castle', marker: 'player_spawn' },
    }).cells;
    cells = applyEditorChange(cells, { x: 12, y: 12 }, {
      tool: 'marker',
      activeLayer: 'marker',
      selection: { terrain: 'grass', object: 'castle', marker: 'player_spawn' },
    }).cells;
    const spawnCells = cells.flat().filter((cell) => cell.marker === 'player_spawn');
    expect(spawnCells).toHaveLength(1);
    expect(cells[12][12].marker).toBe('player_spawn');
  });

  it('rejects duplicate buildings during export validation', () => {
    const cells = parseEditorCsv('duplicate-export', crossroads01Csv);
    cells[8][8].object = 'castle';
    const result = validateEditorCells('duplicate-export', cells);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes('duplicate castle'))).toBe(true);
  });

  it('resolves editor footprints for buildings, props, and markers', () => {
    expect(getEditorLayerFootprintCells('object', 'castle', { x: 8, y: 8 })).toHaveLength(9);
    expect(getEditorLayerFootprintCells('object', 'cottage', { x: 8, y: 8 })).toHaveLength(6);
    expect(getEditorLayerFootprintCells('object', 'bakery', { x: 8, y: 8 })).toHaveLength(6);
    expect(getEditorLayerFootprintCells('object', 'market', { x: 8, y: 8 })).toHaveLength(6);
    expect(getEditorLayerFootprintCells('object', 'well', { x: 8, y: 8 })).toHaveLength(4);
    expect(getEditorLayerFootprintCells('object', 'tree_broadleaf', { x: 8, y: 8 })).toEqual([{ x: 8, y: 8 }]);
    expect(getEditorLayerFootprintCells('marker', 'player_spawn', { x: 8, y: 8 })).toEqual([{ x: 8, y: 8 }]);
  });

  it('moves an object by clearing its source and setting an empty target', () => {
    const cells = createEmptyEditorCells();
    cells[8][8].object = 'castle';
    const result = moveEditorLayer(cells, {
      layer: 'object',
      from: { x: 8, y: 8 },
      to: { x: 10, y: 10 },
    });
    expect(result.changed).toBe(true);
    expect(result.cells[8][8].object).toBeUndefined();
    expect(result.cells[10][10].object).toBe('castle');
  });

  it('moves a marker by clearing its source and setting an empty target', () => {
    const cells = createEmptyEditorCells();
    cells[8][8].marker = 'player_spawn';
    const result = moveEditorLayer(cells, {
      layer: 'marker',
      from: { x: 8, y: 8 },
      to: { x: 11, y: 11 },
    });
    expect(result.changed).toBe(true);
    expect(result.cells[8][8].marker).toBeUndefined();
    expect(result.cells[11][11].marker).toBe('player_spawn');
  });

  it('rejects moving onto an occupied object or marker target without mutating cells', () => {
    const objectCells = createEmptyEditorCells();
    objectCells[8][8].object = 'castle';
    objectCells[10][10].object = 'cottage';
    const objectMove = moveEditorLayer(objectCells, {
      layer: 'object',
      from: { x: 8, y: 8 },
      to: { x: 10, y: 10 },
    });
    expect(objectMove.changed).toBe(false);
    expect(objectMove.cells).toBe(objectCells);
    expect(objectCells[8][8].object).toBe('castle');
    expect(objectCells[10][10].object).toBe('cottage');

    const markerCells = createEmptyEditorCells();
    markerCells[8][8].marker = 'player_spawn';
    markerCells[10][10].marker = 'enemy_threshold_n';
    const markerMove = moveEditorLayer(markerCells, {
      layer: 'marker',
      from: { x: 8, y: 8 },
      to: { x: 10, y: 10 },
    });
    expect(markerMove.changed).toBe(false);
    expect(markerMove.cells).toBe(markerCells);
    expect(markerCells[8][8].marker).toBe('player_spawn');
    expect(markerCells[10][10].marker).toBe('enemy_threshold_n');
  });

  it('allows moving a unique building without creating duplicate validation errors', () => {
    const cells = createEmptyEditorCells();
    cells[8][8].object = 'castle';
    const result = moveEditorLayer(cells, {
      layer: 'object',
      from: { x: 8, y: 8 },
      to: { x: 10, y: 10 },
    });
    const validation = validateEditorCells('moved-unique-building', result.cells);
    expect(result.changed).toBe(true);
    expect(validation.errors.some((error) => error.includes('duplicate castle'))).toBe(false);
  });

  it('rejects moving a building when its target footprint overlaps another object footprint', () => {
    const cells = createEmptyEditorCells();
    cells[8][8].object = 'castle';
    cells[12][10].object = 'cottage';
    const result = moveEditorLayer(cells, {
      layer: 'object',
      from: { x: 8, y: 8 },
      to: { x: 10, y: 10 },
    });
    expect(result.changed).toBe(false);
    expect(result.message).toContain('overlaps another object');
    expect(cells[8][8].object).toBe('castle');
    expect(cells[10][10].object).toBeUndefined();
  });

  it('rejects moving a building when its target footprint would leave the map', () => {
    const cells = createEmptyEditorCells();
    cells[8][8].object = 'castle';
    const result = moveEditorLayer(cells, {
      layer: 'object',
      from: { x: 8, y: 8 },
      to: { x: 0, y: 0 },
    });
    expect(result.changed).toBe(false);
    expect(result.message).toContain('would leave the map');
    expect(cells[8][8].object).toBe('castle');
    expect(cells[0][0].object).toBeUndefined();
  });

  it('rejects duplicate single-instance gate placement', () => {
    let cells = createEmptyEditorCells();
    cells = applyEditorChange(cells, { x: 3, y: 14 }, {
      tool: 'object',
      activeLayer: 'object',
      selection: { terrain: 'grass', object: 'gate_w', marker: 'player_spawn' },
    }).cells;
    const duplicateGate = applyEditorChange(cells, { x: 4, y: 14 }, {
      tool: 'object',
      activeLayer: 'object',
      selection: { terrain: 'grass', object: 'gate_w', marker: 'player_spawn' },
    });
    expect(duplicateGate.changed).toBe(false);
    expect(duplicateGate.message).toContain('already exists');
  });
});
