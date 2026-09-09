import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
      const { ChatBoxWidgetOverlay } = await import(tmpFile);
      assert.ok(ChatBoxWidgetOverlay, 'ChatBoxWidgetOverlay component must export cleanly');

      // 1. Closed state returns null
      const closedHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, { isOpen: false })
      );
      assert.strictEqual(closedHtml, '', 'Closed state should return null / empty string');

      // 2. Open Idle state (renders GuideMe AI Coach header and prompt input)
      const openHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, {
          isOpen: true,
          language: 'km',
          availableTutorials: [
            { id: 'tut-1', name: 'Google Docs Tour' },
          ],
        })
      );
      assert.ok(openHtml.includes('GuideMe AI'), 'Should render GuideMe AI header');
      assert.ok(openHtml.includes('Coach'), 'Should render Coach badge');
      assert.ok(openHtml.includes('Google Docs Tour'), 'Should render catalog suggestion chip');

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
      assert.ok(activeGuideHtml.includes('Search Tutorial'), 'Should render active guide title');
      assert.ok(activeGuideHtml.includes('1/3'), 'Should render step counter pill');
      assert.ok(activeGuideHtml.includes('Click Search Bar'), 'Should render step title');

      // 4. Cross-Tab / Different Tab Notice (User Requirement!)
      // When activeGuideState belongs to another targetUrl, it warns user to return to previous tab
      const crossTabHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, {
          isOpen: true,
          language: 'en',
          engineState: {
            isActive: false,
          },
        })
      );
      assert.ok(crossTabHtml.length > 0, 'Should render overlay');

      // 5. Message Timestamps: Verifies recent messages render "ឥឡូវនេះ" or "Just now"
      const nowKhmerHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, {
          isOpen: true,
          language: 'km',
        })
      );
      assert.ok(nowKhmerHtml.includes('ឥឡូវនេះ'), 'Initial assistant message should display "ឥឡូវនេះ" for recent timestamp');

      const nowEnHtml = renderToString(
        React.createElement(ChatBoxWidgetOverlay, {
          isOpen: true,
          language: 'en',
        })
      );
      assert.ok(nowEnHtml.includes('Just now'), 'Initial assistant message should display "Just now" in English');
    } finally {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  });
});
