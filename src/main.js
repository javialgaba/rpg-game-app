import Phaser from 'phaser';
import './style.css';

const WIDTH = 1280;
const HEIGHT = 720;
const TILE_W = 92;
const TILE_H = 46;
const MAP_W = 15;
const MAP_H = 15;
const ORIGIN = { x: WIDTH / 2, y: 108 };
const PLAYER_BASE = {
  maxHealth: 3,
  maxMana: 90,
  speed: 3.15,
  swordPower: 1,
  bowPower: 1,
  spellPower: 2,
  bowCooldown: 560,
  spellCost: 28,
};

const LEVEL_UP_CARD_XS = [-210, 0, 210];
const LEVEL_UP_MAX_PIPS = 5;

const COLORS = {
  skyTop: 0x8bd6ff,
  skyBottom: 0xd7f6ff,
  grassA: 0x91dd78,
  grassB: 0x79cf70,
  forest: 0x59b66f,
  path: 0xd6bc87,
  pathEdge: 0xb99763,
  garden: 0xf5a6c7,
  water: 0x7fd8f6,
  uiInk: '#25324a',
};

class FairyGuildScene extends Phaser.Scene {
  constructor() {
    super('fairy-guild');
    this.player = null;
    this.playerStats = { ...PLAYER_BASE };
    this.state = {
      health: PLAYER_BASE.maxHealth,
      mana: PLAYER_BASE.maxMana,
      gold: 0,
      xp: 0,
      level: 1,
      phase: 'countdown',
      villageSafety: 100,
      equipped: 'Wooden Sword',
      spell: 'Sparkle Burst',
      inventoryOpen: false,
      gameOverReason: '',
    };
    this.keys = {};
    this.keys = {};
    this.enemies = [];
    this.projectiles = [];
    this.chests = [];
    this.pickups = [];
    this.buildings = [];
    this.effects = [];
    this.notes = [];
    this.upgrades = [];
    this.levelUpProgressBars = [];
    this.lastPointerIso = { x: 7, y: 7 };
    this.levelSpawnsPending = 0;
    this.levelEnemiesRemaining = 0;
    this.levelClearQueued = false;
    this.levelTimers = [];
  }

  preload() {
    this.load.image('villageBoard', '/assets/village-board.png');
    this.load.image('levelUpUI', '/assets/level-up-ui.png');
    this.load.image('gameOverUI', '/assets/game-over-ui.png');
    this.load.image('statusPanelUI', '/assets/status-panel-ui.png');
    this.load.image('guildNotesUI', '/assets/guild-notes-ui-transparent.png');
    this.load.image('heroSheet', '/assets/hero-sheet.png');
    this.load.image('monsterSheet', '/assets/monster-pickup-sheet.png');
    this.load.image('worldSheet', '/assets/world-ui-sheet.png');
  }

  create() {
    this.resetRuntimeState();
    this.createAudio();
    this.registerSheetFrames('heroSheet', 8, 4, 'hero');
    this.registerSheetFrames('monsterSheet', 8, 5, 'monster');
    this.registerSheetFrames('worldSheet', 6, 4, 'world');
    this.registerUiArtFrames();
    this.createGeneratedTextures();

    this.worldLayer = this.add.layer();
    this.entityLayer = this.add.layer();
    this.fxLayer = this.add.layer();
    this.uiLayer = this.add.layer().setDepth(5000);

    this.createBackground();
    this.createVillage();
    this.createPlayer();
    this.createControls();
    this.createHud();
    this.createUpgrades();
    this.createPhaseOverlays();
    this.spawnInitialChests();
    this.startLevelCountdown();

    this.time.addEvent({
      delay: 1250,
      loop: true,
      callback: () => {
        if (this.state.phase === 'playing') {
          this.regenMana(2 + Math.floor(this.state.level / 2));
          this.updateVillageSafety();
          this.checkFailureState();
        }
      },
    });

    this.addGuildNote('The village is safe for now!');
    this.addGuildNote('Press E near a chest for a cheerful surprise.');
  }

  resetRuntimeState() {
    this.player = null;
    this.playerStats = { ...PLAYER_BASE };
    this.state = {
      health: PLAYER_BASE.maxHealth,
      mana: PLAYER_BASE.maxMana,
      gold: 0,
      xp: 0,
      level: 1,
      phase: 'countdown',
      villageSafety: 100,
      equipped: 'Wooden Sword',
      spell: 'Sparkle Burst',
      inventoryOpen: false,
      gameOverReason: '',
    };
    this.enemies = [];
    this.projectiles = [];
    this.chests = [];
    this.pickups = [];
    this.buildings = [];
    this.effects = [];
    this.notes = [];
    this.upgrades = [];
    this.levelUpProgressBars = [];
    this.lastPointerIso = { x: 7, y: 7 };
    this.levelSpawnsPending = 0;
    this.levelEnemiesRemaining = 0;
    this.levelClearQueued = false;
    this.levelTimers = [];
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.updatePointerIso();
    if (this.state.phase === 'playing') {
      this.updatePlayer(dt, time);
      this.updateEnemies(dt, time);
      this.updateProjectiles(dt);
      this.updatePickups(dt);
      this.updateChests(time);
      this.checkLevelClear();
      this.checkFailureState();
    }
    this.updateEffects(dt);
    this.updateDepths();
    this.updateHud();
  }

  registerSheetFrames(key, cols, rows, prefix) {
    const texture = this.textures.get(key);
    const image = texture.getSourceImage();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const frameName = `${prefix}-${row}-${col}`;
        if (texture.has(frameName)) continue;
        const x = Math.round((image.width / cols) * col);
        const y = Math.round((image.height / rows) * row);
        const nextX = Math.round((image.width / cols) * (col + 1));
        const nextY = Math.round((image.height / rows) * (row + 1));
        texture.add(frameName, 0, x, y, nextX - x, nextY - y);
      }
    }
  }

  registerUiArtFrames() {
    const status = this.textures.get('statusPanelUI');
    if (!status.has('panel')) {
      status.add('panel', 0, 34, 310, 1764, 250);
    }
    const notes = this.textures.get('guildNotesUI');
    if (!notes.has('panel')) {
      notes.add('panel', 0, 94, 126, 1352, 770);
    }
    const world = this.textures.get('worldSheet');
    if (!world.has('level-sword-icon')) {
      world.add('level-sword-icon', 0, 28, 611, 136, 134);
    }
    if (!world.has('level-bow-icon')) {
      world.add('level-bow-icon', 0, 330, 611, 133, 134);
    }
    if (!world.has('level-spell-icon')) {
      world.add('level-spell-icon', 0, 479, 611, 135, 135);
    }
  }

  createGeneratedTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const make = (key, width, height, draw) => {
      g.clear();
      if (this.textures.exists(key)) this.textures.remove(key);
      draw(g, width, height);
      g.generateTexture(key, width, height);
    };

    make('castleTexture', 180, 156, (gfx) => {
      gfx.fillStyle(0x4f8bd6, 0.22);
      gfx.fillEllipse(90, 132, 128, 26);
      gfx.fillStyle(0xf6e7c6, 1);
      gfx.fillRoundedRect(50, 58, 80, 64, 8);
      gfx.fillStyle(0xffd37a, 1);
      gfx.fillTriangle(42, 62, 90, 20, 138, 62);
      gfx.fillStyle(0xffa75e, 1);
      gfx.fillRect(58, 66, 64, 10);
      gfx.fillStyle(0xd9f6ff, 1);
      gfx.fillRoundedRect(80, 85, 20, 30, 8);
      gfx.fillStyle(0x8d70d6, 1);
      gfx.fillRoundedRect(24, 70, 30, 48, 6);
      gfx.fillRoundedRect(126, 70, 30, 48, 6);
      gfx.fillStyle(0xffd37a, 1);
      gfx.fillTriangle(18, 72, 39, 42, 60, 72);
      gfx.fillTriangle(120, 72, 141, 42, 162, 72);
      gfx.fillStyle(0xffffff, 1);
      gfx.fillCircle(90, 48, 6);
      gfx.lineStyle(4, 0x7d5a35, 0.65);
      gfx.strokeRoundedRect(50, 58, 80, 64, 8);
      gfx.strokeRoundedRect(24, 70, 30, 48, 6);
      gfx.strokeRoundedRect(126, 70, 30, 48, 6);
    });

    make('cottageTexture', 142, 120, (gfx) => {
      gfx.fillStyle(0x7f5b38, 0.22);
      gfx.fillEllipse(71, 100, 96, 20);
      gfx.fillStyle(0xfff0c9, 1);
      gfx.fillRoundedRect(34, 48, 74, 48, 8);
      gfx.fillStyle(0xf4a13f, 1);
      gfx.fillTriangle(24, 52, 72, 18, 118, 52);
      gfx.fillStyle(0xffc35c, 1);
      gfx.fillRoundedRect(36, 50, 72, 10, 4);
      gfx.fillStyle(0x6ac5ff, 1);
      gfx.fillRoundedRect(48, 64, 16, 16, 5);
      gfx.fillRoundedRect(78, 64, 16, 16, 5);
      gfx.fillStyle(0xa87343, 1);
      gfx.fillRoundedRect(63, 74, 16, 24, 8);
      gfx.lineStyle(4, 0x74523a, 0.6);
      gfx.strokeRoundedRect(34, 48, 74, 48, 8);
    });

    make('bakeryTexture', 142, 120, (gfx) => {
      gfx.fillStyle(0x7f5b38, 0.22);
      gfx.fillEllipse(71, 100, 96, 20);
      gfx.fillStyle(0xffe4b8, 1);
      gfx.fillRoundedRect(30, 50, 82, 46, 8);
      gfx.fillStyle(0x8bd3ff, 1);
      gfx.fillTriangle(22, 52, 72, 16, 122, 52);
      gfx.fillStyle(0xffffff, 1);
      for (let i = 0; i < 5; i += 1) {
        gfx.fillRect(31 + i * 16, 52, 8, 22);
      }
      gfx.fillStyle(0xed7a62, 1);
      for (let i = 0; i < 5; i += 1) {
        gfx.fillRect(39 + i * 16, 52, 8, 22);
      }
      gfx.fillStyle(0xc68647, 1);
      gfx.fillRoundedRect(60, 74, 22, 22, 6);
      gfx.fillStyle(0x8b5a30, 1);
      gfx.fillEllipse(72, 66, 36, 12);
      gfx.lineStyle(4, 0x73553f, 0.58);
      gfx.strokeRoundedRect(30, 50, 82, 46, 8);
    });

    make('marketTexture', 150, 110, (gfx) => {
      gfx.fillStyle(0x7f5b38, 0.2);
      gfx.fillEllipse(75, 92, 110, 18);
      gfx.fillStyle(0x875b3e, 1);
      gfx.fillRoundedRect(40, 62, 70, 24, 6);
      gfx.fillStyle(0xf8f2d0, 1);
      gfx.fillRoundedRect(32, 38, 86, 26, 5);
      gfx.fillStyle(0xed6b68, 1);
      for (let i = 0; i < 5; i += 1) {
        gfx.fillRect(34 + i * 17, 38, 9, 27);
      }
      gfx.fillStyle(0x7fd56a, 1);
      gfx.fillCircle(54, 72, 7);
      gfx.fillStyle(0xffd15a, 1);
      gfx.fillCircle(75, 73, 7);
      gfx.fillStyle(0xff8f6f, 1);
      gfx.fillCircle(96, 72, 7);
      gfx.lineStyle(4, 0x765239, 0.55);
      gfx.strokeRoundedRect(32, 38, 86, 26, 5);
    });

    make('treeTexture', 104, 132, (gfx) => {
      gfx.fillStyle(0x7a5330, 1);
      gfx.fillRoundedRect(45, 72, 16, 40, 7);
      gfx.fillStyle(0x399b5d, 1);
      gfx.fillCircle(52, 46, 30);
      gfx.fillStyle(0x55ba67, 1);
      gfx.fillCircle(34, 58, 26);
      gfx.fillStyle(0x70cf76, 1);
      gfx.fillCircle(70, 60, 28);
      gfx.fillStyle(0xefffa4, 0.75);
      gfx.fillCircle(67, 37, 4);
      gfx.fillCircle(31, 51, 3);
      gfx.lineStyle(4, 0x276f45, 0.35);
      gfx.strokeCircle(52, 46, 30);
    });

    make('wellTexture', 78, 84, (gfx) => {
      gfx.fillStyle(0x6d95bd, 1);
      gfx.fillEllipse(39, 58, 48, 20);
      gfx.fillStyle(0xd7edf8, 1);
      gfx.fillEllipse(39, 50, 46, 18);
      gfx.fillStyle(0x9a7145, 1);
      gfx.fillRect(21, 28, 6, 34);
      gfx.fillRect(51, 28, 6, 34);
      gfx.fillStyle(0xf3b85e, 1);
      gfx.fillTriangle(16, 30, 39, 8, 62, 30);
      gfx.lineStyle(3, 0x735239, 0.6);
      gfx.strokeEllipse(39, 50, 46, 18);
    });

    make('lampTexture', 46, 94, (gfx) => {
      gfx.fillStyle(0x664735, 1);
      gfx.fillRoundedRect(20, 34, 6, 46, 3);
      gfx.fillStyle(0xffef9b, 1);
      gfx.fillCircle(23, 26, 12);
      gfx.fillStyle(0xffffff, 0.6);
      gfx.fillCircle(19, 22, 4);
      gfx.lineStyle(3, 0x74533a, 0.7);
      gfx.strokeCircle(23, 26, 12);
      gfx.strokeRoundedRect(14, 80, 18, 7, 3);
    });

    make('signTexture', 70, 80, (gfx) => {
      gfx.fillStyle(0x7b5232, 1);
      gfx.fillRoundedRect(32, 26, 6, 48, 3);
      gfx.fillStyle(0xb9783d, 1);
      gfx.fillRoundedRect(12, 22, 46, 22, 5);
      gfx.fillStyle(0xffe6a3, 1);
      gfx.fillCircle(48, 33, 3);
      gfx.lineStyle(3, 0x704b32, 0.7);
      gfx.strokeRoundedRect(12, 22, 46, 22, 5);
    });

    make('chestTexture', 72, 58, (gfx) => {
      gfx.fillStyle(0xffdf7a, 0.35);
      gfx.fillEllipse(36, 44, 54, 12);
      gfx.fillStyle(0x9a6033, 1);
      gfx.fillRoundedRect(14, 24, 44, 22, 5);
      gfx.fillStyle(0xd5893e, 1);
      gfx.fillRoundedRect(14, 17, 44, 18, 8);
      gfx.fillStyle(0xffd45b, 1);
      gfx.fillRoundedRect(32, 27, 8, 12, 3);
      gfx.lineStyle(3, 0x66442a, 0.7);
      gfx.strokeRoundedRect(14, 24, 44, 22, 5);
      gfx.strokeRoundedRect(14, 17, 44, 18, 8);
    });

    make('coinTexture', 36, 36, (gfx) => {
      gfx.fillStyle(0xffcf4d, 1);
      gfx.fillCircle(18, 18, 13);
      gfx.fillStyle(0xfff3a6, 0.9);
      gfx.fillCircle(14, 13, 4);
      gfx.lineStyle(3, 0xbc842d, 0.9);
      gfx.strokeCircle(18, 18, 13);
    });

    make('heartTexture', 38, 36, (gfx) => {
      gfx.fillStyle(0xf05c78, 1);
      gfx.fillCircle(14, 14, 8);
      gfx.fillCircle(24, 14, 8);
      gfx.fillTriangle(7, 17, 31, 17, 19, 32);
      gfx.fillStyle(0xffb5c4, 0.75);
      gfx.fillCircle(13, 12, 3);
    });

    make('manaTexture', 38, 38, (gfx) => {
      gfx.fillStyle(0x76d9ff, 1);
      gfx.fillCircle(19, 19, 13);
      gfx.fillStyle(0xffffff, 0.7);
      gfx.fillCircle(15, 14, 4);
      gfx.lineStyle(3, 0x348fce, 0.8);
      gfx.strokeCircle(19, 19, 13);
    });

    make('xpTexture', 42, 42, (gfx) => {
      gfx.fillStyle(0xffec73, 1);
      const points = [];
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0 ? 17 : 7;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push(new Phaser.Geom.Point(21 + Math.cos(a) * r, 21 + Math.sin(a) * r));
      }
      gfx.fillPoints(points, true);
      gfx.lineStyle(3, 0xd49a28, 0.7);
      gfx.strokePoints(points, true);
    });

    make('swordIconTexture', 48, 48, (gfx) => {
      gfx.fillStyle(0x8fd5ff, 1);
      gfx.fillTriangle(26, 6, 34, 27, 19, 27);
      gfx.fillStyle(0x9b6a39, 1);
      gfx.fillRoundedRect(20, 27, 8, 13, 3);
      gfx.fillStyle(0xffd86b, 1);
      gfx.fillRoundedRect(12, 26, 24, 6, 3);
      gfx.lineStyle(2, 0x5f4a36, 0.8);
      gfx.strokeTriangle(26, 6, 34, 27, 19, 27);
    });

    make('bowIconTexture', 48, 48, (gfx) => {
      gfx.lineStyle(5, 0x9a6238, 1);
      gfx.beginPath();
      gfx.arc(24, 24, 16, -1.2, 1.2, false);
      gfx.strokePath();
      gfx.lineStyle(2, 0xf7efd2, 1);
      gfx.lineBetween(31, 9, 31, 39);
      gfx.fillStyle(0x7fd6ff, 1);
      gfx.fillTriangle(9, 24, 23, 18, 23, 30);
    });

    make('spellIconTexture', 48, 48, (gfx) => {
      gfx.fillStyle(0x8ae7ff, 1);
      gfx.fillCircle(24, 24, 13);
      gfx.fillStyle(0xfff49a, 1);
      gfx.fillCircle(24, 8, 4);
      gfx.fillCircle(40, 24, 4);
      gfx.fillCircle(24, 40, 4);
      gfx.fillCircle(8, 24, 4);
      gfx.lineStyle(3, 0x4b9ed1, 0.8);
      gfx.strokeCircle(24, 24, 13);
    });

    make('bootIconTexture', 48, 48, (gfx) => {
      gfx.fillStyle(0xcf7b45, 1);
      gfx.fillRoundedRect(15, 13, 15, 24, 5);
      gfx.fillRoundedRect(23, 28, 17, 9, 4);
      gfx.fillStyle(0xffd86b, 1);
      gfx.fillRect(16, 20, 14, 4);
      gfx.lineStyle(3, 0x6f4a31, 0.75);
      gfx.strokeRoundedRect(15, 13, 15, 24, 5);
    });

    make('shieldIconTexture', 48, 48, (gfx) => {
      gfx.fillStyle(0x7ee0aa, 1);
      gfx.fillTriangle(24, 7, 39, 15, 34, 34);
      gfx.fillTriangle(24, 7, 9, 15, 14, 34);
      gfx.fillTriangle(14, 34, 34, 34, 24, 43);
      gfx.fillStyle(0xffffff, 0.45);
      gfx.fillTriangle(24, 11, 31, 17, 24, 35);
      gfx.lineStyle(3, 0x378c63, 0.8);
      gfx.strokeTriangle(24, 7, 39, 15, 34, 34);
      gfx.strokeTriangle(24, 7, 9, 15, 14, 34);
    });
  }

  isoToScreen(x, y, z = 0) {
    return {
      x: ORIGIN.x + (x - y) * (TILE_W / 2),
      y: ORIGIN.y + (x + y) * (TILE_H / 2) - z,
    };
  }

  screenToIso(x, y) {
    const sx = x - ORIGIN.x;
    const sy = y - ORIGIN.y;
    return {
      x: sy / TILE_H + sx / TILE_W,
      y: sy / TILE_H - sx / TILE_W,
    };
  }

  clampIso(point, padding = 0.5) {
    point.x = Phaser.Math.Clamp(point.x, padding, MAP_W - 1 - padding);
    point.y = Phaser.Math.Clamp(point.y, padding, MAP_H - 1 - padding);
    return point;
  }

  createBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom, 1);
    bg.fillRect(0, 0, WIDTH, HEIGHT);
    bg.fillStyle(0x68c878, 1);
    bg.fillEllipse(WIDTH / 2, 696, 1240, 280);
    bg.fillStyle(0xcdf7f2, 0.45);
    bg.fillEllipse(200, 108, 190, 38);
    bg.fillEllipse(1010, 76, 250, 48);
    bg.fillEllipse(700, 138, 180, 34);
    this.worldLayer.add(bg);
    const board = this.add.image(WIDTH / 2, HEIGHT / 2, 'villageBoard')
      .setDisplaySize(WIDTH, HEIGHT)
      .setAlpha(0.88);
    this.worldLayer.add(board);
  }

  createVillage() {
    this.tileGraphics = this.add.graphics();
    this.tileGraphics.setAlpha(0.15);
    this.worldLayer.add(this.tileGraphics);
    this.drawMapTiles();
    this.createPathStones();
    this.createForestBorder();
    this.createBuildings();
    this.createProps();
  }

  drawMapTiles() {
    for (let y = 0; y < MAP_H; y += 1) {
      for (let x = 0; x < MAP_W; x += 1) {
        const center = this.isoToScreen(x, y);
        const isEdge = x < 2 || y < 2 || x > MAP_W - 3 || y > MAP_H - 3;
        const isPath = Math.abs(x - 7) <= 1 || Math.abs(y - 7) <= 1 || (x > 4 && x < 11 && y > 4 && y < 11);
        const isGarden = (x === 4 && y === 10) || (x === 10 && y === 4) || (x === 3 && y === 6);
        let fill = (x + y) % 2 === 0 ? COLORS.grassA : COLORS.grassB;
        let stroke = 0x5dbb65;
        if (isEdge) {
          fill = COLORS.forest;
          stroke = 0x3e965e;
        } else if (isPath) {
          fill = COLORS.path;
          stroke = COLORS.pathEdge;
        } else if (isGarden) {
          fill = COLORS.garden;
          stroke = 0xdf729f;
        }
        this.drawDiamond(center.x, center.y, TILE_W, TILE_H, fill, stroke, 0.96);
      }
    }
  }

  drawDiamond(x, y, w, h, fill, stroke, alpha = 1) {
    this.tileGraphics.fillStyle(fill, alpha);
    this.tileGraphics.lineStyle(1, stroke, 0.45);
    this.tileGraphics.beginPath();
    this.tileGraphics.moveTo(x, y - h / 2);
    this.tileGraphics.lineTo(x + w / 2, y);
    this.tileGraphics.lineTo(x, y + h / 2);
    this.tileGraphics.lineTo(x - w / 2, y);
    this.tileGraphics.closePath();
    this.tileGraphics.fillPath();
    this.tileGraphics.strokePath();
  }

  createPathStones() {
    const stones = this.add.graphics();
    stones.fillStyle(0xe6d3a6, 0.55);
    for (let y = 3; y < 12; y += 1) {
      for (let x = 6; x <= 8; x += 1) {
        const p = this.isoToScreen(x + 0.12 * Math.sin(y), y + 0.18 * Math.cos(x));
        stones.fillEllipse(p.x, p.y, 10 + ((x + y) % 3) * 3, 5, 1);
      }
    }
    for (let x = 3; x < 12; x += 1) {
      for (let y = 6; y <= 8; y += 1) {
        const p = this.isoToScreen(x + 0.15 * Math.cos(y), y + 0.1 * Math.sin(x));
        stones.fillEllipse(p.x, p.y, 9 + ((x * y) % 3) * 2, 5, 1);
      }
    }
    stones.setAlpha(0.42);
    this.worldLayer.add(stones);
  }

  createForestBorder() {
    const treeSpots = [
      [0.5, 1.2, 1.0], [2.2, 0.6, 0.8], [4.5, 0.7, 0.95], [7.3, 0.4, 1.1], [10.2, 0.7, 0.9], [13.4, 1.0, 1.0],
      [0.4, 4.4, 0.8], [0.8, 9.7, 0.95], [2.0, 13.4, 1.0], [5.4, 14.0, 0.85], [9.2, 13.5, 1.08], [13.0, 12.3, 0.9],
      [14.1, 4.0, 1.0], [13.7, 7.4, 0.85], [14.2, 10.5, 0.95],
    ];
    treeSpots.forEach(([x, y, scale], index) => {
      const p = this.isoToScreen(x, y, 16);
      this.addFireflyCluster(p.x, p.y - 34 * scale, index);
    });
  }

  createBuildings() {
    const buildingData = [
      { name: 'Castle', x: 7, y: 4, hp: 110, max: 110, texture: 'castleTexture', size: [112, 96], reward: 24 },
      { name: 'Bakery', x: 4, y: 7, hp: 76, max: 76, texture: 'bakeryTexture', size: [80, 70], reward: 16 },
      { name: 'Cottage', x: 10, y: 7, hp: 74, max: 74, texture: 'cottageTexture', size: [78, 68], reward: 15 },
      { name: 'Market', x: 7, y: 10, hp: 68, max: 68, texture: 'marketTexture', size: [90, 66], reward: 18 },
    ];
    this.buildings = buildingData.map((data) => {
      const p = this.isoToScreen(data.x, data.y, 18);
      const base = this.add.graphics();
      base.fillStyle(0x8f7346, 0.14);
      base.fillEllipse(p.x, p.y + 22, data.size[0] * 0.62, 28);
      const sprite = this.add.image(p.x, p.y, data.texture)
        .setOrigin(0.5, 0.84)
        .setDisplaySize(data.size[0], data.size[1])
        .setDepth(p.y)
        .setAlpha(0.74);
      const repairIcon = this.add.container(p.x + data.size[0] * 0.34, p.y - data.size[1] * 0.58).setVisible(false).setDepth(p.y + 140);
      const badge = this.add.circle(0, 0, 15, 0xfff0a3, 1).setStrokeStyle(3, 0xf3a44d, 1);
      const mark = this.add.text(0, -1, '!', {
        fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
        fontSize: '21px',
        color: '#7f521e',
      }).setOrigin(0.5);
      repairIcon.add([badge, mark]);
      this.entityLayer.add([base, sprite, repairIcon]);
      return { ...data, iso: { x: data.x, y: data.y }, sprite, base, repairIcon, underAttackUntil: 0 };
    });
  }

  createProps() {
    const props = [
      ['wellTexture', 6.1, 8.8, 44, 52], ['lampTexture', 8.8, 5.8, 26, 54], ['signTexture', 3.7, 9.7, 38, 46],
      ['lampTexture', 10.8, 4.8, 26, 54], ['wellTexture', 12.1, 9.3, 42, 46], ['signTexture', 2.9, 3.2, 38, 46],
    ];
    props.forEach(([texture, x, y, w, h]) => {
      const p = this.isoToScreen(x, y, 7);
      const sprite = this.add.image(p.x, p.y, texture)
        .setOrigin(0.5, 0.82)
        .setDisplaySize(w, h)
        .setDepth(p.y + 8)
        .setAlpha(0.7);
      this.entityLayer.add(sprite);
    });
  }

  addFireflyCluster(x, y, seed) {
    for (let i = 0; i < 3; i += 1) {
      const dot = this.add.circle(x + Math.cos(seed + i) * 18, y + Math.sin(seed * 2 + i) * 12, 2.8, 0xfff7a6, 0.85);
      dot.setDepth(y + 30 + i);
      this.tweens.add({
        targets: dot,
        x: dot.x + Math.sin(seed + i) * 12,
        y: dot.y - 8 - i * 3,
        alpha: 0.35,
        yoyo: true,
        repeat: -1,
        duration: 1500 + i * 230,
        ease: 'Sine.inOut',
      });
      this.entityLayer.add(dot);
    }
  }

  createPlayer() {
    const start = this.isoToScreen(7, 7, 18);
    this.player = {
      iso: { x: 7, y: 7 },
      facing: { x: 0, y: 1 },
      lastAttack: 0,
      lastBow: 0,
      lastSpell: 0,
      invulnerableUntil: 0,
      actionLockUntil: 0,
      shadow: this.add.ellipse(start.x, start.y + 13, 44, 18, 0x325631, 0.24),
      sprite: this.add.sprite(start.x, start.y, 'heroSheet', 'hero-0-0')
        .setOrigin(0.5, 0.76)
        .setDisplaySize(76, 76)
        .setDepth(start.y + 40),
    };
    if (!this.anims.exists('hero-idle')) {
      this.anims.create({
        key: 'hero-idle',
        frames: [0, 1, 2, 3].map((col) => ({ key: 'heroSheet', frame: `hero-0-${col}` })),
        frameRate: 3,
        repeat: -1,
      });
    }
    if (!this.anims.exists('hero-walk')) {
      this.anims.create({
        key: 'hero-walk',
        frames: Array.from({ length: 8 }, (_, col) => ({ key: 'heroSheet', frame: `hero-1-${col}` })),
        frameRate: 9,
        repeat: -1,
      });
    }
    if (!this.anims.exists('hero-melee')) {
      this.anims.create({
        key: 'hero-melee',
        frames: Array.from({ length: 8 }, (_, col) => ({ key: 'heroSheet', frame: `hero-2-${col}` })),
        frameRate: 16,
        repeat: 0,
      });
    }
    if (!this.anims.exists('hero-special')) {
      this.anims.create({
        key: 'hero-special',
        frames: Array.from({ length: 8 }, (_, col) => ({ key: 'heroSheet', frame: `hero-3-${col}` })),
        frameRate: 12,
        repeat: 0,
      });
    }
    this.player.sprite.play('hero-idle');
    this.entityLayer.add([this.player.shadow, this.player.sprite]);
  }

  createControls() {
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      melee: Phaser.Input.Keyboard.KeyCodes.SPACE,
      bow: Phaser.Input.Keyboard.KeyCodes.F,
      spell: Phaser.Input.Keyboard.KeyCodes.Q,
      spellAlt: Phaser.Input.Keyboard.KeyCodes.R,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      inventory: Phaser.Input.Keyboard.KeyCodes.I,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      five: Phaser.Input.Keyboard.KeyCodes.FIVE,
      six: Phaser.Input.Keyboard.KeyCodes.SIX,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
    });
    this.input.on('pointerdown', (pointer) => {
      this.ensureAudio();
      if (this.state.phase === 'playing' && pointer.leftButtonDown()) {
        this.fireBow(this.time.now);
      }
    });
    this.input.keyboard.on('keydown', () => this.ensureAudio());
    this.keys.inventory.on('down', () => this.toggleInventory());
    this.keys.interact.on('down', () => this.tryOpenChest());
    [this.keys.one, this.keys.two, this.keys.three, this.keys.four, this.keys.five, this.keys.six].forEach((key, index) => {
      key.on('down', () => {
        if (this.state.phase === 'levelUp' && index < 3) {
          this.chooseLevelUpgrade(index);
        } else {
          this.buyUpgrade(index);
        }
      });
    });
    this.keys.restart.on('down', () => {
      if (this.state.phase === 'gameOver') this.scene.restart();
    });
  }

  createAudio() {
    this.audio = {
      context: null,
      ready: false,
    };
  }

  ensureAudio() {
    if (this.audio.ready) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.audio.context = this.audio.context || new AudioContext();
    if (this.audio.context.state === 'suspended') {
      this.audio.context.resume();
    }
    this.audio.ready = true;
  }

  playTone(type = 'sparkle') {
    if (!this.audio.ready || !this.audio.context) return;
    const ctx = this.audio.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const profile = {
      sparkle: [740, 0.08, 'triangle', 0.045],
      chest: [980, 0.18, 'sine', 0.06],
      hit: [360, 0.07, 'square', 0.025],
      level: [620, 0.22, 'triangle', 0.07],
      bow: [520, 0.06, 'triangle', 0.032],
    }[type] || [620, 0.1, 'sine', 0.04];
    osc.type = profile[2];
    osc.frequency.setValueAtTime(profile[0], now);
    osc.frequency.exponentialRampToValueAtTime(profile[0] * 1.42, now + profile[1]);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(profile[3], now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + profile[1] + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + profile[1] + 0.055);
  }

  updatePointerIso() {
    this.lastPointerIso = this.clampIso(this.screenToIso(this.input.activePointer.x, this.input.activePointer.y), 0.1);
  }

  updatePlayer(dt, time) {
    if (this.state.health <= 0) return;
    let dx = 0;
    let dy = 0;
    if (this.keys.left.isDown || this.keys.a.isDown) dx -= 1;
    if (this.keys.right.isDown || this.keys.d.isDown) dx += 1;
    if (this.keys.up.isDown || this.keys.w.isDown) dy -= 1;
    if (this.keys.down.isDown || this.keys.s.isDown) dy += 1;

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.player.facing = { x: dx, y: dy };
      this.player.iso.x += dx * this.playerStats.speed * dt;
      this.player.iso.y += dy * this.playerStats.speed * dt;
      this.clampIso(this.player.iso, 1.2);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.melee)) {
      this.swingSword(time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.bow)) {
      this.fireBow(time);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.spell) || Phaser.Input.Keyboard.JustDown(this.keys.spellAlt)) {
      this.castSpell(time);
    }

    const p = this.isoToScreen(this.player.iso.x, this.player.iso.y, 18);
    this.player.sprite.setPosition(p.x, p.y);
    this.player.shadow.setPosition(p.x, p.y + 15);
    this.player.sprite.setFlipX(this.player.facing.x < -0.05);

    if (time > this.player.actionLockUntil) {
      const desiredAnim = moving ? 'hero-walk' : 'hero-idle';
      if (this.player.sprite.anims.currentAnim?.key !== desiredAnim) {
        this.player.sprite.play(desiredAnim);
      }
    }
    this.player.sprite.setAlpha(time < this.player.invulnerableUntil ? 0.62 + Math.sin(time / 50) * 0.18 : 1);
  }

  swingSword(time) {
    if (time - this.player.lastAttack < 430) return;
    this.ensureAudio();
    this.player.lastAttack = time;
    this.player.actionLockUntil = time + 300;
    this.state.equipped = 'Wooden Sword';
    this.player.sprite.play('hero-melee', true);
    this.playTone('sparkle');
    const reach = 1.48;
    const center = {
      x: this.player.iso.x + this.player.facing.x * 0.85,
      y: this.player.iso.y + this.player.facing.y * 0.85,
    };
    const screen = this.isoToScreen(center.x, center.y, 20);
    this.spawnSparkleBurst(screen.x, screen.y, 0xfff0a2, 9, 0.75);
    this.enemies.forEach((enemy) => {
      const dist = Phaser.Math.Distance.Between(center.x, center.y, enemy.iso.x, enemy.iso.y);
      if (dist <= reach) {
        this.damageEnemy(enemy, this.playerStats.swordPower, 'bonk');
        enemy.iso.x += this.player.facing.x * 0.24;
        enemy.iso.y += this.player.facing.y * 0.24;
      }
    });
  }

  fireBow(time) {
    if (time - this.player.lastBow < this.playerStats.bowCooldown) return;
    this.ensureAudio();
    this.player.lastBow = time;
    this.player.actionLockUntil = time + 260;
    this.state.equipped = 'Guild Bow';
    this.player.sprite.play('hero-special', true);
    this.playTone('bow');
    const startIso = { x: this.player.iso.x, y: this.player.iso.y };
    const target = this.lastPointerIso;
    let vx = target.x - startIso.x;
    let vy = target.y - startIso.y;
    const len = Math.max(0.01, Math.hypot(vx, vy));
    vx /= len;
    vy /= len;
    this.player.facing = { x: vx, y: vy };
    const p = this.isoToScreen(startIso.x, startIso.y, 18);
    const arrow = this.add.container(p.x, p.y - 24).setDepth(p.y + 120);
    const shaft = this.add.rectangle(0, 0, 32, 5, 0xffe6a3, 1).setStrokeStyle(1, 0x9d6d3f, 1);
    const tip = this.add.triangle(18, 0, 0, -6, 0, 6, 10, 0, 0x82d5ff, 1);
    arrow.add([shaft, tip]);
    const screenDir = this.isoToScreen(startIso.x + vx, startIso.y + vy, 18);
    arrow.rotation = Phaser.Math.Angle.Between(p.x, p.y, screenDir.x, screenDir.y);
    this.projectiles.push({
      type: 'arrow',
      iso: { x: startIso.x + vx * 0.45, y: startIso.y + vy * 0.45 },
      velocity: { x: vx * 8.2, y: vy * 8.2 },
      power: this.playerStats.bowPower,
      range: 6.8 + this.state.level * 0.35,
      distance: 0,
      sprite: arrow,
    });
    this.fxLayer.add(arrow);
  }

  castSpell(time) {
    if (time - this.player.lastSpell < 780 || this.state.mana < this.playerStats.spellCost) {
      if (this.state.mana < this.playerStats.spellCost) {
        this.addGuildNote('Mana is refilling with sparkles.');
      }
      return;
    }
    this.ensureAudio();
    this.player.lastSpell = time;
    this.state.mana -= this.playerStats.spellCost;
    this.player.actionLockUntil = time + 430;
    this.state.equipped = 'Sparkle Spell';
    this.player.sprite.play('hero-special', true);
    this.playTone('level');
    const center = {
      x: Phaser.Math.Clamp(this.lastPointerIso.x, this.player.iso.x - 4.2, this.player.iso.x + 4.2),
      y: Phaser.Math.Clamp(this.lastPointerIso.y, this.player.iso.y - 4.2, this.player.iso.y + 4.2),
    };
    const p = this.isoToScreen(center.x, center.y, 16);
    this.spawnSpellBloom(p.x, p.y - 8, 1 + this.playerStats.spellPower * 0.08);
    this.enemies.forEach((enemy) => {
      const dist = Phaser.Math.Distance.Between(center.x, center.y, enemy.iso.x, enemy.iso.y);
      if (dist < 2.05) {
        this.damageEnemy(enemy, this.playerStats.spellPower, 'sparkles');
        enemy.dazedUntil = time + 750;
      }
    });
  }

  createUpgrades() {
    this.upgrades = [
      {
        name: 'Sword',
        detail: '+1 soft bonk',
        cost: 55,
        level: 0,
        icon: 'swordIconTexture',
        apply: () => {
          this.playerStats.swordPower += 1;
          this.addGuildNote('Your wooden sword feels braver!');
        },
      },
      {
        name: 'Bow',
        detail: 'faster shots',
        cost: 50,
        level: 0,
        icon: 'bowIconTexture',
        apply: () => {
          this.playerStats.bowCooldown = Math.max(250, this.playerStats.bowCooldown - 80);
          this.playerStats.bowPower += this.upgrades[1].level % 2 === 0 ? 1 : 0;
          this.addGuildNote('Your bow twangs a little quicker.');
        },
      },
      {
        name: 'Mana',
        detail: '+25 pool',
        cost: 45,
        level: 0,
        icon: 'manaTexture',
        apply: () => {
          this.playerStats.maxMana += 25;
          this.state.mana = this.playerStats.maxMana;
          this.addGuildNote('Level up feeling: more mana bubbles!');
        },
      },
      {
        name: 'Spell',
        detail: '+spark area',
        cost: 65,
        level: 0,
        icon: 'spellIconTexture',
        apply: () => {
          this.playerStats.spellPower += 1;
          this.playerStats.spellCost = Math.max(16, this.playerStats.spellCost - 2);
          this.addGuildNote('Sparkle Burst learned a bigger twirl.');
        },
      },
      {
        name: 'Boots',
        detail: '+speed',
        cost: 60,
        level: 0,
        icon: 'bootIconTexture',
        apply: () => {
          this.playerStats.speed += 0.28;
          this.addGuildNote('Swift guild boots make patrols breezy.');
        },
      },
      {
        name: 'Shield',
        detail: '+heart',
        cost: 70,
        level: 0,
        icon: 'shieldIconTexture',
        apply: () => {
          this.playerStats.maxHealth += 1;
          this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + 2);
          this.addGuildNote('A sunny shield charm circles you.');
          this.spawnShieldGlow();
        },
      },
    ];
  }

  buyUpgrade(index) {
    if (this.state.phase !== 'playing') return;
    if (!this.state.inventoryOpen) return;
    const upgrade = this.upgrades[index];
    if (!upgrade) return;
    const price = upgrade.cost + upgrade.level * 25;
    if (this.state.gold < price) {
      this.addGuildNote(`${upgrade.name} needs ${price} gold.`);
      this.playTone('hit');
      return;
    }
    this.state.gold -= price;
    upgrade.level += 1;
    upgrade.apply();
    this.playTone('level');
    this.rebuildInventoryPanel();
  }

  spawnInitialChests() {
    [
      { x: 3.5, y: 3.5, reward: 'gold' },
      { x: 11.4, y: 3.2, reward: 'mana' },
      { x: 3.1, y: 11.1, reward: 'xp' },
      { x: 11.6, y: 11.4, reward: 'heart' },
    ].forEach((data) => this.spawnChest(data.x, data.y, data.reward));
  }

  spawnChest(x, y, reward = 'gold') {
    const p = this.isoToScreen(x, y, 10);
    const sprite = this.add.image(p.x, p.y, 'chestTexture')
      .setOrigin(0.5, 0.78)
      .setDisplaySize(58, 58)
      .setDepth(p.y + 60);
    const glow = this.add.circle(p.x, p.y - 22, 19, 0xfff2a4, 0.14).setDepth(p.y + 50);
    this.tweens.add({
      targets: glow,
      scale: 1.35,
      alpha: 0.34,
      yoyo: true,
      repeat: -1,
      duration: 1050,
      ease: 'Sine.inOut',
    });
    this.entityLayer.add([glow, sprite]);
    this.chests.push({ iso: { x, y }, sprite, glow, reward, opened: false, bob: Math.random() * 1000 });
  }

  updateChests(time) {
    this.chests.forEach((chest) => {
      if (chest.opened) return;
      const p = this.isoToScreen(chest.iso.x, chest.iso.y, 10 + Math.sin(time / 450 + chest.bob) * 2.5);
      chest.sprite.setPosition(p.x, p.y);
      chest.glow.setPosition(p.x, p.y - 20);
    });
  }

  tryOpenChest() {
    if (this.state.phase !== 'playing') return;
    const chest = this.chests.find((candidate) => !candidate.opened && Phaser.Math.Distance.Between(
      candidate.iso.x,
      candidate.iso.y,
      this.player.iso.x,
      this.player.iso.y,
    ) < 1.35);
    if (!chest) {
      this.addGuildNote('No chest close enough yet.');
      return;
    }
    chest.opened = true;
    this.playTone('chest');
    chest.sprite.setTint(0xfff2a4);
    this.tweens.add({
      targets: [chest.sprite, chest.glow],
      y: '-=22',
      alpha: 0,
      scale: 1.22,
      duration: 760,
      ease: 'Back.easeOut',
      onComplete: () => {
        chest.sprite.destroy();
        chest.glow.destroy();
      },
    });
    const p = this.isoToScreen(chest.iso.x, chest.iso.y, 18);
    this.spawnSparkleBurst(p.x, p.y - 22, 0xfff0a4, 20, 1.1);
    this.grantChestReward(chest.reward);
    if (Phaser.Math.Between(0, 100) < 45) {
      const edge = Phaser.Math.RND.pick([
        { x: Phaser.Math.Between(2, 12), y: 1.8 },
        { x: 1.8, y: Phaser.Math.Between(2, 12) },
        { x: Phaser.Math.Between(2, 12), y: 13.2 },
        { x: 13.2, y: Phaser.Math.Between(2, 12) },
      ]);
      this.time.delayedCall(2200, () => {
        if (this.state.phase !== 'playing') return;
        this.spawnChest(edge.x, edge.y, Phaser.Math.RND.pick(['gold', 'gold', 'xp', 'mana', 'heart', 'buff']));
        this.addGuildNote('A chest appeared near the old oak!');
      });
    }
  }

  grantChestReward(reward) {
    if (reward === 'mana') {
      this.state.mana = this.playerStats.maxMana;
      this.addGuildNote('You found a blue mana orb!');
    } else if (reward === 'xp') {
      this.gainXp(38);
      this.addGuildNote('You found a swirl of XP stars!');
    } else if (reward === 'heart') {
      this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + 2);
      this.addGuildNote('A heart charm patched you up.');
    } else if (reward === 'buff') {
      this.playerStats.speed += 0.45;
      this.time.delayedCall(8500, () => {
        this.playerStats.speed -= 0.45;
        this.addGuildNote('The quick-step sparkle faded.');
      });
      this.addGuildNote('Temporary quick-step sparkle!');
    } else {
      const amount = Phaser.Math.Between(22, 42);
      this.state.gold += amount;
      this.addGuildNote(`You found ${amount} gold!`);
    }
  }

  clearLevelTimers() {
    this.levelTimers.forEach((timer) => timer.remove(false));
    this.levelTimers = [];
  }

  addLevelTimer(delay, callback) {
    const timer = this.time.delayedCall(delay, callback);
    this.levelTimers.push(timer);
    return timer;
  }

  startLevelCountdown() {
    this.clearLevelTimers();
    this.state.phase = 'countdown';
    this.state.inventoryOpen = false;
    this.inventoryPanel?.setVisible(false);
    this.levelSpawnsPending = 0;
    this.levelEnemiesRemaining = 0;
    this.levelClearQueued = false;
    this.levelUpOverlay?.setVisible(false);
    this.gameOverOverlay?.setVisible(false);
    this.countdownOverlay?.setVisible(true);
    this.addGuildNote(`Level ${this.state.level} begins soon!`);

    const sequence = [`Level ${this.state.level}`, '3', '2', '1', 'Go!'];
    sequence.forEach((label, index) => {
      this.addLevelTimer(index * 780, () => {
        this.showCountdownLabel(label);
        if (label === 'Go!') this.playTone('level');
      });
    });
    this.addLevelTimer(sequence.length * 780, () => this.startLevelRound());
  }

  showCountdownLabel(label) {
    if (!this.countdownOverlay) return;
    this.countdownLevelText.setText(label.startsWith('Level') ? label : `Level ${this.state.level}`);
    this.countdownNumberText.setText(label.startsWith('Level') ? '' : label);
    this.countdownNumberText.setScale(label === 'Go!' ? 0.82 : 1);
    this.countdownOverlay.setAlpha(0.98);
    this.tweens.add({
      targets: this.countdownNumberText,
      scale: label === 'Go!' ? 1.05 : 1.18,
      yoyo: true,
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }

  startLevelRound() {
    if (this.state.phase !== 'countdown') return;
    this.state.phase = 'playing';
    this.countdownOverlay?.setVisible(false);
    this.levelClearQueued = false;

    const level = this.state.level;
    const count = Math.min(4 + level * 2, 22);
    this.levelSpawnsPending = count;
    this.levelEnemiesRemaining = count;
    this.addGuildNote(`Level ${level}: forest friends are on the move!`);

    for (let i = 0; i < count; i += 1) {
      this.addLevelTimer(560 + i * Math.max(250, 760 - level * 30), () => {
        if (this.state.phase !== 'playing') return;
        this.levelSpawnsPending = Math.max(0, this.levelSpawnsPending - 1);
        const spawned = this.spawnEnemy(level);
        if (!spawned) {
          this.levelEnemiesRemaining = Math.max(0, this.levelEnemiesRemaining - 1);
        }
        this.checkLevelClear();
      });
    }
  }

  checkLevelClear() {
    if (this.state.phase !== 'playing' || this.levelClearQueued) return;
    if (this.levelSpawnsPending <= 0 && this.levelEnemiesRemaining <= 0) {
      this.levelClearQueued = true;
      this.addLevelTimer(720, () => this.completeLevel());
    }
  }

  completeLevel() {
    if (this.state.phase !== 'playing') return;
    this.state.phase = 'levelUp';
    this.state.inventoryOpen = false;
    this.inventoryPanel?.setVisible(false);
    this.clearProjectiles();
    this.clearRetreatingEnemies();
    const reward = 20 + this.state.level * 8;
    this.state.gold += reward;
    this.gainXp(28 + this.state.level * 10);
    this.addGuildNote(`Level ${this.state.level} clear! +${reward} gold`);
    this.showLevelUpScreen();
  }

  getEnemyTarget() {
    const aliveBuildings = this.buildings.filter((building) => building.hp > 0);
    const castle = this.buildings.find((building) => building.name === 'Castle');
    if (!castle || castle.hp <= 0) {
      this.enterGameOver('The castle needs a rescue rest!');
      return null;
    }
    const villageTargets = aliveBuildings.filter((building) => building.name !== 'Castle');
    return Phaser.Math.RND.pick(villageTargets.length > 0 ? villageTargets : [castle]);
  }

  spawnEnemy(level) {
    if (this.state.phase !== 'playing') return false;
    const target = this.getEnemyTarget();
    if (!target) return false;
    const side = Phaser.Math.Between(0, 3);
    let iso;
    if (side === 0) iso = { x: Phaser.Math.FloatBetween(1.4, 13.3), y: 1.1 };
    else if (side === 1) iso = { x: 13.7, y: Phaser.Math.FloatBetween(1.4, 13.3) };
    else if (side === 2) iso = { x: Phaser.Math.FloatBetween(1.4, 13.3), y: 13.7 };
    else iso = { x: 1.1, y: Phaser.Math.FloatBetween(1.4, 13.3) };
    const type = Phaser.Math.Between(0, 4);
    const p = this.isoToScreen(iso.x, iso.y, 16);
    const size = 52 + (type % 3) * 7 + Math.min(level, 5) * 1.5;
    const shadow = this.add.ellipse(p.x, p.y + 13, size * 0.58, size * 0.22, 0x315133, 0.2);
    const sprite = this.add.sprite(p.x, p.y, 'monsterSheet', `monster-${type % 4}-${Phaser.Math.Between(0, 3)}`)
      .setOrigin(0.5, 0.76)
      .setDisplaySize(size, size)
      .setDepth(p.y + 50);
    const enemy = {
      type,
      iso,
      sprite,
      shadow,
      target,
      hp: 2 + Math.floor(level / 2) + (type === 2 ? 1 : 0),
      maxHp: 2 + Math.floor(level / 2) + (type === 2 ? 1 : 0),
      speed: 0.75 + level * 0.035 + type * 0.035,
      touchCooldown: 0,
      heroTouchCooldown: 0,
      dazedUntil: 0,
      wobble: Math.random() * Math.PI * 2,
      retreating: false,
      defeated: false,
    };
    this.enemies.push(enemy);
    this.entityLayer.add([shadow, sprite]);
    if (target.name === 'Bakery' && Phaser.Math.Between(0, 2) === 0) {
      this.addGuildNote('Mushroom sprites are heading toward the bakery!');
    }
    return true;
  }

  updateEnemies(dt, time) {
    this.enemies.slice().forEach((enemy) => {
      if (!enemy.retreating && enemy.target.hp <= 0) {
        const nextTarget = this.getEnemyTarget();
        if (!nextTarget) return;
        enemy.target = nextTarget;
      }
      const targetIso = enemy.retreating
        ? this.getNearestForestExit(enemy.iso)
        : enemy.target.iso;
      const dist = Phaser.Math.Distance.Between(enemy.iso.x, enemy.iso.y, targetIso.x, targetIso.y);
      if (time > enemy.dazedUntil && dist > 0.35) {
        const vx = (targetIso.x - enemy.iso.x) / dist;
        const vy = (targetIso.y - enemy.iso.y) / dist;
        enemy.iso.x += vx * enemy.speed * dt * (enemy.retreating ? 1.8 : 1);
        enemy.iso.y += vy * enemy.speed * dt * (enemy.retreating ? 1.8 : 1);
        enemy.sprite.setFlipX(vx < -0.02);
      }
      if (!enemy.retreating && dist <= 0.45 && time > enemy.touchCooldown) {
        enemy.touchCooldown = time + 1250;
        this.bumpBuilding(enemy.target, 4 + Math.floor(this.state.level / 3));
        this.playTone('hit');
      }
      const playerDist = Phaser.Math.Distance.Between(enemy.iso.x, enemy.iso.y, this.player.iso.x, this.player.iso.y);
      if (!enemy.retreating && playerDist <= 0.58 && time > enemy.heroTouchCooldown) {
        enemy.heroTouchCooldown = time + 1400;
        this.takePlayerDamage(1, enemy);
      }
      if (enemy.retreating && dist < 0.55) {
        this.removeEnemy(enemy, false);
      }
      const p = this.isoToScreen(enemy.iso.x, enemy.iso.y, 16 + Math.sin(time / 240 + enemy.wobble) * 2);
      enemy.sprite.setPosition(p.x, p.y);
      enemy.shadow.setPosition(p.x, p.y + 14);
      enemy.sprite.rotation = time < enemy.dazedUntil ? Math.sin(time / 65) * 0.1 : Math.sin(time / 220 + enemy.wobble) * 0.04;
    });
  }

  getNearestForestExit(iso) {
    const exits = [
      { x: iso.x, y: 0.8 },
      { x: 14.2, y: iso.y },
      { x: iso.x, y: 14.2 },
      { x: 0.8, y: iso.y },
    ];
    return exits.reduce((best, exit) => (
      Phaser.Math.Distance.Between(iso.x, iso.y, exit.x, exit.y)
      < Phaser.Math.Distance.Between(iso.x, iso.y, best.x, best.y) ? exit : best
    ), exits[0]);
  }

  damageEnemy(enemy, amount, reason) {
    if (!this.enemies.includes(enemy) || enemy.defeated) return;
    enemy.hp -= amount;
    enemy.dazedUntil = Math.max(enemy.dazedUntil, this.time.now + 240);
    enemy.sprite.setTint(reason === 'sparkles' ? 0xbdf6ff : 0xfff3a0);
    this.time.delayedCall(120, () => {
      if (enemy.sprite?.active) enemy.sprite.clearTint();
    });
    this.spawnSparkleBurst(enemy.sprite.x, enemy.sprite.y - 18, reason === 'sparkles' ? 0x9be7ff : 0xffed95, 7, 0.56);
    this.playTone('hit');
    if (enemy.hp <= 0) {
      enemy.defeated = true;
      this.levelEnemiesRemaining = Math.max(0, this.levelEnemiesRemaining - 1);
      enemy.retreating = true;
      enemy.sprite.setFrame(`monster-${enemy.type % 4}-${Phaser.Math.Between(4, 7)}`);
      enemy.sprite.setTint(0xffffff);
      enemy.speed += 0.55;
      this.gainXp(12 + this.state.level * 3);
      this.dropReward(enemy.iso.x, enemy.iso.y);
      this.addGuildNote(Phaser.Math.RND.pick([
        'A forest critter scampered home dazed.',
        'Sparkles solved that little mix-up.',
        'The village cheers your gentle defense!',
      ]));
      this.checkLevelClear();
    }
  }

  removeEnemy(enemy, animate = true) {
    this.enemies = this.enemies.filter((candidate) => candidate !== enemy);
    if (animate) {
      this.tweens.add({
        targets: [enemy.sprite, enemy.shadow],
        alpha: 0,
        scale: 0.4,
        duration: 420,
        ease: 'Back.easeIn',
        onComplete: () => {
          enemy.sprite.destroy();
          enemy.shadow.destroy();
        },
      });
    } else {
      enemy.sprite.destroy();
      enemy.shadow.destroy();
    }
  }

  clearRetreatingEnemies() {
    this.enemies.slice().forEach((enemy) => {
      if (enemy.defeated || enemy.retreating) {
        this.removeEnemy(enemy, true);
      }
    });
  }

  dropReward(x, y) {
    const roll = Phaser.Math.Between(0, 100);
    const type = roll < 58 ? 'gold' : roll < 76 ? 'mana' : roll < 90 ? 'heart' : 'xp';
    const texture = type === 'gold' ? 'coinTexture' : type === 'heart' ? 'heartTexture' : type === 'mana' ? 'manaTexture' : 'xpTexture';
    const p = this.isoToScreen(x, y, 12);
    const sprite = this.add.image(p.x, p.y - 16, texture)
      .setOrigin(0.5)
      .setDisplaySize(32, 32)
      .setDepth(p.y + 120);
    this.pickups.push({ type, iso: { x, y }, sprite, age: 0, value: Phaser.Math.Between(6, 15) });
    this.fxLayer.add(sprite);
  }

  updatePickups(dt) {
    this.pickups.slice().forEach((pickup) => {
      pickup.age += dt;
      const p = this.isoToScreen(pickup.iso.x, pickup.iso.y, 22 + Math.sin(pickup.age * 5) * 5);
      pickup.sprite.setPosition(p.x, p.y - 18);
      pickup.sprite.rotation += dt * 1.4;
      const close = Phaser.Math.Distance.Between(pickup.iso.x, pickup.iso.y, this.player.iso.x, this.player.iso.y) < 1.05;
      if (close || pickup.age > 8) {
        this.collectPickup(pickup);
      }
    });
  }

  collectPickup(pickup) {
    this.pickups = this.pickups.filter((candidate) => candidate !== pickup);
    if (pickup.type === 'gold') {
      this.state.gold += pickup.value;
      if (Phaser.Math.Between(0, 4) === 0) this.addGuildNote(`You found ${pickup.value} gold!`);
    } else if (pickup.type === 'heart') {
      this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + 1);
    } else if (pickup.type === 'mana') {
      this.state.mana = Math.min(this.playerStats.maxMana, this.state.mana + 22);
    } else {
      this.gainXp(20);
    }
    this.playTone('sparkle');
    this.tweens.add({
      targets: pickup.sprite,
      y: pickup.sprite.y - 32,
      alpha: 0,
      scale: 1.4,
      duration: 280,
      onComplete: () => pickup.sprite.destroy(),
    });
  }

  updateProjectiles(dt) {
    this.projectiles.slice().forEach((projectile) => {
      projectile.iso.x += projectile.velocity.x * dt;
      projectile.iso.y += projectile.velocity.y * dt;
      projectile.distance += Math.hypot(projectile.velocity.x * dt, projectile.velocity.y * dt);
      const p = this.isoToScreen(projectile.iso.x, projectile.iso.y, 24);
      projectile.sprite.setPosition(p.x, p.y - 8);
      const target = this.enemies.find((enemy) => Phaser.Math.Distance.Between(
        projectile.iso.x,
        projectile.iso.y,
        enemy.iso.x,
        enemy.iso.y,
      ) < 0.54);
      if (target) {
        this.damageEnemy(target, projectile.power, 'arrow');
        this.destroyProjectile(projectile);
      } else if (projectile.distance > projectile.range) {
        this.destroyProjectile(projectile);
      }
    });
  }

  destroyProjectile(projectile) {
    this.projectiles = this.projectiles.filter((candidate) => candidate !== projectile);
    this.tweens.add({
      targets: projectile.sprite,
      alpha: 0,
      scale: 0.45,
      duration: 150,
      onComplete: () => projectile.sprite.destroy(),
    });
  }

  clearProjectiles() {
    this.projectiles.splice(0).forEach((projectile) => projectile.sprite.destroy());
  }

  bumpBuilding(building, amount) {
    if (this.state.phase !== 'playing' || building.hp <= 0) return;
    building.hp = Math.max(0, building.hp - amount);
    building.underAttackUntil = this.time.now + 650;
    building.sprite.setTint(0xfff0a0);
    building.repairIcon.setVisible(true);
    this.tweens.add({
      targets: building.sprite,
      x: building.sprite.x + 5,
      yoyo: true,
      repeat: 3,
      duration: 44,
      onComplete: () => {
        if (building.hp > 0) building.sprite.clearTint();
      },
    });
    this.time.delayedCall(1500, () => {
      if (building.hp > 0 && this.time.now > building.underAttackUntil) building.repairIcon.setVisible(false);
    });
    if (building.hp <= 0) {
      building.hp = 0;
      building.repairIcon.setVisible(true);
      building.sprite.setTint(0xffc98c);
      this.state.villageSafety = Math.max(0, this.state.villageSafety - (building.name === 'Castle' ? 100 : 14));
      if (building.name === 'Castle') {
        this.addGuildNote('The castle needs a rescue rest!');
        this.enterGameOver('The castle needs a rescue rest!');
      } else {
        this.addGuildNote(`${building.name} needs repairs, but everyone is okay!`);
      }
      this.spawnSparkleBurst(building.sprite.x, building.sprite.y - 20, 0xffc785, 13, 0.85);
    }
  }

  updateVillageSafety() {
    const total = this.buildings.reduce((sum, building) => sum + building.hp / building.max, 0) / this.buildings.length;
    const target = Math.round(total * 100);
    this.state.villageSafety = Phaser.Math.Clamp(Math.round((this.state.villageSafety * 3 + target) / 4), 0, 100);
    if (this.state.villageSafety < 30 && this.state.health > 0) {
      this.addGuildNote('Village safety is low. Protect the buildings!');
    }
  }

  takePlayerDamage(amount, enemy) {
    if (this.state.phase !== 'playing' || this.time.now < this.player.invulnerableUntil) return;
    this.state.health = Math.max(0, this.state.health - amount);
    this.player.invulnerableUntil = this.time.now + 1650;
    if (enemy) {
      const dx = this.player.iso.x - enemy.iso.x;
      const dy = this.player.iso.y - enemy.iso.y;
      const len = Math.max(0.01, Math.hypot(dx, dy));
      this.player.iso.x += (dx / len) * 0.28;
      this.player.iso.y += (dy / len) * 0.28;
      this.clampIso(this.player.iso, 1.2);
    }
    this.playTone('hit');
    this.spawnSparkleBurst(this.player.sprite.x, this.player.sprite.y - 28, 0xffb3c1, 10, 0.66);
    if (this.state.health <= 0) {
      this.enterGameOver('Your hero ran out of hearts!');
    }
  }

  checkFailureState() {
    if (this.state.phase === 'gameOver') return;
    if (this.state.health <= 0) {
      this.enterGameOver('Your hero ran out of hearts!');
      return;
    }
    const castle = this.buildings.find((building) => building.name === 'Castle');
    if (castle && castle.hp <= 0) {
      this.enterGameOver('The castle needs a rescue rest!');
    }
  }

  enterGameOver(reason) {
    if (this.state.phase === 'gameOver') return;
    this.state.phase = 'gameOver';
    this.state.gameOverReason = reason;
    this.state.inventoryOpen = false;
    this.inventoryPanel?.setVisible(false);
    this.countdownOverlay?.setVisible(false);
    this.levelUpOverlay?.setVisible(false);
    this.clearLevelTimers();
    this.clearProjectiles();
    this.showGameOverScreen(reason);
    this.playTone('hit');
  }

  gainXp(amount) {
    this.state.xp += amount;
  }

  regenMana(amount) {
    this.state.mana = Math.min(this.playerStats.maxMana, this.state.mana + amount);
  }

  spawnSparkleBurst(x, y, color = 0xfff1a7, count = 10, scale = 1) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.2, 0.2);
      const radius = Phaser.Math.FloatBetween(15, 44) * scale;
      const particle = this.add.circle(x, y, Phaser.Math.FloatBetween(2.4, 5.2) * scale, color, 0.9);
      particle.setDepth(y + 260 + i);
      this.fxLayer.add(particle);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius - Phaser.Math.Between(8, 24),
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(360, 720),
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  spawnSpellBloom(x, y, scale = 1) {
    const ring = this.add.circle(x, y, 18, 0x9eefff, 0.16).setStrokeStyle(3, 0xd9fbff, 0.85);
    const burst = this.add.image(x, y, 'spellIconTexture')
      .setOrigin(0.5)
      .setDisplaySize(92 * scale, 92 * scale)
      .setAlpha(0.92)
      .setDepth(y + 300);
    ring.setDepth(y + 299);
    this.fxLayer.add([ring, burst]);
    this.spawnSparkleBurst(x, y, 0xa5efff, 18, scale);
    this.tweens.add({
      targets: [ring, burst],
      scale: 2.8 * scale,
      alpha: 0,
      rotation: Math.PI,
      duration: 620,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy();
        burst.destroy();
      },
    });
  }

  spawnShieldGlow() {
    const glow = this.add.circle(this.player.sprite.x, this.player.sprite.y - 24, 34, 0x8ef6c0, 0.16)
      .setStrokeStyle(3, 0xd7ffe5, 0.8)
      .setDepth(this.player.sprite.depth + 20);
    this.fxLayer.add(glow);
    this.tweens.add({
      targets: glow,
      scale: 1.8,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onUpdate: () => glow.setPosition(this.player.sprite.x, this.player.sprite.y - 24),
      onComplete: () => glow.destroy(),
    });
  }

  updateEffects(dt) {
    this.effects = this.effects.filter((effect) => {
      effect.life -= dt;
      if (effect.life <= 0) {
        effect.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  updateDepths() {
    if (!this.player) return;
    this.player.sprite.setDepth(this.player.sprite.y + 80);
    this.player.shadow.setDepth(this.player.sprite.y + 10);
    this.enemies.forEach((enemy) => {
      enemy.shadow.setDepth(enemy.sprite.y + 5);
      enemy.sprite.setDepth(enemy.sprite.y + 70);
    });
    this.chests.forEach((chest) => {
      if (!chest.opened) {
        chest.glow.setDepth(chest.sprite.y + 40);
        chest.sprite.setDepth(chest.sprite.y + 58);
      }
    });
  }

  createPhaseOverlays() {
    this.createCountdownOverlay();
    this.createLevelUpOverlay();
    this.createGameOverOverlay();
  }

  createCountdownOverlay() {
    this.countdownOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7200).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x244866, 0.28);
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 0.82);
    panel.lineStyle(3, 0xffda73, 0.78);
    panel.fillRoundedRect(-210, -116, 420, 232, 8);
    panel.strokeRoundedRect(-210, -116, 420, 232, 8);
    this.countdownLevelText = this.add.text(0, -54, '', this.uiTextStyle(34, '#31503b')).setOrigin(0.5);
    this.countdownNumberText = this.add.text(0, 30, '', {
      ...this.uiTextStyle(72, '#7a4b16'),
      strokeThickness: 5,
    }).setOrigin(0.5);
    this.countdownOverlay.add([shade, panel, this.countdownLevelText, this.countdownNumberText]);
    this.uiLayer.add(this.countdownOverlay);
  }

  createLevelUpOverlay() {
    this.levelUpChoices = [
      {
        key: 'melee',
        label: 'Melee Damage',
        detail: '+1 sword power',
        icon: { texture: 'worldSheet', frame: 'level-sword-icon' },
        stat: 'swordPower',
        color: 0xf4bc3f,
        stageColor: 0xb94136,
        stageAccent: 0xffd45c,
        apply: () => {
          this.playerStats.swordPower += 1;
          this.addGuildNote('Melee training complete! Sword damage increased.');
        },
      },
      {
        key: 'range',
        label: 'Range Damage',
        detail: '+1 bow power',
        icon: { texture: 'worldSheet', frame: 'level-bow-icon' },
        stat: 'bowPower',
        color: 0x72c96d,
        stageColor: 0x397f4a,
        stageAccent: 0xbde679,
        apply: () => {
          this.playerStats.bowPower += 1;
          this.addGuildNote('Range training complete! Bow damage increased.');
        },
      },
      {
        key: 'magic',
        label: 'Magic Damage',
        detail: '+1 spell power',
        icon: { texture: 'worldSheet', frame: 'level-spell-icon' },
        stat: 'spellPower',
        color: 0x6cc5ff,
        stageColor: 0x3267c9,
        stageAccent: 0xa8f3ff,
        apply: () => {
          this.playerStats.spellPower += 1;
          this.addGuildNote('Magic training complete! Spell damage increased.');
        },
      },
    ];

    this.levelUpOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7300).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x17344f, 0.42);
    const art = this.add.image(0, 0, 'levelUpUI').setDisplaySize(780, 438).setAlpha(0.98);
    this.levelUpTitleText = this.add.text(0, -148, 'Level Up!', {
      ...this.uiTextStyle(42, '#714617'),
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.levelUpRewardText = this.add.text(0, -102, 'Heart +1', this.uiTextStyle(22, '#bd415c')).setOrigin(0.5);
    const helper = this.add.text(0, -70, 'Choose your guild training', this.uiTextStyle(18, '#31503b')).setOrigin(0.5);
    this.levelUpOverlay.add([shade, art, this.levelUpTitleText, this.levelUpRewardText, helper]);

    this.levelUpProgressBars = [];
    this.levelUpChoices.forEach((choice, index) => {
      const card = this.add.container(LEVEL_UP_CARD_XS[index], 76);
      const hit = this.add.rectangle(0, 0, 196, 220, 0xfff1b8, 0.001)
        .setInteractive({ useHandCursor: true });
      const stage = this.createLevelUpIconStage(choice);
      const icon = this.add.image(0, -24, choice.icon.texture, choice.icon.frame).setDisplaySize(76, 76);
      const number = this.add.text(-76, -70, `${index + 1}`, this.uiTextStyle(18, '#8a5a20')).setOrigin(0.5);
      const label = this.add.text(0, 82, choice.label, this.uiTextStyle(19, COLORS.uiInk)).setOrigin(0.5);
      const detail = this.add.text(0, 110, choice.detail, this.uiTextStyle(14, '#5e7b4a')).setOrigin(0.5);
      const pips = this.createLevelUpProgressPips(choice);
      hit.on('pointerover', () => {
        hit.setFillStyle(0xfff1b8, 0.16);
        this.updateLevelUpProgressBars(index);
      });
      hit.on('pointerout', () => {
        hit.setFillStyle(0xfff1b8, 0.001);
        this.updateLevelUpProgressBars();
      });
      hit.on('pointerup', () => this.chooseLevelUpgrade(index));
      card.add([hit, stage, icon, number, ...pips, label, detail]);
      this.levelUpOverlay.add(card);
    });
    this.uiLayer.add(this.levelUpOverlay);
  }

  createLevelUpIconStage(choice) {
    const stage = this.add.graphics();
    stage.fillStyle(choice.stageColor, 0.22);
    stage.fillRoundedRect(-58, -72, 116, 94, 10);
    stage.lineStyle(2, choice.stageAccent, 0.36);
    stage.strokeRoundedRect(-58, -72, 116, 94, 10);
    stage.fillStyle(choice.stageColor, 0.34);
    stage.fillEllipse(0, 18, 112, 22);
    stage.fillStyle(choice.stageAccent, 0.18);
    stage.fillRoundedRect(-50, -66, 100, 16, 8);
    return stage;
  }

  createLevelUpProgressPips(choice) {
    const pips = [];
    const pipW = 20;
    const gap = 5;
    const startX = -((LEVEL_UP_MAX_PIPS - 1) * (pipW + gap)) / 2;
    for (let i = 0; i < LEVEL_UP_MAX_PIPS; i += 1) {
      const pip = this.add.rectangle(startX + i * (pipW + gap), 48, pipW, 9, 0xfff3c8, 0.46)
        .setStrokeStyle(1, 0x8c6023, 0.5);
      pips.push(pip);
    }
    this.levelUpProgressBars.push({ pips, stat: choice.stat, color: choice.color });
    return pips;
  }

  updateLevelUpProgressBars(previewIndex = null) {
    this.levelUpProgressBars.forEach((bar, index) => {
      const current = Phaser.Math.Clamp(this.playerStats[bar.stat] - PLAYER_BASE[bar.stat], 0, LEVEL_UP_MAX_PIPS);
      const preview = previewIndex === index ? Phaser.Math.Clamp(current + 1, 0, LEVEL_UP_MAX_PIPS) : current;
      bar.pips.forEach((pip, pipIndex) => {
        if (pipIndex < current) {
          pip.setFillStyle(bar.color, 0.94);
          pip.setStrokeStyle(1, 0xffffff, 0.72);
        } else if (pipIndex < preview) {
          pip.setFillStyle(bar.color, 0.5);
          pip.setStrokeStyle(1, 0xffffff, 0.64);
        } else {
          pip.setFillStyle(0xfff3c8, 0.46);
          pip.setStrokeStyle(1, 0x8c6023, 0.5);
        }
      });
    });
  }

  createGameOverOverlay() {
    this.gameOverOverlay = this.add.container(WIDTH / 2, HEIGHT / 2).setDepth(7800).setVisible(false);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x17344f, 0.48);
    const panel = this.add.image(0, 0, 'gameOverUI')
      .setDisplaySize(780, 439)
      .setAlpha(0.99);
    const title = this.add.text(0, -120, 'Guild Rest Time', {
      ...this.uiTextStyle(40, '#714617'),
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.gameOverReasonText = this.add.text(0, -52, '', {
      ...this.uiTextStyle(21, COLORS.uiInk),
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5);
    this.gameOverStatsText = this.add.text(0, 38, '', this.uiTextStyle(19, '#31503b')).setOrigin(0.5);
    const restartButton = this.add.rectangle(0, 158, 260, 58, 0xfff1b8, 0.04)
      .setInteractive({ useHandCursor: true });
    const restartText = this.add.text(0, 151, 'Restart (R)', {
      ...this.uiTextStyle(22, '#684315'),
      strokeThickness: 3,
    }).setOrigin(0.5);
    restartButton.on('pointerover', () => restartButton.setFillStyle(0xfff1b8, 0.18));
    restartButton.on('pointerout', () => restartButton.setFillStyle(0xfff1b8, 0.04));
    restartButton.on('pointerup', () => this.scene.restart());
    this.gameOverOverlay.add([shade, panel, title, this.gameOverReasonText, this.gameOverStatsText, restartButton, restartText]);
    this.uiLayer.add(this.gameOverOverlay);
  }

  showLevelUpScreen() {
    this.levelUpTitleText.setText('Level Up!');
    this.levelUpRewardText.setText('Heart +1');
    this.updateLevelUpProgressBars();
    this.levelUpOverlay.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.levelUpOverlay,
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut',
    });
    this.spawnSparkleBurst(this.player.sprite.x, this.player.sprite.y - 38, 0xa8f3ff, 28, 1.25);
    this.playTone('level');
  }

  chooseLevelUpgrade(index) {
    if (this.state.phase !== 'levelUp') return;
    const choice = this.levelUpChoices[index];
    if (!choice) return;
    this.playerStats.maxHealth += 1;
    this.state.health = Math.min(this.playerStats.maxHealth, this.state.health + 1);
    choice.apply();
    this.updateLevelUpProgressBars();
    this.spawnShieldGlow();
    this.playTone('level');
    this.state.level += 1;
    this.levelUpOverlay.setVisible(false);
    this.startLevelCountdown();
  }

  showGameOverScreen(reason) {
    this.gameOverReasonText.setText(reason);
    this.gameOverStatsText.setText(`Final Level ${this.state.level}   Gold ${this.state.gold}`);
    this.gameOverOverlay.setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.gameOverOverlay,
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }

  createHud() {
    this.hud = {};
    this.createTopBar();
    this.createNotesPanel();
    this.createControlsHint();
    this.createInventoryPanel();
  }

  createTopBar() {
    const top = this.add.container(16, 10).setDepth(7600);
    const bg = this.add.image(0, 0, 'statusPanelUI', 'panel')
      .setOrigin(0, 0)
      .setDisplaySize(892, 92);
    const readability = this.add.graphics();
    readability.fillStyle(0xfff7df, 0.96);
    readability.fillRoundedRect(34, 18, 822, 58, 7);
    top.add([bg, readability]);
    this.hud.hearts = this.add.container(42, 34);
    this.hud.manaBar = this.createMeter(174, 22, 148, 16, 0x6fc9ff, 0x1f6ea7);
    this.hud.xpBar = this.createMeter(174, 51, 148, 14, 0xffd96c, 0xba7620);
    this.hud.goldText = this.add.text(360, 19, '', this.uiTextStyle(20, '#56330f')).setOrigin(0, 0);
    this.hud.levelText = this.add.text(360, 48, '', this.uiTextStyle(17, '#1e3348')).setOrigin(0, 0);
    this.hud.weaponText = this.add.text(526, 19, '', this.uiTextStyle(16, '#1e3348')).setOrigin(0, 0);
    this.hud.spellText = this.add.text(526, 48, '', this.uiTextStyle(16, '#1e3348')).setOrigin(0, 0);
    this.hud.safetyBar = this.createMeter(736, 22, 112, 17, 0x9ce889, 0x2f9b4c);
    this.hud.waveText = this.add.text(738, 48, '', this.uiTextStyle(15, '#224b31')).setOrigin(0, 0);
    top.add([
      this.hud.hearts,
      ...this.hud.manaBar.parts,
      ...this.hud.xpBar.parts,
      this.hud.goldText,
      this.hud.levelText,
      this.hud.weaponText,
      this.hud.spellText,
      ...this.hud.safetyBar.parts,
      this.hud.waveText,
    ]);
    this.uiLayer.add(top);
  }

  createMeter(x, y, w, h, fillColor, strokeColor) {
    const bg = this.add.rectangle(x, y, w, h, 0xf9fff8, 0.9).setOrigin(0, 0).setStrokeStyle(2, strokeColor, 0.8);
    const fill = this.add.rectangle(x + 3, y + 3, w - 6, h - 6, fillColor, 1).setOrigin(0, 0);
    const shine = this.add.rectangle(x + 5, y + 4, w - 10, 3, 0xffffff, 0.42).setOrigin(0, 0);
    return { bg, fill, shine, width: w - 6, parts: [bg, fill, shine] };
  }

  createNotesPanel() {
    const panel = this.add.container(WIDTH - 370, 12).setDepth(7600);
    const bg = this.add.image(0, 0, 'guildNotesUI', 'panel')
      .setOrigin(0, 0)
      .setDisplaySize(354, 236);
    const textBacking = this.add.graphics();
    textBacking.fillStyle(0xfff8df, 0.84);
    textBacking.fillRoundedRect(22, 60, 310, 146, 7);
    const title = this.add.text(177, 29, 'Guild Notes', {
      ...this.uiTextStyle(22, '#102f3e'),
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.hud.notesText = this.add.text(30, 68, '', {
      ...this.uiTextStyle(15, '#162a3c'),
      lineSpacing: 7,
      wordWrap: { width: 292 },
    });
    panel.add([bg, textBacking, title, this.hud.notesText]);
    this.uiLayer.add(panel);
  }

  createControlsHint() {
    const hint = this.add.container(18, HEIGHT - 58).setDepth(6000);
    const bg = this.add.graphics();
    bg.fillStyle(0x22324a, 0.62);
    bg.fillRoundedRect(0, 0, 632, 38, 8);
    const text = this.add.text(
      14,
      10,
      'WASD/Arrows move   Space sword   Click/F bow   Q/R spell   E chest   I inventory',
      this.uiTextStyle(14, '#ffffff'),
    );
    hint.add([bg, text]);
    this.uiLayer.add(hint);
  }

  createInventoryPanel() {
    this.inventoryPanel = this.add.container(WIDTH - 346, 178).setDepth(6100).setVisible(false);
    this.uiLayer.add(this.inventoryPanel);
    this.rebuildInventoryPanel();
  }

  rebuildInventoryPanel() {
    if (!this.inventoryPanel) return;
    this.inventoryPanel.removeAll(true);
    const bg = this.add.graphics();
    bg.fillStyle(0xfff9e8, 0.95);
    bg.lineStyle(2, 0xd0a24b, 0.7);
    bg.fillRoundedRect(0, 0, 326, 306, 8);
    bg.strokeRoundedRect(0, 0, 326, 306, 8);
    const title = this.add.text(16, 12, 'Inventory & Upgrades', this.uiTextStyle(20, '#6a4618'));
    const gold = this.add.text(18, 42, `Gold: ${this.state.gold}`, this.uiTextStyle(16, '#75521e'));
    this.inventoryPanel.add([bg, title, gold]);
    this.upgrades.forEach((upgrade, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = 16 + col * 150;
      const y = 72 + row * 72;
      const price = upgrade.cost + upgrade.level * 25;
      const card = this.add.graphics();
      card.fillStyle(0xffffff, 0.82);
      card.lineStyle(2, this.state.gold >= price ? 0x79bd68 : 0xd4c2a1, 0.8);
      card.fillRoundedRect(x, y, 136, 58, 7);
      card.strokeRoundedRect(x, y, 136, 58, 7);
      const icon = this.add.image(x + 24, y + 29, upgrade.icon).setDisplaySize(30, 30);
      const name = this.add.text(x + 46, y + 8, `${index + 1}. ${upgrade.name}`, this.uiTextStyle(14, COLORS.uiInk));
      const detail = this.add.text(x + 46, y + 28, `Lv ${upgrade.level}  ${price}g`, this.uiTextStyle(13, '#6d7b48'));
      const small = this.add.text(x + 8, y + 58, upgrade.detail, this.uiTextStyle(11, '#765f42'));
      this.inventoryPanel.add([card, icon, name, detail, small]);
    });
  }

  toggleInventory() {
    if (this.state.phase !== 'playing') return;
    this.state.inventoryOpen = !this.state.inventoryOpen;
    this.inventoryPanel.setVisible(this.state.inventoryOpen);
    this.rebuildInventoryPanel();
    this.addGuildNote(this.state.inventoryOpen ? 'Guild pack opened. Press 1-6 to upgrade.' : 'Guild pack tucked away.');
  }

  updateHud() {
    this.renderHearts();
    this.setMeter(this.hud.manaBar, this.state.mana / this.playerStats.maxMana);
    this.setMeter(this.hud.xpBar, (this.state.xp % 100) / 100);
    this.setMeter(this.hud.safetyBar, this.state.villageSafety / 100);
    this.hud.goldText.setText(`Gold ${this.state.gold}`);
    this.hud.levelText.setText(`Level ${this.state.level}  XP ${this.state.xp}`);
    this.hud.weaponText.setText(`Wpn: ${this.state.equipped}`);
    this.hud.spellText.setText(`Spell: ${this.state.spell}`);
    this.hud.waveText.setText(`Safe ${this.state.villageSafety}%  L${this.state.level}`);
    this.hud.notesText.setText(this.notes.slice(-3).map((note) => `- ${note}`).join('\n'));
    if (this.state.inventoryOpen) {
      const inventoryKey = `${this.state.gold}|${this.upgrades.map((upgrade) => upgrade.level).join(',')}`;
      if (this.hud.inventoryKey !== inventoryKey) {
        this.hud.inventoryKey = inventoryKey;
        this.rebuildInventoryPanel();
      }
    }
  }

  renderHearts() {
    if (this.hud.lastHearts === `${this.state.health}/${this.playerStats.maxHealth}`) return;
    this.hud.lastHearts = `${this.state.health}/${this.playerStats.maxHealth}`;
    this.hud.hearts.removeAll(true);
    for (let i = 0; i < this.playerStats.maxHealth; i += 1) {
      const x = (i % 8) * 18;
      const y = Math.floor(i / 8) * 19;
      const full = i < this.state.health;
      const heart = this.add.text(x, y, full ? '♥' : '♡', {
        fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
        fontSize: '20px',
        color: full ? '#eb5571' : '#b7a9a2',
      });
      this.hud.hearts.add(heart);
    }
  }

  setMeter(meter, ratio) {
    meter.fill.width = meter.width * Phaser.Math.Clamp(ratio, 0, 1);
    meter.shine.width = Math.max(0, meter.fill.width - 4);
  }

  uiTextStyle(size, color) {
    return {
      fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
      fontSize: `${size}px`,
      color,
      stroke: 'rgba(255,255,255,0.55)',
      strokeThickness: 2,
    };
  }

  addGuildNote(message) {
    if (this.notes[this.notes.length - 1] === message) return;
    this.notes.push(message);
    if (this.notes.length > 8) this.notes.shift();
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8bd6ff',
  width: WIDTH,
  height: HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
  scene: FairyGuildScene,
};

new Phaser.Game(config);
