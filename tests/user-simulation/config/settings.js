/**
 * GuideMe User Simulation — Central Configuration
 * All settings resolve from .env.test — no production env vars are read here.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const config = {
  // ── Test website ─────────────────────────────────────────────────────────
  testSiteUrl: process.env.TEST_SITE_URL || 'http://localhost:7777',
  testSitePort: parseInt(process.env.TEST_SITE_PORT || '7777', 10),

  // ── GuideMe backend (optional — extension falls back to offline mode) ─────
  guidemeApiUrl: process.env.GUIDEME_API_URL || '',

  // ── Extension (unpacked, already built — never rebuilds) ─────────────────
  extensionPath: path.resolve(
    ROOT,
    process.env.EXTENSION_PATH || '../../apps/chrome-extension/.output/chrome-mv3'
  ),

  // ── Playwright ────────────────────────────────────────────────────────────
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOW_MO || '0', 10),
  timeoutMs: parseInt(process.env.TIMEOUT_MS || '30000', 10),

  // ── Test accounts (fake — isolated test environment only) ─────────────────
  testUser: {
    email: process.env.TEST_USER_EMAIL || 'test-simulator@guideme-test.local',
    password: process.env.TEST_USER_PASSWORD || 'SimulatorTest2024!',
  },

  // ── Simulation behaviour ──────────────────────────────────────────────────
  maxStepsPerTask: parseInt(process.env.MAX_STEPS_PER_TASK || '20', 10),
  thinkDelayMs: parseInt(process.env.THINK_DELAY_MS || '200', 10),

  // ── Results ───────────────────────────────────────────────────────────────
  resultsDir: path.resolve(ROOT, process.env.RESULTS_DIR || './results'),
};

export default config;
