/**
 * GuideMe User Simulation — Khmer Low-Digital-Literacy User Simulator
 *
 * Simulates a Khmer-speaking user with low digital literacy.
 * Acts ONLY on what GuideMe's guidance says — no hardcoded knowledge.
 */

import config from '../config/settings.js';

export class UserSimulator {
  constructor(page, options = {}) {
    this.page = page;
    this.thinkDelayMs = options.thinkDelayMs ?? config.thinkDelayMs;
    this.maxSteps = options.maxSteps ?? config.maxStepsPerTask;
    this.actionLog = [];
    this.stepCount = 0;
  }

  /** Simulate user hesitation before acting. */
  async think(extraMs = 0) {
    const delay = this.thinkDelayMs + extraMs + Math.floor(Math.random() * 300);
    await this.page.waitForTimeout(delay);
  }

  /** Log an action with outcome. */
  logAction(type, details, outcome = 'attempted') {
    const entry = { step: ++this.stepCount, type, details, outcome, timestamp: Date.now() };
    this.actionLog.push(entry);
    console.log(`  [Simulator] Step ${entry.step}: ${type} — ${JSON.stringify(details)} → ${outcome}`);
    return entry;
  }

  /** Click an element by its visible text. Returns true on success. */
  async clickByText(text, role = null) {
    await this.think();
    try {
      const locator = role
        ? this.page.getByRole(role, { name: text })
        : this.page.getByText(text, { exact: false }).first();
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.click();
      this.logAction('click', { text, role }, 'success');
      return true;
    } catch (err) {
      this.logAction('click', { text, role }, `failed: ${err.message?.slice(0, 80)}`);
      return false;
    }
  }

  /** Fill an input by its placeholder text. Tries exact then partial match. */
  async fillByPlaceholder(placeholder, value) {
    await this.think(150);
    try {
      let input = this.page.getByPlaceholder(placeholder, { exact: true });
      if (await input.count() === 0) {
        input = this.page.getByPlaceholder(placeholder, { exact: false }).first();
      }
      await input.waitFor({ state: 'visible', timeout: 5000 });
      await input.clear();
      await input.fill(value);
      this.logAction('fill', { placeholder, value: '***' }, 'success');
      return true;
    } catch (err) {
      this.logAction('fill', { placeholder }, `failed: ${err.message?.slice(0, 80)}`);
      return false;
    }
  }

  /** Take a screenshot (best-effort — never fails the task). */
  async screenshot(taskId, label) {
    const { default: path } = await import('path');
    const { mkdirSync } = await import('fs');
    const dir = path.join(config.resultsDir, 'screenshots', taskId);
    mkdirSync(dir, { recursive: true });
    const filename = path.join(dir, `${label.replace(/\s+/g, '_')}.png`);
    try {
      await this.page.screenshot({ path: filename, fullPage: false, timeout: 8000 });
    } catch { /* ignore */ }
    return filename;
  }

  /** Reset log for a new task. */
  reset() {
    this.actionLog = [];
    this.stepCount = 0;
  }
}

export default UserSimulator;
