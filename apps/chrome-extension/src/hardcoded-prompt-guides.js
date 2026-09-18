import { normalizeHardcodedPrompt, DEMO_MODE_ONLY_HARDCODED } from '@guideme/engine';
import numberProductsSequenceGuide from '../../../tutorials/spreadsheet/number-products-sequence.json';
import calculateTotalPriceGuide from '../../../tutorials/spreadsheet/calculate-total-price.json';
import shareFileEmailGuide from '../../../tutorials/spreadsheet/share-file-email.json';

/**
 * Deterministic prompt -> pre-built tutorial lookup for a small set of known
 * requests. These bypass AI guide generation entirely (no backend call, no
 * DynamicPageAnalyzer) so they always show the exact same hand-authored
 * steps. Any prompt that doesn't exactly match one of these falls through
 * unchanged to the normal dynamic guide generation flow.
 *
 * The prompt strings themselves are the single source of truth in
 * `@guideme/engine`'s hardcoded-demo-prompts module (shared with the chat
 * widget so it can skip its own AI calls for the same prompts); this map
 * only adds the tutorial content each one resolves to.
 */
const HARDCODED_PROMPT_GUIDES = [
  { prompt: 'របៀបដាក់លេខរៀងអោយទំនិញនីមួយៗ', tutorial: numberProductsSequenceGuide },
  { prompt: 'គណនាតម្លៃសរុបទំនិញនីមួយៗនៅtotal', tutorial: calculateTotalPriceGuide },
  { prompt: 'ចែករំលែកឯកសារ', tutorial: shareFileEmailGuide },
];

const NORMALIZED_GUIDES = HARDCODED_PROMPT_GUIDES.map(({ prompt, tutorial }) => ({
  normalized: normalizeHardcodedPrompt(prompt),
  tutorial,
}));

/**
 * Returns the pre-built tutorial for a known hardcoded prompt, or null if
 * demo mode is off or the prompt doesn't match one of the registered cases.
 * With DEMO_MODE_ONLY_HARDCODED false, this always returns null so every
 * prompt — including these 3 — goes through the normal dynamic-guide flow.
 * @param {string} userPrompt
 * @returns {Object|null}
 */
export function matchHardcodedPromptGuide(userPrompt) {
  if (!DEMO_MODE_ONLY_HARDCODED) return null;
  const normalized = normalizeHardcodedPrompt(userPrompt);
  if (!normalized) return null;
  const match = NORMALIZED_GUIDES.find((g) => g.normalized === normalized);
  return match ? match.tutorial : null;
}
