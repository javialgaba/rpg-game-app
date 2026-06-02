import { ASSET_REGISTRY } from '../levels/assetRegistry';
import { AUTHORED_MAP_SIZE, parseAuthoredMapCsv } from '../levels/authoredMap';
import { generateLevel, validateGeneratedLevel } from '../levels/generateLevel';
import type {
  AuthoredMapCell,
  AuthoredMarkerRole,
  AuthoredObjectRole,
  AuthoredTerrainRole,
  GridPoint,
} from '../levels/levelTypes';
import { UNIQUE_BUILDING_OBJECT_ROLES, UNIQUE_OBJECT_ROLES, getObjectLabel } from './palettes';

export type EditorLayer = 'terrain' | 'object' | 'marker';
export type EditorTool = EditorLayer | 'erase' | 'edit';
export type MovableEditorLayer = Extract<EditorLayer, 'object' | 'marker'>;

export interface EditorSelection {
  terrain: AuthoredTerrainRole;
  object: AuthoredObjectRole;
  marker: AuthoredMarkerRole;
}

export interface EditorChange {
  tool: EditorTool;
  activeLayer: EditorLayer;
  selection: EditorSelection;
}

export interface EditorChangeResult {
  cells: AuthoredMapCell[][];
  changed: boolean;
  message: string;
}

export interface EditorMove {
  layer: MovableEditorLayer;
  from: GridPoint;
  to: GridPoint;
}

export interface EditorValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const EMPTY_CELL: AuthoredMapCell = { terrain: 'grass' };
const DEFAULT_FOOTPRINT = { w: 1, h: 1 };
const OBJECT_FOOTPRINTS: Partial<Record<AuthoredObjectRole, { w: number; h: number }>> = {
  castle: { w: 3, h: 3 },
  cottage: { w: 3, h: 2 },
  bakery: { w: 3, h: 2 },
  market: { w: 3, h: 2 },
  well: { w: 2, h: 2 },
};

const pointKey = (point: GridPoint) => `${point.x},${point.y}`;

const isInsideMap = (point: GridPoint) => (
  point.x >= 0 && point.y >= 0 && point.x < AUTHORED_MAP_SIZE && point.y < AUTHORED_MAP_SIZE
);

const getAnchorFootprintCells = (anchor: GridPoint, footprint: { w: number; h: number }) => {
  const offsetX = Math.floor(footprint.w / 2);
  const offsetY = Math.floor(footprint.h / 2);
  return Array.from({ length: footprint.h }, (_, row) => (
    Array.from({ length: footprint.w }, (__, col) => ({
      x: anchor.x - offsetX + col,
      y: anchor.y - offsetY + row,
    }))
  )).flat();
};

export const getEditorObjectFootprintCells = (
  object: AuthoredObjectRole,
  anchor: GridPoint,
) => getAnchorFootprintCells(anchor, OBJECT_FOOTPRINTS[object] ?? DEFAULT_FOOTPRINT);

export const getEditorLayerFootprintCells = (
  layer: MovableEditorLayer,
  value: AuthoredObjectRole | AuthoredMarkerRole,
  anchor: GridPoint,
) => (
  layer === 'object'
    ? getEditorObjectFootprintCells(value as AuthoredObjectRole, anchor)
    : [{ ...anchor }]
);

export const cloneEditorCells = (cells: AuthoredMapCell[][]): AuthoredMapCell[][] => (
  cells.map((row) => row.map((cell) => ({ ...cell })))
);

export const createEmptyEditorCells = (): AuthoredMapCell[][] => (
  Array.from({ length: AUTHORED_MAP_SIZE }, (_, y) => (
    Array.from({ length: AUTHORED_MAP_SIZE }, (__, x) => {
      const outside = x < 3 || y < 3 || x > 25 || y > 25;
      return outside ? { terrain: 'forest_floor' as const } : { ...EMPTY_CELL };
    })
  ))
);

export const encodeEditorCells = (cells: AuthoredMapCell[][]) => (
  cells.map((row) => (
    row.map((cell) => `${cell.terrain || 'grass'}|${cell.object ?? ''}|${cell.marker ?? ''}`).join(',')
  )).join('\n') + '\n'
);

export const parseEditorCsv = (id: string, csv: string): AuthoredMapCell[][] => {
  const config = parseAuthoredMapCsv(id, csv);
  return config.authoredMap?.cells ? cloneEditorCells(config.authoredMap.cells) : createEmptyEditorCells();
};

const hasRoleAtOtherCell = (
  cells: AuthoredMapCell[][],
  role: AuthoredObjectRole,
  point: GridPoint,
) => cells.some((row, y) => row.some((cell, x) => (
  cell.object === role && (x !== point.x || y !== point.y)
)));

export const getUsedObjectRoles = (cells: AuthoredMapCell[][]) => new Set(
  cells.flatMap((row) => row.map((cell) => cell.object).filter(Boolean) as AuthoredObjectRole[]),
);

export const getDuplicateBuildingErrors = (cells: AuthoredMapCell[][]) => {
  const first = new Map<AuthoredObjectRole, GridPoint>();
  const errors: string[] = [];
  cells.forEach((row, y) => row.forEach((cell, x) => {
    if (!cell.object || !UNIQUE_BUILDING_OBJECT_ROLES.has(cell.object)) {
      return;
    }
    const existing = first.get(cell.object);
    if (existing) {
      errors.push(`Duplicate ${getObjectLabel(cell.object)} buildings at ${existing.x},${existing.y} and ${x},${y}.`);
      return;
    }
    first.set(cell.object, { x, y });
  }));
  return errors;
};

const clearMatchingMarker = (
  cells: AuthoredMapCell[][],
  marker: AuthoredMarkerRole,
  point: GridPoint,
) => {
  cells.forEach((row, y) => row.forEach((cell, x) => {
    if (cell.marker === marker && (x !== point.x || y !== point.y)) {
      cell.marker = undefined;
    }
  }));
};

const getOccupiedObjectFootprintKeys = (
  cells: AuthoredMapCell[][],
  ignoredAnchor: GridPoint,
) => {
  const keys = new Set<string>();
  cells.forEach((row, y) => row.forEach((cell, x) => {
    if (!cell.object || (x === ignoredAnchor.x && y === ignoredAnchor.y)) {
      return;
    }
    getEditorObjectFootprintCells(cell.object, { x, y }).forEach((footprintCell) => {
      keys.add(pointKey(footprintCell));
    });
  }));
  return keys;
};

export const applyEditorChange = (
  currentCells: AuthoredMapCell[][],
  point: GridPoint,
  change: EditorChange,
): EditorChangeResult => {
  const cells = cloneEditorCells(currentCells);
  const cell = cells[point.y]?.[point.x];
  if (!cell) {
    return { cells: currentCells, changed: false, message: 'Cell is outside the map.' };
  }

  if (change.tool === 'erase') {
    if (change.activeLayer === 'terrain') {
      cell.terrain = 'grass';
    } else if (change.activeLayer === 'object') {
      cell.object = undefined;
    } else {
      cell.marker = undefined;
    }
    return { cells, changed: true, message: `Erased ${change.activeLayer} at ${point.x},${point.y}.` };
  }

  if (change.tool === 'terrain') {
    cell.terrain = change.selection.terrain;
    return { cells, changed: true, message: `Painted ${change.selection.terrain} at ${point.x},${point.y}.` };
  }

  if (change.tool === 'object') {
    const object = change.selection.object;
    if (UNIQUE_OBJECT_ROLES.has(object) && hasRoleAtOtherCell(cells, object, point)) {
      return {
        cells: currentCells,
        changed: false,
        message: `${getObjectLabel(object)} already exists. Erase it before placing another.`,
      };
    }
    cell.object = object;
    return { cells, changed: true, message: `Placed ${getObjectLabel(object)} at ${point.x},${point.y}.` };
  }

  const marker = change.selection.marker;
  clearMatchingMarker(cells, marker, point);
  cell.marker = marker;
  return { cells, changed: true, message: `Placed ${marker} at ${point.x},${point.y}.` };
};

export const moveEditorLayer = (
  currentCells: AuthoredMapCell[][],
  move: EditorMove,
): EditorChangeResult => {
  const sourceCell = currentCells[move.from.y]?.[move.from.x];
  const targetCell = currentCells[move.to.y]?.[move.to.x];
  if (!sourceCell || !targetCell) {
    return { cells: currentCells, changed: false, message: 'Move target is outside the map.' };
  }
  if (move.from.x === move.to.x && move.from.y === move.to.y) {
    return { cells: currentCells, changed: false, message: 'Dropped on the original cell.' };
  }

  const value = sourceCell[move.layer];
  if (!value) {
    return { cells: currentCells, changed: false, message: `No ${move.layer} exists at ${move.from.x},${move.from.y}.` };
  }

  if (move.layer === 'object') {
    const targetFootprint = getEditorObjectFootprintCells(value as AuthoredObjectRole, move.to);
    if (targetFootprint.some((cell) => !isInsideMap(cell))) {
      return {
        cells: currentCells,
        changed: false,
        message: `Target footprint for ${getObjectLabel(value as AuthoredObjectRole)} would leave the map.`,
      };
    }
    const occupiedKeys = getOccupiedObjectFootprintKeys(currentCells, move.from);
    const overlappingCell = targetFootprint.find((cell) => occupiedKeys.has(pointKey(cell)));
    if (overlappingCell) {
      return {
        cells: currentCells,
        changed: false,
        message: `Target footprint overlaps another object at ${overlappingCell.x},${overlappingCell.y}.`,
      };
    }
  }

  if (targetCell[move.layer]) {
    return {
      cells: currentCells,
      changed: false,
      message: `Target cell ${move.to.x},${move.to.y} already has a ${move.layer}.`,
    };
  }

  const cells = cloneEditorCells(currentCells);
  if (move.layer === 'object') {
    cells[move.from.y][move.from.x].object = undefined;
    cells[move.to.y][move.to.x].object = value as AuthoredObjectRole;
  } else {
    cells[move.from.y][move.from.x].marker = undefined;
    cells[move.to.y][move.to.x].marker = value as AuthoredMarkerRole;
  }
  return {
    cells,
    changed: true,
    message: `Moved ${move.layer} to ${move.to.x},${move.to.y}.`,
  };
};

export const validateEditorCells = (id: string, cells: AuthoredMapCell[][]): EditorValidationResult => {
  const config = parseAuthoredMapCsv(id, encodeEditorCells(cells));
  const level = generateLevel(config, ASSET_REGISTRY);
  const levelValidation = validateGeneratedLevel(level);
  const errors = [
    ...(config.authoredMap?.errors ?? []),
    ...levelValidation.errors,
    ...getDuplicateBuildingErrors(cells),
  ];
  return {
    valid: errors.length === 0,
    errors,
    warnings: levelValidation.warnings,
  };
};
