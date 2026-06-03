import * as Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../gameConfig';
import { AUTHORED_MAP_SIZE } from '../levels/authoredMap';
import type {
  AuthoredMapCell,
  AuthoredMarkerRole,
  AuthoredObjectRole,
  AuthoredTerrainRole,
  GridPoint,
} from '../levels/levelTypes';
import { getIsoMetrics, isoToScreen, scaleGeneratedSize, screenToIso } from '../isoUtils';
import { getSceneVariantTerrainFrameKey } from '../sceneVariantRenderer';
import {
  SCENE_VARIANTS,
  resolveSeasonalBuildingPresentation,
  selectSeasonalFrame,
  type SeasonPreset,
} from '../sceneVariants';
import {
  MARKER_OPTIONS,
  OBJECT_OPTIONS,
  TERRAIN_OPTIONS,
  UNIQUE_OBJECT_ROLES,
  getObjectLabel,
} from './palettes';
import {
  applyEditorChange,
  createEmptyEditorCells,
  encodeEditorCells,
  getUsedObjectRoles,
  moveEditorLayer,
  parseEditorCsv,
  validateEditorCells,
  getEditorLayerFootprintCells,
  type EditorLayer,
  type EditorSelection,
  type EditorTool,
  type EditorChangeResult,
  type MovableEditorLayer,
} from './serialization';
import {
  BOARD_PADDING,
  BUILDING_ROLE_BY_OBJECT,
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CAMERA_WHEEL_STEP,
  DEFAULT_CSV_KEY,
  DRAG_HOVER_COLOR,
  EDITOR_LEVEL_ID,
  EDITOR_TILE_SIZE,
  GATE_SUFFIX,
  HOVER_COLOR,
  INVALID_DROP_FOOTPRINT_COLOR,
  MARKER_COLOR,
  MARKER_FILL_ALPHA,
  MARKER_LABELS,
  OBJECT_RENDERING,
  PROP_FRAME_SUFFIX,
  SELECTED_FOOTPRINT_COLOR,
  VALID_DROP_FOOTPRINT_COLOR,
} from './editorConfig';
import { calculateEditorBoardBounds } from './camera';

interface LightweightEditorLevel {
  config: { tileSize: number };
  width: number;
  height: number;
}

type EditorDragValue = AuthoredTerrainRole | AuthoredObjectRole | AuthoredMarkerRole;

interface EditorDragState {
  source: 'palette' | 'map';
  layer: EditorLayer;
  value: EditorDragValue;
  label: string;
  sourceCell?: GridPoint;
  dropCell: GridPoint | null;
  startX: number;
  startY: number;
  moved: boolean;
}

interface SelectedEditorElement {
  layer: MovableEditorLayer;
  value: AuthoredObjectRole | AuthoredMarkerRole;
  label: string;
  anchor: GridPoint;
}

export class MapEditorScene extends Phaser.Scene {
  private cells: AuthoredMapCell[][] = createEmptyEditorCells();
  private selectedSeason: SeasonPreset = 'day_spring';
  private tool: EditorTool = 'terrain';
  private activeLayer: EditorLayer = 'terrain';
  private selection: EditorSelection = {
    terrain: 'grass',
    object: 'castle',
    marker: 'player_spawn',
  };
  private mapLayer?: Phaser.GameObjects.Container;
  private markerLayer?: Phaser.GameObjects.Container;
  private hoverGraphics?: Phaser.GameObjects.Graphics;
  private selectionGraphics?: Phaser.GameObjects.Graphics;
  private dropPreviewGraphics?: Phaser.GameObjects.Graphics;
  private uiRoot?: HTMLDivElement;
  private exportText?: HTMLTextAreaElement;
  private statusEl?: HTMLElement;
  private paletteEl?: HTMLElement;
  private validationEl?: HTMLElement;
  private currentHover: GridPoint | null = null;
  private lastPaintedKey = '';
  private isPanning = false;
  private panStart = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private dragState: EditorDragState | null = null;
  private dragGhost?: HTMLDivElement;
  private suppressCanvasPaint = false;
  private selectedElement: SelectedEditorElement | null = null;
  private readonly editorLevel: LightweightEditorLevel = {
    config: { tileSize: EDITOR_TILE_SIZE },
    width: AUTHORED_MAP_SIZE,
    height: AUTHORED_MAP_SIZE,
  };

  constructor() {
    super('map-editor');
  }

  preload() {
    this.load.atlas('sceneVariantTerrainAtlas', '/assets/scene-variants/scene_variant_terrain_atlas.png', '/assets/scene-variants/scene_variant_terrain_atlas.json');
    this.load.atlas('sceneVariantPropsAtlas', '/assets/scene-variants/scene_variant_props_atlas.png', '/assets/scene-variants/scene_variant_props_atlas.json');
    this.load.atlas('sceneVariantBuildingsAtlas', '/assets/scene-variants/scene_variant_buildings_atlas.png', '/assets/scene-variants/scene_variant_buildings_atlas.json');
    this.load.text(DEFAULT_CSV_KEY, '/levels/authored/village-crossroads-01.csv');
  }

  create() {
    document.body.classList.add('map-editor-route');
    this.cameras.main.setBackgroundColor(SCENE_VARIANTS[this.selectedSeason].scenicFallbackColor);
    this.cells = parseEditorCsv(EDITOR_LEVEL_ID, this.cache.text.get(DEFAULT_CSV_KEY) as string);
    this.mapLayer = this.add.container(0, 0);
    this.markerLayer = this.add.container(0, 0);
    this.hoverGraphics = this.add.graphics();
    this.hoverGraphics.setDepth(100000);
    this.selectionGraphics = this.add.graphics();
    this.selectionGraphics.setDepth(99998);
    this.dropPreviewGraphics = this.add.graphics();
    this.dropPreviewGraphics.setDepth(99999);
    this.spaceKey = this.input.keyboard?.addKey('SPACE');
    this.game.canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.createToolbar();
    this.renderMap();
    this.fitCameraToBoard();
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('wheel', this.handleWheel, this);
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyToolbar, this);
    this.updateValidation('Loaded starter map.');
  }

  update() {
    const pointer = this.input.activePointer;
    this.currentHover = this.dragState ? this.dragState.dropCell : this.pointerToCell(pointer);
    this.drawHover();
    this.drawSelectionFootprint();
    this.drawDropPreviewFootprint();
  }

  private createToolbar() {
    const root = document.createElement('div');
    root.className = 'map-editor-ui';
    root.innerHTML = `
      <div class="map-editor-panel map-editor-topbar">
        <strong>Map Editor</strong>
        <select class="map-editor-season" aria-label="Season">
          ${Object.keys(SCENE_VARIANTS).map((season) => (
            `<option value="${season}"${season === this.selectedSeason ? ' selected' : ''}>${season}</option>`
          )).join('')}
        </select>
        <select class="map-editor-layer" aria-label="Layer">
          <option value="terrain">Terrain</option>
          <option value="object">Object</option>
          <option value="marker">Marker</option>
        </select>
        <button type="button" data-tool="terrain">Terrain</button>
        <button type="button" data-tool="object">Object</button>
        <button type="button" data-tool="marker">Marker</button>
        <button type="button" data-tool="edit">Edit</button>
        <button type="button" data-tool="erase">Erase</button>
        <button type="button" data-action="center">Center</button>
      </div>
      <div class="map-editor-panel map-editor-sidebar">
        <div class="map-editor-palette"></div>
        <div class="map-editor-import">
          <input class="map-editor-file" type="file" accept=".csv,text/csv,text/plain" aria-label="Import CSV" />
          <textarea class="map-editor-csv" spellcheck="false" aria-label="CSV"></textarea>
          <div class="map-editor-actions">
            <button type="button" data-action="import-text">Import</button>
            <button type="button" data-action="copy">Copy</button>
            <button type="button" data-action="download">Download</button>
          </div>
        </div>
        <div class="map-editor-status"></div>
        <div class="map-editor-validation"></div>
      </div>
    `;
    document.body.appendChild(root);
    this.uiRoot = root;
    this.exportText = root.querySelector('.map-editor-csv') as HTMLTextAreaElement;
    this.statusEl = root.querySelector('.map-editor-status') as HTMLElement;
    this.paletteEl = root.querySelector('.map-editor-palette') as HTMLElement;
    this.validationEl = root.querySelector('.map-editor-validation') as HTMLElement;
    root.addEventListener('click', this.handleUiClick);
    root.addEventListener('pointerdown', this.handlePalettePointerDown);
    document.addEventListener('pointermove', this.handleDocumentPointerMove);
    document.addEventListener('pointerup', this.handleDocumentPointerUp);
    document.addEventListener('pointercancel', this.handleDocumentPointerCancel);
    root.querySelector('.map-editor-season')?.addEventListener('change', this.handleSeasonChange);
    root.querySelector('.map-editor-layer')?.addEventListener('change', this.handleLayerChange);
    root.querySelector('.map-editor-file')?.addEventListener('change', this.handleFileImport);
    this.syncExportText();
    this.updateToolbar();
  }

  private readonly handleUiClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const tool = target.closest<HTMLButtonElement>('[data-tool]')?.dataset.tool as EditorTool | undefined;
    const action = target.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    const paletteValue = target.closest<HTMLButtonElement>('[data-palette-value]')?.dataset.paletteValue;

    if (tool) {
      const previousTool = this.tool;
      this.tool = tool;
      if (tool !== 'erase' && tool !== 'edit') {
        this.activeLayer = tool;
      }
      if (previousTool !== tool) {
        this.clearSelectedElement();
        this.renderMap();
      }
      this.updateToolbar();
      return;
    }

    if (paletteValue) {
      this.setPaletteValue(paletteValue);
      return;
    }

    if (action === 'center') {
      this.fitCameraToBoard();
    } else if (action === 'import-text') {
      this.importCsv(this.exportText?.value ?? '');
    } else if (action === 'copy') {
      void this.copyCsv();
    } else if (action === 'download') {
      this.downloadCsv();
    }
  };

  private readonly handleSeasonChange = (event: Event) => {
    const value = (event.target as HTMLSelectElement).value as SeasonPreset;
    if (!SCENE_VARIANTS[value]) {
      return;
    }
    this.selectedSeason = value;
    this.cameras.main.setBackgroundColor(SCENE_VARIANTS[this.selectedSeason].scenicFallbackColor);
    this.renderMap();
    this.setStatus(`Previewing ${value}.`);
  };

  private readonly handleLayerChange = (event: Event) => {
    this.activeLayer = (event.target as HTMLSelectElement).value as EditorLayer;
    if (this.tool !== 'erase') {
      this.tool = this.activeLayer;
    }
    this.clearSelectedElement();
    this.renderMap();
    this.updateToolbar();
  };

  private readonly handleFileImport = async (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.importCsv(await file.text());
    (event.target as HTMLInputElement).value = '';
  };

  private destroyToolbar() {
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerup', this.handlePointerUp, this);
    this.input.off('wheel', this.handleWheel, this);
    this.scale.off('resize', this.handleResize, this);
    this.game.canvas.removeEventListener('contextmenu', this.preventContextMenu);
    this.uiRoot?.removeEventListener('click', this.handleUiClick);
    this.uiRoot?.removeEventListener('pointerdown', this.handlePalettePointerDown);
    document.removeEventListener('pointermove', this.handleDocumentPointerMove);
    document.removeEventListener('pointerup', this.handleDocumentPointerUp);
    document.removeEventListener('pointercancel', this.handleDocumentPointerCancel);
    this.uiRoot?.querySelector('.map-editor-season')?.removeEventListener('change', this.handleSeasonChange);
    this.uiRoot?.querySelector('.map-editor-layer')?.removeEventListener('change', this.handleLayerChange);
    this.uiRoot?.querySelector('.map-editor-file')?.removeEventListener('change', this.handleFileImport);
    this.uiRoot?.remove();
    document.body.classList.remove('map-editor-route');
  }

  private updateToolbar() {
    const layerSelect = this.uiRoot?.querySelector('.map-editor-layer') as HTMLSelectElement | null;
    if (layerSelect) {
      layerSelect.value = this.activeLayer;
    }
    this.uiRoot?.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.tool === this.tool);
    });
    this.renderPalette();
  }

  private renderPalette() {
    if (!this.paletteEl) {
      return;
    }
    if (this.tool === 'edit') {
      this.paletteEl.innerHTML = '<p class="map-editor-muted">Select an existing object or marker on the map.</p>';
      return;
    }
    if (this.tool === 'erase') {
      this.paletteEl.innerHTML = `<p class="map-editor-muted">Erase ${this.activeLayer}</p>`;
      return;
    }
    const options = this.tool === 'terrain'
      ? TERRAIN_OPTIONS
      : (this.tool === 'object' ? OBJECT_OPTIONS : MARKER_OPTIONS);
    const usedObjects = getUsedObjectRoles(this.cells);
    this.paletteEl.innerHTML = options.map((option) => {
      const isObject = this.tool === 'object';
      const value = option.value;
      const disabled = isObject
        && UNIQUE_OBJECT_ROLES.has(value as AuthoredObjectRole)
        && usedObjects.has(value as AuthoredObjectRole)
        && this.selection.object !== value;
      const selected = this.tool !== 'edit' && this.tool !== 'erase' && this.selection[this.tool] === value;
      return `
        <button
          type="button"
          data-palette-value="${value}"
          class="${selected ? 'is-active' : ''}"
          ${disabled ? 'disabled' : ''}
          title="${disabled ? `${option.label} already exists` : option.label}"
        >${option.label}</button>
      `;
    }).join('');
  }

  private setPaletteValue(value: string) {
    if (this.tool === 'terrain') {
      this.selection.terrain = value as AuthoredTerrainRole;
    } else if (this.tool === 'object') {
      this.selection.object = value as AuthoredObjectRole;
    } else if (this.tool === 'marker') {
      this.selection.marker = value as AuthoredMarkerRole;
    }
    this.updateToolbar();
  }

  private readonly handlePalettePointerDown = (event: PointerEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-palette-value]');
    if (!button || button.disabled || this.tool === 'erase' || this.tool === 'edit') {
      return;
    }
    const layer = this.tool as EditorLayer;
    const value = button.dataset.paletteValue as EditorDragValue;
    this.startDrag({
      source: 'palette',
      layer,
      value,
      label: button.textContent?.trim() || value,
      dropCell: this.clientToCell(event.clientX, event.clientY),
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }, event.clientX, event.clientY);
  };

  private readonly handleDocumentPointerMove = (event: PointerEvent) => {
    if (!this.dragState) {
      return;
    }
    if (Math.hypot(event.clientX - this.dragState.startX, event.clientY - this.dragState.startY) > 4) {
      this.dragState.moved = true;
    }
    this.dragState.dropCell = this.clientToCell(event.clientX, event.clientY);
    this.currentHover = this.dragState.dropCell;
    this.updateDragGhost(event.clientX, event.clientY);
    event.preventDefault();
  };

  private readonly handleDocumentPointerUp = (event: PointerEvent) => {
    if (!this.dragState) {
      return;
    }
    const dragState = this.dragState;
    const dropCell = this.clientToCell(event.clientX, event.clientY) ?? dragState.dropCell;
    this.finishDrag();
    this.suppressCanvasPaint = false;
    if (!dragState.moved) {
      return;
    }
    if (!dropCell) {
      this.setStatus('Drop cancelled outside the map.');
      event.preventDefault();
      return;
    }
    if (dragState.source === 'palette') {
      this.dropPaletteValue(dragState, dropCell);
    } else {
      this.dropMapElement(dragState, dropCell);
    }
    event.preventDefault();
  };

  private readonly handleDocumentPointerCancel = () => {
    if (!this.dragState) {
      return;
    }
    this.finishDrag();
    this.suppressCanvasPaint = false;
    this.setStatus('Drag cancelled.');
  };

  private startDrag(dragState: EditorDragState, clientX: number, clientY: number) {
    this.dragState = dragState;
    this.currentHover = dragState.dropCell;
    this.suppressCanvasPaint = true;
    this.createDragGhost(dragState.label);
    this.updateDragGhost(clientX, clientY);
    document.body.classList.add('map-editor-dragging');
  }

  private finishDrag() {
    this.dragState = null;
    this.currentHover = null;
    this.dragGhost?.remove();
    this.dragGhost = undefined;
    document.body.classList.remove('map-editor-dragging');
  }

  private createDragGhost(label: string) {
    this.dragGhost?.remove();
    const ghost = document.createElement('div');
    ghost.className = 'map-editor-drag-ghost';
    ghost.textContent = label;
    document.body.appendChild(ghost);
    this.dragGhost = ghost;
  }

  private updateDragGhost(clientX: number, clientY: number) {
    if (!this.dragGhost) {
      return;
    }
    this.dragGhost.style.transform = `translate(${clientX + 14}px, ${clientY + 14}px)`;
  }

  private dropPaletteValue(dragState: EditorDragState, dropCell: GridPoint) {
    const selection = { ...this.selection };
    if (dragState.layer === 'terrain') {
      selection.terrain = dragState.value as AuthoredTerrainRole;
    } else if (dragState.layer === 'object') {
      selection.object = dragState.value as AuthoredObjectRole;
    } else {
      selection.marker = dragState.value as AuthoredMarkerRole;
    }
    const result = applyEditorChange(this.cells, dropCell, {
      tool: dragState.layer,
      activeLayer: dragState.layer,
      selection,
    });
    this.commitEditorResult(result);
  }

  private dropMapElement(dragState: EditorDragState, dropCell: GridPoint) {
    if (!dragState.sourceCell || dragState.layer === 'terrain') {
      this.setStatus('Only placed objects and markers can be moved.');
      return;
    }
    const result = moveEditorLayer(this.cells, {
      layer: dragState.layer as MovableEditorLayer,
      from: dragState.sourceCell,
      to: dropCell,
    });
    if (result.changed) {
      this.clearSelectedElement();
    }
    this.commitEditorResult(result);
  }

  private clientToCell(clientX: number, clientY: number): GridPoint | null {
    const canvasBounds = this.game.canvas.getBoundingClientRect();
    if (
      clientX < canvasBounds.left
      || clientY < canvasBounds.top
      || clientX > canvasBounds.right
      || clientY > canvasBounds.bottom
    ) {
      return null;
    }
    const gameX = ((clientX - canvasBounds.left) / canvasBounds.width) * this.scale.width;
    const gameY = ((clientY - canvasBounds.top) / canvasBounds.height) * this.scale.height;
    const world = this.cameras.main.getWorldPoint(gameX, gameY);
    return this.worldToCell(world.x, world.y);
  }

  private worldToCell(worldX: number, worldY: number): GridPoint | null {
    const iso = screenToIso(worldX, worldY, true, this.editorLevel);
    const point = { x: Math.round(iso.x), y: Math.round(iso.y) };
    if (point.x < 0 || point.y < 0 || point.x >= AUTHORED_MAP_SIZE || point.y >= AUTHORED_MAP_SIZE) {
      return null;
    }
    return point;
  }

  private renderMap() {
    this.mapLayer?.removeAll(true);
    this.markerLayer?.removeAll(true);
    const variant = SCENE_VARIANTS[this.selectedSeason];
    const { tileH } = getIsoMetrics(true, this.editorLevel);
    const tileSize = scaleGeneratedSize([160, 160], true, this.editorLevel);

    this.cells.forEach((row, y) => row.forEach((cell, x) => {
      const center = isoToScreen(x, y, 0, true, this.editorLevel);
      const frame = getSceneVariantTerrainFrameKey(variant.visualTheme, cell.terrain);
      if (this.textures.get('sceneVariantTerrainAtlas').has(frame)) {
        const tile = this.add.image(center.x, center.y, 'sceneVariantTerrainAtlas', frame)
          .setOrigin(0.5, 0.62)
          .setDisplaySize(tileSize[0], tileSize[1])
          .setDepth(center.y - tileH);
        this.mapLayer?.add(tile);
      }
    }));

    this.cells.forEach((row, y) => row.forEach((cell, x) => {
      if (cell.object) {
        this.renderObject(cell.object, { x, y });
      }
      if (cell.marker) {
        this.renderMarker(cell.marker, { x, y });
      }
    }));
  }

  private renderObject(object: AuthoredObjectRole, point: GridPoint) {
    const variant = SCENE_VARIANTS[this.selectedSeason];
    const rendering = OBJECT_RENDERING[object];
    if (!rendering) {
      return;
    }
    const p = isoToScreen(point.x, point.y, rendering.z, true, this.editorLevel);
    let frame: string | null = null;
    const buildingRole = BUILDING_ROLE_BY_OBJECT[object];
    if (buildingRole) {
      frame = resolveSeasonalBuildingPresentation(variant, buildingRole, `${object}:${point.x}:${point.y}`).frame;
    } else if (GATE_SUFFIX[object]) {
      frame = `${variant.visualTheme}_${GATE_SUFFIX[object]}`;
    } else if (PROP_FRAME_SUFFIX[object]) {
      frame = `${variant.visualTheme}_${PROP_FRAME_SUFFIX[object]}`;
      if (!this.textures.get(rendering.atlas).has(frame)) {
        const group = object === 'tree_broadleaf' || object === 'tree_conifer' ? 'trees' : 'flowers';
        frame = selectSeasonalFrame(variant.propPalette[group], `${object}:${point.x}:${point.y}`);
      }
    }
    if (!frame || !this.textures.get(rendering.atlas).has(frame)) {
      return;
    }
    const size = scaleGeneratedSize(rendering.size, true, this.editorLevel);
    const sprite = this.add.image(p.x, p.y, rendering.atlas, frame)
      .setOrigin(rendering.origin[0], rendering.origin[1])
      .setDisplaySize(size[0], size[1])
      .setDepth(p.y + 16);
    sprite.setInteractive({ cursor: this.tool === 'edit' ? 'pointer' : 'default' });
    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      this.handleMapElementPointerDown(pointer, event, 'object', object, getObjectLabel(object), point);
    });
    this.mapLayer?.add(sprite);
  }

  private renderMarker(marker: AuthoredMarkerRole, point: GridPoint) {
    const p = isoToScreen(point.x, point.y, 2, true, this.editorLevel);
    const badge = this.add.container(p.x, p.y - 14);
    const circle = this.add.circle(0, 0, 12, MARKER_COLOR, MARKER_FILL_ALPHA)
      .setStrokeStyle(2, 0xffffff, 0.86);
    const label = this.add.text(0, -1, MARKER_LABELS[marker], {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '13px',
      fontStyle: '700',
      color: '#ffffff',
    }).setOrigin(0.5);
    badge.add([circle, label]);
    badge.setDepth(p.y + 1000);
    badge.setSize(34, 34);
    badge.setInteractive(new Phaser.Geom.Circle(0, 0, 17), Phaser.Geom.Circle.Contains);
    badge.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      this.handleMapElementPointerDown(pointer, event, 'marker', marker, marker, point);
    });
    this.markerLayer?.add(badge);
  }

  private handleMapElementPointerDown(
    pointer: Phaser.Input.Pointer,
    event: Phaser.Types.Input.EventData,
    layer: Extract<EditorLayer, 'object' | 'marker'>,
    value: AuthoredObjectRole | AuthoredMarkerRole,
    label: string,
    sourceCell: GridPoint,
  ) {
    if (this.tool !== 'edit') {
      return;
    }
    event.stopPropagation();
    if (!this.isSelectedElement(layer, value, sourceCell)) {
      this.selectElement({ layer, value, label, anchor: { ...sourceCell } });
      this.setStatus(`Selected ${label}.`);
      return;
    }
    const clientPoint = this.getPointerClientPoint(pointer);
    this.startDrag({
      source: 'map',
      layer,
      value,
      label,
      sourceCell: { ...sourceCell },
      dropCell: this.pointerToCell(pointer),
      startX: clientPoint.x,
      startY: clientPoint.y,
      moved: false,
    }, clientPoint.x, clientPoint.y);
  }

  private selectElement(element: SelectedEditorElement) {
    this.selectedElement = element;
  }

  private clearSelectedElement() {
    this.selectedElement = null;
    this.selectionGraphics?.clear();
    this.dropPreviewGraphics?.clear();
  }

  private isSelectedElement(
    layer: MovableEditorLayer,
    value: AuthoredObjectRole | AuthoredMarkerRole,
    anchor: GridPoint,
  ) {
    return Boolean(
      this.selectedElement
      && this.selectedElement.layer === layer
      && this.selectedElement.value === value
      && this.selectedElement.anchor.x === anchor.x
      && this.selectedElement.anchor.y === anchor.y,
    );
  }

  private drawHover() {
    this.hoverGraphics?.clear();
    if (!this.currentHover || !this.hoverGraphics) {
      return;
    }
    const { tileW, tileH } = getIsoMetrics(true, this.editorLevel);
    const center = isoToScreen(this.currentHover.x, this.currentHover.y, 0, true, this.editorLevel);
    const color = this.dragState ? DRAG_HOVER_COLOR : HOVER_COLOR;
    this.hoverGraphics.lineStyle(3, color, 0.95);
    this.hoverGraphics.fillStyle(color, this.dragState ? 0.18 : 0.12);
    this.hoverGraphics.beginPath();
    this.hoverGraphics.moveTo(center.x, center.y - tileH / 2);
    this.hoverGraphics.lineTo(center.x + tileW / 2, center.y);
    this.hoverGraphics.lineTo(center.x, center.y + tileH / 2);
    this.hoverGraphics.lineTo(center.x - tileW / 2, center.y);
    this.hoverGraphics.closePath();
    this.hoverGraphics.fillPath();
    this.hoverGraphics.strokePath();
  }

  private drawSelectionFootprint() {
    this.selectionGraphics?.clear();
    if (!this.selectedElement || !this.selectionGraphics) {
      return;
    }
    this.drawFootprintCells(
      this.selectionGraphics,
      getEditorLayerFootprintCells(this.selectedElement.layer, this.selectedElement.value, this.selectedElement.anchor),
      SELECTED_FOOTPRINT_COLOR,
      0.1,
      0.96,
    );
  }

  private drawDropPreviewFootprint() {
    this.dropPreviewGraphics?.clear();
    if (!this.dragState || !this.dragState.dropCell || !this.dropPreviewGraphics || this.dragState.layer === 'terrain') {
      return;
    }
    const layer = this.dragState.layer as MovableEditorLayer;
    const dropCells = getEditorLayerFootprintCells(layer, this.dragState.value as AuthoredObjectRole | AuthoredMarkerRole, this.dragState.dropCell);
    const validDrop = this.dragState.source === 'map' && this.dragState.sourceCell
      ? moveEditorLayer(this.cells, {
        layer,
        from: this.dragState.sourceCell,
        to: this.dragState.dropCell,
      }).changed
      : true;
    this.drawFootprintCells(
      this.dropPreviewGraphics,
      dropCells,
      validDrop ? VALID_DROP_FOOTPRINT_COLOR : INVALID_DROP_FOOTPRINT_COLOR,
      validDrop ? 0.16 : 0.2,
      0.96,
    );
  }

  private drawFootprintCells(
    graphics: Phaser.GameObjects.Graphics,
    cells: GridPoint[],
    color: number,
    fillAlpha: number,
    lineAlpha: number,
  ) {
    const { tileW, tileH } = getIsoMetrics(true, this.editorLevel);
    graphics.lineStyle(3, color, lineAlpha);
    graphics.fillStyle(color, fillAlpha);
    cells.forEach((cell) => {
      const center = isoToScreen(cell.x, cell.y, 0, true, this.editorLevel);
      graphics.beginPath();
      graphics.moveTo(center.x, center.y - tileH / 2);
      graphics.lineTo(center.x + tileW / 2, center.y);
      graphics.lineTo(center.x, center.y + tileH / 2);
      graphics.lineTo(center.x - tileW / 2, center.y);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    });
  }

  private pointerToCell(pointer: Phaser.Input.Pointer): GridPoint | null {
    return this.worldToCell(pointer.worldX, pointer.worldY);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    if (this.dragState || this.suppressCanvasPaint) {
      return;
    }
    if (pointer.rightButtonDown() || this.spaceKey?.isDown) {
      this.isPanning = true;
      this.panStart = {
        x: pointer.x,
        y: pointer.y,
        scrollX: this.cameras.main.scrollX,
        scrollY: this.cameras.main.scrollY,
      };
      return;
    }
    if (this.tool === 'edit') {
      this.clearSelectedElement();
      this.setStatus('Selection cleared.');
      return;
    }
    this.paintPointer(pointer);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (this.dragState || this.suppressCanvasPaint) {
      return;
    }
    if (this.isPanning) {
      const camera = this.cameras.main;
      camera.scrollX = this.panStart.scrollX - (pointer.x - this.panStart.x) / camera.zoom;
      camera.scrollY = this.panStart.scrollY - (pointer.y - this.panStart.y) / camera.zoom;
      return;
    }
    if (this.tool === 'edit') {
      return;
    }
    if (pointer.isDown) {
      this.paintPointer(pointer);
    }
  }

  private handlePointerUp() {
    this.isPanning = false;
    this.lastPaintedKey = '';
    this.suppressCanvasPaint = false;
  }

  private handleWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ) {
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Clamp(camera.zoom - deltaY * CAMERA_WHEEL_STEP, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM));
  }

  private paintPointer(pointer: Phaser.Input.Pointer) {
    const point = this.pointerToCell(pointer);
    if (!point) {
      return;
    }
    const selectionLayer = this.tool === 'erase' || this.tool === 'edit'
      ? this.activeLayer
      : this.tool;
    const key = `${point.x},${point.y}:${this.tool}:${this.activeLayer}:${this.selection[selectionLayer]}`;
    if (key === this.lastPaintedKey) {
      return;
    }
    this.lastPaintedKey = key;
    const result = applyEditorChange(this.cells, point, {
      tool: this.tool,
      activeLayer: this.activeLayer,
      selection: this.selection,
    });
    this.commitEditorResult(result);
  }

  private commitEditorResult(result: EditorChangeResult) {
    this.setStatus(result.message);
    if (!result.changed) {
      return;
    }
    this.cells = result.cells;
    this.renderMap();
    this.updateToolbar();
    this.syncExportText();
    this.updateValidation(result.message);
  }

  private getPointerClientPoint(pointer: Phaser.Input.Pointer) {
    const canvasBounds = this.game.canvas.getBoundingClientRect();
    return {
      x: canvasBounds.left + pointer.x,
      y: canvasBounds.top + pointer.y,
    };
  }

  private fitCameraToBoard() {
    const camera = this.cameras.main;
    const bounds = this.getBoardBounds();
    camera.setBounds(
      bounds.left - BOARD_PADDING,
      bounds.top - BOARD_PADDING,
      bounds.width + BOARD_PADDING * 2,
      bounds.height + BOARD_PADDING * 2,
    );
    camera.setZoom(Math.min(1, Math.max(0.58, this.scale.height / (bounds.height + 180))));
    camera.centerOn(bounds.centerX + 80, bounds.centerY);
  }

  private getBoardBounds() {
    return calculateEditorBoardBounds(this.editorLevel, {
      getIsoMetrics,
      isoToScreen,
    });
  }

  private handleResize() {
    this.fitCameraToBoard();
  }

  private readonly preventContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private importCsv(csv: string) {
    if (!csv.trim()) {
      this.setStatus('No CSV to import.');
      return;
    }
    this.cells = parseEditorCsv(EDITOR_LEVEL_ID, csv);
    this.renderMap();
    this.updateToolbar();
    this.syncExportText();
    this.updateValidation('Imported CSV.');
  }

  private syncExportText() {
    if (this.exportText) {
      this.exportText.value = encodeEditorCells(this.cells);
    }
  }

  private getCsvIfValid() {
    const result = validateEditorCells(EDITOR_LEVEL_ID, this.cells);
    this.showValidation(result);
    if (!result.valid) {
      this.setStatus('Fix validation errors before export.');
      return null;
    }
    return encodeEditorCells(this.cells);
  }

  private async copyCsv() {
    const csv = this.getCsvIfValid();
    if (!csv) {
      return;
    }
    await navigator.clipboard.writeText(csv);
    this.setStatus('CSV copied.');
  }

  private downloadCsv() {
    const csv = this.getCsvIfValid();
    if (!csv) {
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'village-custom-01.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    this.setStatus('CSV downloaded.');
  }

  private updateValidation(message: string) {
    const result = validateEditorCells(EDITOR_LEVEL_ID, this.cells);
    this.showValidation(result);
    this.setStatus(message);
  }

  private showValidation(result: { valid: boolean; errors: string[]; warnings: string[] }) {
    if (!this.validationEl) {
      return;
    }
    const errors = result.errors.slice(0, 6);
    const warnings = result.warnings.slice(0, 3);
    this.validationEl.classList.toggle('is-valid', result.valid);
    this.validationEl.innerHTML = result.valid
      ? `<strong>Valid map</strong>${warnings.length ? `<p>${warnings.join('<br />')}</p>` : ''}`
      : `<strong>${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}</strong><p>${errors.join('<br />')}</p>`;
  }

  private setStatus(message: string) {
    if (this.statusEl) {
      this.statusEl.textContent = message;
    }
  }
}

export const createMapEditorGameConfig = (): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#7fcaf3',
  width: Math.max(window.innerWidth, WIDTH),
  height: Math.max(window.innerHeight, HEIGHT),
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: MapEditorScene,
});
