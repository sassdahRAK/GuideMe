/**
 * A small, fixed set of prompts that must always show a hand-authored
 * tutorial and never trigger any AI/LLM call — used for a reliable,
 * fully offline demo. This module only knows the prompt strings
 * themselves (not the tutorial content), so both the app layer (which
 * owns the actual /tutorials JSON) and any UI package (e.g. the in-page
 * chat widget) can check "is this prompt hardcoded?" without either one
 * depending on the other, and without duplicating the prompt list.
 */
export const HARDCODED_DEMO_PROMPTS = [
  'របៀបដាក់លេខរៀងអោយទំនិញនីមួយៗ',
  'គណនាតម្លៃសរុបទំនិញនីមួយៗនៅtotal',
  'ចែករំលែកឯកសារ',
];

/**
 * Demo-mode switch — single source of truth for both halves of the demo:
 *   true  -> the 3 prompts above short-circuit to their hand-authored guide
 *            (see isHardcodedDemoPrompt below and matchHardcodedPromptGuide
 *            in the app layer), and every AI/dynamic-guide code path (backend
 *            intent validation, the assistant chat, the local
 *            DynamicPageAnalyzer fallback) is disabled for anything else.
 *   false -> the hardcoded lookup is inert (always "no match") and the
 *            normal AI dynamic-guide flow runs for every prompt, including
 *            these 3 — i.e. full dynamic-guide behavior restored.
 */
export const DEMO_MODE_ONLY_HARDCODED = false;

/**
 * Normalizes a prompt for exact-match comparison: trims outer whitespace,
 * collapses internal whitespace runs, strips trailing punctuation, and
 * lowercases any Latin characters (Khmer script has no case).
 * @param {string} value
 * @returns {string}
 */
export function normalizeHardcodedPrompt(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[។?!.！？\s]+$/u, '')
    .toLowerCase();
}

const NORMALIZED_DEMO_PROMPTS = new Set(HARDCODED_DEMO_PROMPTS.map(normalizeHardcodedPrompt));

/**
 * True when the given prompt exactly matches one of the known hardcoded
 * demo cases AND demo mode is on. Callers should skip all AI/backend calls
 * when this is true. Always false while DEMO_MODE_ONLY_HARDCODED is off,
 * so the 3 prompts behave like any other prompt (full AI flow).
 * @param {string} userPrompt
 * @returns {boolean}
 */
export function isHardcodedDemoPrompt(userPrompt) {
  if (!DEMO_MODE_ONLY_HARDCODED) return false;
  const normalized = normalizeHardcodedPrompt(userPrompt);
  return normalized.length > 0 && NORMALIZED_DEMO_PROMPTS.has(normalized);
}
