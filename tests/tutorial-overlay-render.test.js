import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

describe('TutorialOverlay Component & Scope Integrity Tests', () => {
  test('AST Scope Analysis: All UI components have zero undeclared identifier references', () => {
    const componentDirs = [
      path.resolve(rootDir, 'packages/tutorial-ui/src/components'),
      path.resolve(rootDir, 'apps/chrome-extension/entrypoints/content/components'),
    ];

    const KNOWN_GLOBALS = new Set([
      'React',
      'window',
      'document',
      'console',
      'chrome',
      'Date',
      'Math',
      'Boolean',
      'Set',
      'Map',
      'Array',
      'String',
      'Number',
      'Object',
      'Promise',
      'ResizeObserver',
      'PointerEvent',
      'MouseEvent',
      'CustomEvent',
      'FocusEvent',
      'AbortController',
      'setTimeout',
      'clearTimeout',
      'fetch',
      'localStorage',
      'sessionStorage',
      'location',
    ]);

    const filesToInspect = [];
    for (const dir of componentDirs) {
      if (!fs.existsSync(dir)) continue;
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry.endsWith('.jsx') || entry.endsWith('.js')) {
          filesToInspect.push(path.join(dir, entry));
        }
      }
    }

    assert.ok(filesToInspect.length > 0, 'Should find UI component files to inspect');

    const failures = [];
    for (const file of filesToInspect) {
      const code = fs.readFileSync(file, 'utf-8');
      const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });

      traverse(ast, {
        Program(programPath) {
          programPath.traverse({
            Identifier(idPath) {
              if (
                idPath.isReferencedIdentifier() &&
                !KNOWN_GLOBALS.has(idPath.node.name) &&
                !idPath.scope.hasBinding(idPath.node.name)
              ) {
                failures.push({
                  file: path.basename(file),
                  name: idPath.node.name,
                  line: idPath.node.loc?.start?.line,
                });
              }
            },
          });
        },
      });
    }

    assert.deepStrictEqual(
      failures,
      [],
      `Found undeclared variables in UI components: ${JSON.stringify(failures)}`
    );
  });

  test('TutorialOverlay renders cleanly in active guide state without exceptions', async () => {
    const tmpFile = path.resolve(rootDir, 'tests/.tmp-tutorial-overlay-test.mjs');

    esbuild.buildSync({
      entryPoints: [path.resolve(rootDir, 'packages/tutorial-ui/src/components/TutorialOverlay.jsx')],
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
      const { TutorialOverlay } = await import(tmpFile);
      assert.ok(TutorialOverlay, 'TutorialOverlay component must export cleanly');

      // 1. Active State (Walkthrough in progress on webpage)
      const mockActiveState = {
        isActive: true,
        isCompleted: false,
        boundingBox: { top: 80, left: 150, width: 90, height: 36 },
        currentStepIndex: 0,
        totalSteps: 2,
        language: 'km',
        stepBadgeText: 'ជំហាន 1/2',
        alertState: 'normal',
        targetMissing: false,
        actionPayload: {
          title: 'ចុច "Share"',
          content: 'សូមចុចលើប៊ូតុង Share ដើម្បីបន្ត។',
          placement: 'bottom',
          actionText: 'ចុចទីនេះ',
        },
      };

      const activeHtml = renderToString(React.createElement(TutorialOverlay, { state: mockActiveState }));
      assert.ok(activeHtml.includes('guideme-root-overlay'), 'Should render root overlay container');
      assert.ok(activeHtml.includes('guideme-target-glow'), 'Should render target spotlight frame');
      assert.ok(activeHtml.includes('Share'), 'Should include target step content');

      // 2. Idle State (No guide running, floating button persistent)
      const mockIdleState = {
        isActive: false,
        isCompleted: false,
        language: 'km',
      };
      const idleHtml = renderToString(React.createElement(TutorialOverlay, { state: mockIdleState }));
      assert.ok(idleHtml.length > 0, 'Idle state should render floating assistant button');

      // 3. Completed State (Celebration dialog)
      const mockCompletedState = {
        isActive: false,
        isCompleted: true,
        language: 'km',
        tutorial: { name: 'Google Docs Tour' },
      };
      const completedHtml = renderToString(React.createElement(TutorialOverlay, { state: mockCompletedState }));
      assert.ok(completedHtml.includes('Google Docs Tour'), 'Completed state should render tutorial completion name');
    } finally {
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  });
});
