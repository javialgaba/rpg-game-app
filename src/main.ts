import * as Phaser from 'phaser';
import './style.css';
import { HEIGHT, WIDTH } from './gameConfig';
import { createMapEditorGameConfig } from './mapEditor/MapEditorScene';
import { FairyGuildScene } from './scenes/FairyGuildScene';

const isMapEditorRoute = window.location.pathname.replace(/\/+$/, '') === '/map-editor';
document.body.classList.toggle('map-editor-route', isMapEditorRoute);

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#a6c993',
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

const game = new Phaser.Game(isMapEditorRoute ? createMapEditorGameConfig() : gameConfig);

if (import.meta.env.DEV) {
  (window as typeof window & { __fairyGuildGame?: Phaser.Game }).__fairyGuildGame = game;
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Service worker registration failed.', error);
    });
  });
}
