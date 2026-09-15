import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Use jsdom so DOM globals (window, document, etc.) are available.
    // The test suite mocks document itself, so this mostly avoids
    // "ReferenceError: document is not defined" in non-mocked paths.
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    testTimeout: 25_000,
    hookTimeout: 25_000,
  },
  resolve: {
    alias: {
      '@guideme/engine': path.resolve(__dirname, 'packages/engine/src/index.ts'),
      '@guideme/chrome-adapter': path.resolve(__dirname, 'packages/chrome-adapter/src/index.ts'),
      '@guideme/tutorial-ui': path.resolve(__dirname, 'packages/tutorial-ui/src/index.js'),
    },
  },
});
