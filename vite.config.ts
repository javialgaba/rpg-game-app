import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: isBuild
        ? [
          {
            find: /^phaser$/,
            replacement: fileURLToPath(new URL('./node_modules/phaser/src/phaser.js', import.meta.url)),
          },
          {
            find: /^phaser3spectorjs$/,
            replacement: fileURLToPath(new URL('./src/shims/phaser3spectorjs.ts', import.meta.url)),
          },
        ]
        : [],
    },
    optimizeDeps: isBuild
      ? undefined
      : {
        include: ['phaser'],
      },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'phaser',
                test: /node_modules[\\/]phaser[\\/]src[\\/]/,
                priority: 30,
                maxSize: 450 * 1024,
              },
              {
                name: 'level-system',
                test: /src[\\/]levels[\\/]/,
                priority: 20,
              },
              {
                name: 'game-data',
                test: /src[\\/](gameConfig|sceneVariants)\.ts$/,
                priority: 20,
              },
            ],
          },
        },
      },
    },
    test: {
      include: ['src/**/*.test.ts'],
    },
  };
});