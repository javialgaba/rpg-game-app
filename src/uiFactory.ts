export function uiTextStyle(size, color) {
  return {
    fontFamily: 'Arial Rounded MT Bold, Arial, sans-serif',
    fontSize: `${size}px`,
    color,
    stroke: 'rgba(255,255,255,0.55)',
    strokeThickness: 2,
  };
}

export function getGameUiFrameSize(scene, frameName) {
  const frame = scene.textures.getFrame('gameUiAtlas', frameName);
  return {
    width: frame?.width ?? frame?.cutWidth ?? 1,
    height: frame?.height ?? frame?.cutHeight ?? 1,
  };
}

export function createTiledGameUiFrame(scene, x, y, displayWidth, displayHeight, frameName, scale = 1) {
  return scene.add.tileSprite(
    x,
    y,
    Math.max(1, displayWidth / scale),
    Math.max(1, displayHeight / scale),
    'gameUiAtlas',
    frameName,
  ).setScale(scale);
}

export function createUiPanelFrame(scene, width, height, options: { decorScale?: number; fillAlpha?: number } = {}) {
  const decorScale = options.decorScale ?? 0.72;
  const container = scene.add.container(0, 0);
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x132130, 0.34);
  shadow.fillRoundedRect(-width / 2 + 8, -height / 2 + 12, width - 16, height - 14, 14);
  const fill = scene.add.tileSprite(0, 0, width - 72, height - 64, 'gameUiAtlas', 'panel_fill')
    .setAlpha(options.fillAlpha ?? 0.98);
  const rim = scene.add.graphics();
  rim.lineStyle(4, 0xd79a38, 0.82);
  rim.strokeRoundedRect(-width / 2 + 32, -height / 2 + 28, width - 64, height - 56, 12);
  rim.lineStyle(2, 0xffedb6, 0.7);
  rim.strokeRoundedRect(-width / 2 + 44, -height / 2 + 40, width - 88, height - 80, 10);

  const cornerInset = 76 * decorScale;
  const verticalInset = 26 * decorScale;
  const topY = -height / 2 + 34 * decorScale;
  const bottomY = height / 2 - 34 * decorScale;
  const leftX = -width / 2 + 38 * decorScale;
  const rightX = width / 2 - 38 * decorScale;
  const topSize = getGameUiFrameSize(scene, 'panel_edge_top');
  const bottomSize = getGameUiFrameSize(scene, 'panel_edge_bottom');
  const leftSize = getGameUiFrameSize(scene, 'panel_edge_left');
  const rightSize = getGameUiFrameSize(scene, 'panel_edge_right');
  const horizontalEdgeMargin = 168 * decorScale;
  const verticalEdgeMargin = 166 * decorScale;
  const topEdge = createTiledGameUiFrame(
    scene,
    0,
    topY,
    Math.max(topSize.width * decorScale, width - horizontalEdgeMargin * 2),
    topSize.height * decorScale,
    'panel_edge_top',
    decorScale,
  );
  const bottomEdge = createTiledGameUiFrame(
    scene,
    0,
    bottomY,
    Math.max(bottomSize.width * decorScale, width - horizontalEdgeMargin * 2),
    bottomSize.height * decorScale,
    'panel_edge_bottom',
    decorScale,
  );
  const leftEdge = createTiledGameUiFrame(
    scene,
    leftX,
    0,
    leftSize.width * decorScale,
    Math.max(leftSize.height * decorScale, height - verticalEdgeMargin * 2),
    'panel_edge_left',
    decorScale,
  );
  const rightEdge = createTiledGameUiFrame(
    scene,
    rightX,
    0,
    rightSize.width * decorScale,
    Math.max(rightSize.height * decorScale, height - verticalEdgeMargin * 2),
    'panel_edge_right',
    decorScale,
  );
  const topLeft = scene.add.image(-width / 2 + cornerInset, -height / 2 + cornerInset, 'gameUiAtlas', 'panel_corner_tl').setScale(decorScale);
  const topRight = scene.add.image(width / 2 - cornerInset, -height / 2 + cornerInset, 'gameUiAtlas', 'panel_corner_tr').setScale(decorScale);
  const bottomLeft = scene.add.image(-width / 2 + cornerInset + verticalInset, height / 2 - cornerInset, 'gameUiAtlas', 'panel_corner_bl').setScale(decorScale);
  const bottomRight = scene.add.image(width / 2 - cornerInset - verticalInset, height / 2 - cornerInset, 'gameUiAtlas', 'panel_corner_br').setScale(decorScale);
  container.add([shadow, fill, rim, topEdge, bottomEdge, leftEdge, rightEdge, topLeft, topRight, bottomLeft, bottomRight]);
  return container;
}

export function createHorizontalSlicedFrame(
  scene,
  x,
  y,
  width,
  height,
  frameNames,
  options: { leftWidth?: number; rightWidth?: number; alpha?: number } = {},
) {
  const leftSize = getGameUiFrameSize(scene, frameNames.left);
  const middleSize = getGameUiFrameSize(scene, frameNames.middle);
  const rightSize = getGameUiFrameSize(scene, frameNames.right);
  const baseHeight = Math.max(1, leftSize.height, middleSize.height, rightSize.height);
  const scale = height / baseHeight;
  const leftWidth = options.leftWidth ?? leftSize.width * scale;
  const rightWidth = options.rightWidth ?? rightSize.width * scale;
  const middleWidth = Math.max(1, width - leftWidth - rightWidth);
  const container = scene.add.container(x, y);
  const left = scene.add.image(-width / 2 + leftWidth / 2, 0, 'gameUiAtlas', frameNames.left)
    .setScale(scale);
  const middle = scene.add.tileSprite(0, 0, middleWidth / scale, middleSize.height, 'gameUiAtlas', frameNames.middle)
    .setScale(scale);
  const right = scene.add.image(width / 2 - rightWidth / 2, 0, 'gameUiAtlas', frameNames.right)
    .setScale(scale);
  container.add([left, middle, right]);
  if (options.alpha !== undefined) {
    container.setAlpha(options.alpha);
  }
  return { container, pieces: [left, middle, right], leftWidth, rightWidth, middleWidth };
}

export function createUiTitleBanner(scene, x, y, width = 360, height = 70) {
  return createHorizontalSlicedFrame(scene, x, y, width, height, {
    left: 'title_left',
    middle: 'title_mid',
    right: 'title_right',
  }).container;
}

export function fitUiTextToWidth(text, maxWidth, maxSize, minSize = 16) {
  text.setScale(1);
  text.setFontSize(maxSize);
  let size = maxSize;
  while (text.width > maxWidth && size > minSize) {
    size -= 1;
    text.setFontSize(size);
  }
  return text;
}

export function createFittedTitleText(scene, x, y, label, maxWidth, maxSize, minSize) {
  const text = scene.add.text(x, y, label, {
    ...uiTextStyle(maxSize, '#714617'),
    align: 'center',
    strokeThickness: 4,
  }).setOrigin(0.5);
  return fitUiTextToWidth(text, maxWidth, maxSize, minSize);
}

export function createHudChip(scene, x, y, width, height) {
  return createHorizontalSlicedFrame(scene, x, y, width, height, {
    left: 'hud_chip_left',
    middle: 'hud_chip_mid',
    right: 'hud_chip_right',
  }, { alpha: 0.92 }).container;
}

export interface SharedCardBoxContent {
  art: { texture: string; frame: string };
  title: string;
  description: string;
  badgeText?: string;
  selected?: boolean;
  interactive?: boolean;
  onSelect?: () => void;
}

export interface SharedCardBoxLayout {
  width: number;
  height: number;
  artY: number;
  artSize: number;
  titleY: number;
  descriptionY: number;
  titleSize: number;
  descriptionSize: number;
  badgeX: number;
  badgeY: number;
  badgeSize: number;
}

export function createSharedCardBox(scene, x, y, layout: SharedCardBoxLayout, initial: SharedCardBoxContent) {
  const container = scene.add.container(x, y);
  const frame = scene.add.image(0, 0, 'gameUiAtlas', 'shared_card_box_01')
    .setDisplaySize(layout.width, layout.height);
  const selection = scene.add.rectangle(0, 0, layout.width - 12, layout.height - 12, 0xfff1b8, 0.001)
    .setStrokeStyle(3, 0xffd26d, 0)
    .setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, layout.width, layout.height, 0xfff1b8, 0.001)
    .setOrigin(0.5);
  const art = scene.add.image(0, layout.artY, initial.art.texture, initial.art.frame)
    .setDisplaySize(layout.artSize, layout.artSize);
  const title = scene.add.text(0, layout.titleY, initial.title, uiTextStyle(layout.titleSize, '#5f3b12'))
    .setOrigin(0.5);
  const description = scene.add.text(0, layout.descriptionY, initial.description, {
    ...uiTextStyle(layout.descriptionSize, '#31503b'),
    align: 'center',
    wordWrap: { width: layout.width - 42 },
  }).setOrigin(0.5, 0);
  const badge = scene.add.container(layout.badgeX, layout.badgeY);
  const badgeBacking = scene.add.circle(0, 0, layout.badgeSize, 0x316ca8, 0.98)
    .setStrokeStyle(2, 0xffdb75, 0.96);
  const badgeText = scene.add.text(0, 0, initial.badgeText ?? '', {
    ...uiTextStyle(Math.round(layout.badgeSize * 0.7), '#fff5cb'),
    strokeThickness: 2,
  }).setOrigin(0.5);
  badge.add([badgeBacking, badgeText]);

  let selected = Boolean(initial.selected);
  let hovered = false;
  let onSelect = initial.onSelect;
  const applyState = () => {
    selection.setStrokeStyle(3, 0xffd26d, selected ? 0.98 : 0);
    hit.setFillStyle(0xfff1b8, selected ? 0.12 : hovered ? 0.08 : 0.001);
    if (selected) {
      frame.setTint(0xffedaa);
    } else if (hovered) {
      frame.setTint(0xfff3d1);
    } else {
      frame.clearTint();
    }
  };
  const setSelected = (value: boolean) => {
    selected = value;
    applyState();
  };
  const setContent = (content: SharedCardBoxContent) => {
    art.setTexture(content.art.texture, content.art.frame);
    title.setText(content.title);
    description.setText(content.description);
    badgeText.setText(content.badgeText ?? '');
    badge.setVisible(Boolean(content.badgeText));
    if (content.selected !== undefined) {
      selected = content.selected;
    }
    if (content.onSelect !== undefined) {
      onSelect = content.onSelect;
    }
    applyState();
  };

  if (initial.interactive !== false) {
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => {
      hovered = true;
      applyState();
    });
    hit.on('pointerout', () => {
      hovered = false;
      applyState();
    });
    hit.on('pointerup', () => onSelect?.());
  }
  container.add([frame, selection, hit, art, title, description, badge]);
  setContent(initial);
  return { container, frame, hit, art, title, description, badge, badgeText, setContent, setSelected };
}

export function createUiButton(scene, x, y, width, height, label, onPress) {
  const container = scene.add.container(x, y);
  const frame = createHorizontalSlicedFrame(scene, 0, 0, width, height, {
    left: 'button_left',
    middle: 'button_mid',
    right: 'button_right',
  });
  const hit = scene.add.rectangle(0, 0, width, height, 0xfff1b8, 0.001)
    .setInteractive({ useHandCursor: true });
  const text = scene.add.text(0, -2, label, {
    ...uiTextStyle(Math.max(16, Math.round(height * 0.42)), '#684315'),
    strokeThickness: 3,
  }).setOrigin(0.5);
  const pieces = frame.pieces;
  hit.on('pointerover', () => {
    pieces.forEach((piece) => piece.setTint(0xfff4bf));
    hit.setFillStyle(0xfff1b8, 0.12);
  });
  hit.on('pointerout', () => {
    pieces.forEach((piece) => piece.clearTint());
    hit.setFillStyle(0xfff1b8, 0.001);
  });
  hit.on('pointerup', onPress);
  container.add([frame.container, hit, text]);
  return { container, hit, text, pieces };
}
