// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

// @babel/traverse ships as a CommonJS module; extract the default traversal fn.
const traverse = (traverseModule as unknown as { default: typeof traverseModule }).default ?? traverseModule;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

interface FailureRecord {
  file: string;
  name: string;
  line: number | undefined;
}

describe('TutorialOverlay Component & Scope Integrity Tests', () => {
  test('AST Scope Analysis: All UI components have zero undeclared identifier references', () => {
    const componentDirs = [
      path.resolve(rootDir, 'packages/tutorial-ui/src/components'),
      path.resolve(rootDir, 'apps/chrome-extension/entrypoints/content/components'),
    ];

    // Well-known browser & JS globals — identifiers that are intentionally undeclared in source
    const KNOWN_GLOBALS = new Set([
      'React', 'window', 'document', 'console', 'chrome', 'Date', 'Math',
      'Boolean', 'Set', 'Map', 'Array', 'String', 'Number', 'Object', 'Promise',
      'ResizeObserver', 'PointerEvent', 'MouseEvent', 'CustomEvent', 'FocusEvent',
      'AbortController', 'setTimeout', 'clearTimeout', 'fetch', 'localStorage',
      'sessionStorage', 'location', 'HTMLElement',
    ]);

    const filesToInspect: string[] = [];
    for (const dir of componentDirs) {
      if (!fs.existsSync(dir)) continue;
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry.endsWith('.jsx') || entry.endsWith('.js') || entry.endsWith('.tsx') || entry.endsWith('.ts')) {
          filesToInspect.push(path.join(dir, entry));
        }
      }
    }

    expect(filesToInspect.length > 0, 'Should find UI component files to inspect').toBeTruthy();

    const failures: FailureRecord[] = [];
    for (const file of filesToInspect) {
      const code = fs.readFileSync(file, 'utf-8');
      const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

      traverse(ast, {
        Program(programPath) {
          programPath.traverse({
            Identifier(idPath) {
              // Skip any identifier that lives inside a TypeScript-only node (type annotation, etc.)
              if (idPath.findParent((p) => p.node.type.startsWith('TS'))) return;

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

    expect(failures).toEqual([]);
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
      expect(TutorialOverlay, 'TutorialOverlay component must export cleanly').toBeTruthy();

      // 1. Active State — walkthrough in progress on the webpage
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
      expect(activeHtml.includes('guideme-root-overlay'), 'Should render root overlay container').toBeTruthy();
      expect(activeHtml.includes('guideme-target-glow'), 'Should render target spotlight frame').toBeTruthy();
      expect(activeHtml.includes('Share'), 'Should include target step content').toBeTruthy();

      // 2. Idle State — no guide running, floating button persists
      const mockIdleState = { isActive: false, isCompleted: false, language: 'km' };
      const idleHtml = renderToString(React.createElement(TutorialOverlay, { state: mockIdleState }));
      expect(idleHtml.length > 0, 'Idle state should render floating assistant button').toBeTruthy();

      // 3. Completed State — celebration dialog
      const mockCompletedState = {
        isActive: false,
        isCompleted: true,
        language: 'km',
        tutorial: { name: 'Google Docs Tour' },
      };
      const completedHtml = renderToString(React.createElement(TutorialOverlay, { state: mockCompletedState }));
      expect(completedHtml.includes('Google Docs Tour'), 'Completed state should render tutorial completion name').toBeTruthy();
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });
});
