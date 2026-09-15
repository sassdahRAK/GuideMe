// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

describe('ChatBoxWidgetOverlay Component Unit Tests', () => {
  test('ChatBoxWidgetOverlay renders open state, tabs, active HUD, and cross-tab notice', async () => {
    const tmpFile = path.resolve(rootDir, 'tests/.tmp-chat-box-test.mjs');

    esbuild.buildSync({
      entryPoints: [path.resolve(rootDir, 'packages/tutorial-ui/src/components/ChatBoxWidgetOverlay.jsx')],
      bundle: true,
      outfile: tmpFile,
      format: 'esm',
      external: ['react', 'react-dom'],
      nodePaths: [
        path.resolve(rootDir, 'packages/tutorial-ui/node_modules'),
        path.resolve(rootDir, 'node_modules'),
      ],
    });

    try {
      const { ChatBoxWidgetOverlay } = await import(pathToFileURL(tmpFile).href);
      expect(ChatBoxWidgetOverlay, 'ChatBoxWidgetOverlay component must export cleanly').toBeTruthy();

      // 1. Closed state returns null
      const closedHtml = renderToString(React.createElement(ChatBoxWidgetOverlay, { isOpen: false }));
      expect(closedHtml).toBe('');

      // 2. Open Idle state — renders GuideMe AI Coach header and prompt input
      const openHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, {
          isOpen: true,
          language: 'km',
          availableTutorials: [{ id: 'tut-1', name: 'Google Docs Tour' }],
        })
      );
      expect(openHtml.includes('GuideMe AI'), 'Should render GuideMe AI header').toBeTruthy();
      expect(openHtml.includes('Coach'), 'Should render Coach badge').toBeTruthy();
      expect(openHtml.includes('Google Docs Tour'), 'Should render catalog suggestion chip').toBeTruthy();

      // 3. Active Walkthrough state on host tab
      const activeGuideHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, {
          isOpen: true,
          language: 'en',
          engineState: {
            isActive: true,
            currentStepIndex: 0,
            totalSteps: 3,
            tutorial: { name: 'Search Tutorial' },
            currentStep: { title: 'Click Search Bar' },
          },
        })
      );
      expect(activeGuideHtml.includes('Search Tutorial'), 'Should render active guide title').toBeTruthy();
      expect(activeGuideHtml.includes('1/3'), 'Should render step counter pill').toBeTruthy();
      expect(activeGuideHtml.includes('Click Search Bar'), 'Should render step title').toBeTruthy();

      // 4. Cross-Tab / Different Tab Notice
      const crossTabHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, {
          isOpen: true,
          language: 'en',
          engineState: { isActive: false },
        })
      );
      expect(crossTabHtml.length > 0, 'Should render overlay').toBeTruthy();

      // 5. Message Timestamps: Verifies Khmer "ឥឡូវនេះ" timestamp for recent messages
      const nowKhmerHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, { isOpen: true, language: 'km' })
      );
      expect(
        nowKhmerHtml.includes('ឥឡូវនេះ'),
        'Initial assistant message should display "ឥឡូវនេះ" for recent timestamp'
      ).toBeTruthy();

      const nowEnHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, { isOpen: true, language: 'en' })
      );
      expect(
        nowEnHtml.includes('Just now'),
        'Initial assistant message should display "Just now" in English'
      ).toBeTruthy();
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });
});
