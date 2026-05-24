import * as Phaser from 'phaser';
import type { SceneAPI } from './sceneAPI';
import { WIDTH, HEIGHT } from './gameConfig';
import type { TouchActionKey, TouchButtonSlot, TouchActionIcon } from './gameTypes';

const TOUCH_CONTROL_SCALE = 1.5;
const scaleTouchControl = (value: number) => value * TOUCH_CONTROL_SCALE;

function getTouchCapabilityInfo(scene: SceneAPI) {
  const params = new URLSearchParams(window.location.search);
  const forceTouchControls = params.has('touchControls') || params.has('forceTouch');
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const anyCoarsePointer = window.matchMedia?.('(any-pointer: coarse)').matches ?? false;
  const hoverNone = window.matchMedia?.('(hover: none)').matches ?? false;
  const hasTouchStart = 'ontouchstart' in window || 'TouchEvent' in window;
  const phaserTouch = Boolean(scene.sys.game.device.input.touch);

  return {
    enabled: forceTouchControls || phaserTouch || maxTouchPoints > 0 || coarsePointer || anyCoarsePointer || hasTouchStart,
    forceTouchControls,
    phaserTouch,
    maxTouchPoints,
    coarsePointer,
    anyCoarsePointer,
    hoverNone,
    hasTouchStart,
    userAgent: navigator.userAgent,
  };
}

function debugTouchControls(scene: SceneAPI, message: string, extra: object = {}) {
  const params = new URLSearchParams(window.location.search);
  const storageEnabled = (() => {
    try {
      return localStorage.getItem('debugTouchControls') === '1';
    } catch {
      return false;
    }
  })();
  if (!params.has('debugTouch') && !storageEnabled) {
    return;
  }

  const gameEl = document.getElementById('game');
  const canvas = scene.game.canvas;
  const gameStyle = gameEl ? getComputedStyle(gameEl) : null;
  const canvasStyle = canvas ? getComputedStyle(canvas) : null;
  console.info('[touch-controls]', message, {
    ...extra,
    detection: scene.touchDetection,
    created: Boolean(scene.touchControls),
    enabled: scene.touchControlsEnabled,
    phase: scene.state.phase,
    portrait: isPortraitLayout(),
    containerVisible: scene.touchControls?.container.visible ?? null,
    containerAlpha: scene.touchControls?.container.alpha ?? null,
    containerDepth: scene.touchControls?.container.depth ?? null,
    viewport: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      visualWidth: window.visualViewport?.width ?? null,
      visualHeight: window.visualViewport?.height ?? null,
    },
    gameDom: gameStyle ? {
      exists: true,
      display: gameStyle.display,
      visibility: gameStyle.visibility,
      position: gameStyle.position,
      zIndex: gameStyle.zIndex,
      pointerEvents: gameStyle.pointerEvents,
      width: gameStyle.width,
      height: gameStyle.height,
    } : { exists: false },
    canvasDom: canvasStyle ? {
      exists: true,
      display: canvasStyle.display,
      visibility: canvasStyle.visibility,
      position: canvasStyle.position,
      zIndex: canvasStyle.zIndex,
      pointerEvents: canvasStyle.pointerEvents,
      opacity: canvasStyle.opacity,
      width: canvasStyle.width,
      height: canvasStyle.height,
    } : { exists: false },
  });
}

function isPortraitLayout() {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  return height > width;
}

export function checkIsTouchDevice(scene: SceneAPI): boolean {
  scene.touchDetection = getTouchCapabilityInfo(scene);
  debugTouchControls(scene, 'touch detection', scene.touchDetection);
  const params = new URLSearchParams(window.location.search);
  if (params.has('forceDesktop')) {
    return false;
  }
  return scene.touchDetection.enabled;
}

function createTouchActionButton(
  scene: SceneAPI,
  action: TouchActionKey,
  x: number,
  y: number,
  label: string,
  icon: TouchActionIcon,
  color: number,
) {
  const button = scene.add.container(x, y).setScrollFactor(0);
  const hit = scene.add.zone(0, 0, scaleTouchControl(78), scaleTouchControl(82))
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  const labelText = label ? scene.add.text(0, scaleTouchControl(34), label, {
    ...scene.uiTextStyle(scaleTouchControl(10), '#ffffff'),
    strokeThickness: scaleTouchControl(3),
  }).setOrigin(0.5) : null;
  const glyph = icon
    ? scene.add.image(0, -scaleTouchControl(3), icon.texture, icon.frame).setDisplaySize(scaleTouchControl(70), scaleTouchControl(70))
    : scene.add.text(0, -scaleTouchControl(5), 'I', {
      ...scene.uiTextStyle(scaleTouchControl(24), '#fff0b8'),
      strokeThickness: scaleTouchControl(4),
    }).setOrigin(0.5);
  const focusRing = scene.add.circle(0, -scaleTouchControl(3), scaleTouchControl(34), 0xffffff, 0)
    .setStrokeStyle(scaleTouchControl(2), color, 0.28);
  hit.on('pointerdown', () => {
    scene.ensureAudio();
    pulseTouchButton(scene, button);
    handleTouchAction(scene, action);
  });
  button.add(labelText ? [hit, focusRing, glyph, labelText] : [hit, focusRing, glyph]);
  button.setData('labelText', labelText);
  button.setData('glyph', glyph);
  return button;
}

function getClassActionPresentation(scene: SceneAPI) {
  const hero = scene.getHeroConfig();
  const attackIcon = scene.heroClass === 'warrior'
    ? { texture: 'touchControlsAtlas', frame: 'touch_sword_01' }
    : scene.heroClass === 'archer'
      ? { texture: 'touchControlsAtlas', frame: 'touch_bow_01' }
      : { texture: 'touchControlsAtlas', frame: 'touch_spell_01' };
  const skillIcon = scene.heroClass === 'warrior'
    ? { texture: 'shieldIconTexture' }
    : scene.heroClass === 'archer'
      ? { texture: 'trapIconTexture' }
      : { texture: 'touchControlsAtlas', frame: 'touch_spell_01' };
  return { hero, attackIcon, skillIcon };
}

export function updateTouchClassActions(scene: SceneAPI): void {
  if (!scene.touchControls) {
    return;
  }
  const { hero, attackIcon, skillIcon } = getClassActionPresentation(scene);
  const updateButton = (action: TouchActionKey, label: string, icon: { texture: string; frame?: string }) => {
    const button = scene.touchControls.buttons[action];
    button?.getData('labelText')?.setText(label);
    button?.getData('glyph')
      ?.setTexture(icon.texture, icon.frame)
      .setDisplaySize(scaleTouchControl(70), scaleTouchControl(70));
  };
  updateButton('mainAttack', hero.mainAttack, attackIcon);
  updateButton('classSkill', hero.skill, skillIcon);
}

function createPortraitOverlay(scene: SceneAPI) {
  const overlay = scene.add.container(0, 0).setDepth(7950).setVisible(false).setScrollFactor(0);
  const shade = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x17344f, 0.76);
  const panel = scene.add.graphics();
  panel.fillStyle(0xfff7df, 0.96);
  panel.lineStyle(4, 0xffd36d, 0.86);
  panel.fillRoundedRect(WIDTH / 2 - 270, HEIGHT / 2 - 92, 540, 184, 10);
  panel.strokeRoundedRect(WIDTH / 2 - 270, HEIGHT / 2 - 92, 540, 184, 10);
  const title = scene.add.text(WIDTH / 2, HEIGHT / 2 - 28, 'Turn your device sideways', {
    ...scene.uiTextStyle(30, '#714617'),
    strokeThickness: 4,
  }).setOrigin(0.5);
  const helper = scene.add.text(WIDTH / 2, HEIGHT / 2 + 32, 'Fairy Guild Defense plays best in landscape.', scene.uiTextStyle(17, '#31503b'))
    .setOrigin(0.5);
  overlay.add([shade, panel, title, helper]);
  return overlay;
}

function updateJoystickFromPointer(scene: SceneAPI, pointer) {
  if (!scene.touchControls || pointer.id !== scene.touchControls.joystickPointerId) {
    return;
  }
  const radius = scaleTouchControl(58);
  const center = scene.touchControls.joystickCenter;
  const dx = pointer.x - center.x;
  const dy = pointer.y - center.y;
  const distance = Math.min(radius, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const thumbX = distance > 0 ? Math.cos(angle) * distance : 0;
  const thumbY = distance > 0 ? Math.sin(angle) * distance : 0;
  scene.touchControls.joystickThumb.setPosition(center.x + thumbX, center.y + thumbY);
  scene.touchControls.joystickVector = {
    x: thumbX / radius,
    y: thumbY / radius,
  };
}

function releaseJoystick(scene: SceneAPI, pointer) {
  if (!scene.touchControls || pointer.id !== scene.touchControls.joystickPointerId) {
    return;
  }
  scene.touchControls.joystickPointerId = null;
  scene.touchControls.joystickVector = { x: 0, y: 0 };
  scene.touchControls.joystickThumb.setPosition(
    scene.touchControls.joystickCenter.x,
    scene.touchControls.joystickCenter.y,
  );
}

function updatePortraitHint(scene: SceneAPI) {
  if (!scene.touchControls) {
    return;
  }
  scene.touchControls.portraitOverlay.setVisible(scene.touchControlsEnabled && isPortraitLayout());
}

function setTouchControlsVisible(scene: SceneAPI, visible: boolean) {
  if (!scene.touchControls) {
    return;
  }
  const nextVisible = scene.touchControlsEnabled && visible;
  scene.touchControls.container.setVisible(nextVisible);
  if (!nextVisible) {
    scene.touchControls.joystickPointerId = null;
    scene.touchControls.joystickVector = { x: 0, y: 0 };
    scene.touchControls.joystickThumb.setPosition(
      scene.touchControls.joystickCenter.x,
      scene.touchControls.joystickCenter.y,
    );
  }
  if (scene.lastTouchControlsVisibility !== nextVisible) {
    scene.lastTouchControlsVisibility = nextVisible;
    debugTouchControls(scene, 'touch controls visibility changed', { visible: nextVisible });
  }
}

function pulseTouchButton(scene: SceneAPI, button) {
  scene.tweens.add({
    targets: button,
    scale: 0.9,
    yoyo: true,
    duration: 80,
    ease: 'Sine.easeOut',
    onComplete: () => button.setScale(1),
  });
}

function handleTouchAction(scene: SceneAPI, action: TouchActionKey) {
  if (scene.state.phase !== 'playing') {
    return;
  }
  const now = scene.time.now;
  if (action === 'mainAttack') {
    scene.useMainAttack(now, scene.getAutoTargetIso(scene.playerStats.attackRange));
  } else if (action === 'classSkill') {
    scene.useClassSkill(now);
  } else if (action === 'repair') {
    scene.tryRepairBuilding();
  }
}

function updateTouchControlsInternal(scene: SceneAPI) {
  if (!scene.touchControls) {
    return;
  }
  updatePortraitHint(scene);
  scene.touchControls.container.setAlpha(scene.state.phase === 'countdown' ? 0.72 : 1);
  setTouchControlsVisible(
    scene,
    (scene.state.phase === 'countdown' || scene.state.phase === 'playing') && !isPortraitLayout(),
  );
}

export function touchControlsCreate(scene: SceneAPI): void {
  scene.touchControlsEnabled = checkIsTouchDevice(scene);
  if (!scene.touchControlsEnabled) {
    debugTouchControls(scene, 'touch controls skipped');
    return;
  }

  scene.controlsHint?.setVisible(false);
  const container = scene.add.container(0, 0).setDepth(7700).setScrollFactor(0);
  const joystickCenter = {
    x: scaleTouchControl(132),
    y: HEIGHT - scaleTouchControl(118),
  };
  const joystickZoneSize = scaleTouchControl(190);
  const joystickBaseRadius = scaleTouchControl(58);
  const joystickThumbRadius = scaleTouchControl(25);
  const joystickZone = scene.add.zone(joystickCenter.x, joystickCenter.y, joystickZoneSize, joystickZoneSize)
    .setOrigin(0.5)
    .setInteractive();
  const joystickBase = scene.add.circle(joystickCenter.x, joystickCenter.y, joystickBaseRadius, 0x132a3d, 0.34)
    .setStrokeStyle(scaleTouchControl(4), 0xf8ffe3, 0.42);
  const joystickThumb = scene.add.circle(joystickCenter.x, joystickCenter.y, joystickThumbRadius, 0xfff4c8, 0.74)
    .setStrokeStyle(scaleTouchControl(3), 0x6abbd7, 0.78);
  const buttons = {} as Partial<Record<TouchActionKey, Phaser.GameObjects.Container>>;
  const actionCenterX = WIDTH - scaleTouchControl(150);
  const actionCenterY = HEIGHT - scaleTouchControl(118);
  const actionRadiusX = scaleTouchControl(86);
  const actionRadiusY = scaleTouchControl(56);
  const { hero, attackIcon, skillIcon } = getClassActionPresentation(scene);
  const normalLayout: Partial<Record<TouchButtonSlot, [TouchActionKey, string, TouchActionIcon, number]>> = {
    left: ['mainAttack', hero.mainAttack, attackIcon, 0xf2bf52],
    right: ['classSkill', hero.skill, skillIcon, 0x75d8ff],
    bottom: ['repair', 'Repair', { texture: 'touchControlsAtlas', frame: 'touch_repair_01' }, 0x9fe9bf],
  };
  const slotPositions: Record<TouchButtonSlot, { x: number; y: number }> = {
    left: { x: actionCenterX - actionRadiusX, y: actionCenterY },
    top: { x: actionCenterX, y: actionCenterY - actionRadiusY },
    right: { x: actionCenterX + actionRadiusX, y: actionCenterY },
    bottom: { x: actionCenterX, y: actionCenterY + actionRadiusY },
  };
  Object.entries(normalLayout).forEach(([slot, definition]) => {
    const [action, label, icon, color] = definition as [TouchActionKey, string, TouchActionIcon, number];
    const point = slotPositions[slot as TouchButtonSlot];
    buttons[action] = createTouchActionButton(scene, action, point.x, point.y, label, icon, color);
  });
  const repairButtons: Phaser.GameObjects.Container[] = [];

  const portraitOverlay = createPortraitOverlay(scene);
  container.add([joystickZone, joystickBase, joystickThumb, ...Object.values(buttons), ...repairButtons]);
  scene.touchLayer.add([container, portraitOverlay]);
  scene.touchControls = {
    container,
    joystickBase,
    joystickThumb,
    joystickVector: { x: 0, y: 0 },
    joystickPointerId: null,
    joystickCenter,
    buttons,
    repairButtons,
    portraitOverlay,
  };

  joystickZone.on('pointerdown', (pointer) => {
    if (scene.state.phase !== 'playing') {
      return;
    }
    scene.ensureAudio();
    scene.touchControls.joystickPointerId = pointer.id;
    updateJoystickFromPointer(scene, pointer);
  });
  scene.input.on('pointermove', (pointer) => updateJoystickFromPointer(scene, pointer));
  scene.input.on('pointerup', (pointer) => releaseJoystick(scene, pointer));
  scene.input.on('pointerupoutside', (pointer) => releaseJoystick(scene, pointer));
  updateTouchControlsInternal(scene);
  debugTouchControls(scene, 'touch controls created');
}

export function setupMobileViewportHandlers(scene: SceneAPI): void {
  const refreshScale = () => {
    scene.scale.refresh();
    updateTouchControlsInternal(scene);
    debugTouchControls(scene, 'viewport refreshed');
  };
  const delayedRefresh = () => {
    refreshScale();
    window.setTimeout(refreshScale, 180);
  };

  window.addEventListener('resize', delayedRefresh, { passive: true });
  window.addEventListener('orientationchange', delayedRefresh, { passive: true });
  window.visualViewport?.addEventListener('resize', delayedRefresh, { passive: true });
  window.visualViewport?.addEventListener('scroll', delayedRefresh, { passive: true });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('resize', delayedRefresh);
    window.removeEventListener('orientationchange', delayedRefresh);
    window.visualViewport?.removeEventListener('resize', delayedRefresh);
    window.visualViewport?.removeEventListener('scroll', delayedRefresh);
  });
}

export function touchControlsUpdate(scene: SceneAPI): void {
  updateTouchControlsInternal(scene);
}
