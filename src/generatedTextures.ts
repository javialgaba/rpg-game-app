import * as Phaser from 'phaser';

export function createGeneratedTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false } as any);
  const make = (key: string, width: number, height: number, draw: (gfx: Phaser.GameObjects.Graphics, w: number, h: number) => void) => {
    g.clear();
    if (scene.textures.exists(key)) { scene.textures.remove(key); }
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

}
