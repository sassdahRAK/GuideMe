/**
 * Prompt Classifier — Pre-filters user input before guide generation.
 *
 * Three categories:
 *  - 'greeting'   → Social pleasantries (hi, hello, សួស្ដី). AI greets back.
 *  - 'unclear'    → Too vague to act on (e.g. "help", "do something"). AI asks for clarification.
 *  - 'actionable' → Clear intent that can drive a tutorial (e.g. "click the search button").
 */

// ── Greeting Patterns ──────────────────────────────────────────────────────────
// Matches standalone greetings in English and Khmer.
// Uses word boundaries so "hello world" matches but "helloworld" doesn't.
const GREETING_PATTERNS_EN = [
  /^(hi|hello|hey|yo|hiya|howdy|sup|what'?s\s*up|good\s*(morning|afternoon|evening|night)|greetings)[\s!.,?]*$/i,
  /^(hi|hello|hey)\s+(there|everyone|guys|buddy|friend|mate)[\s!.,?]*$/i,
];

const GREETING_PATTERNS_KM = [
  /^(សួស្ដី|ជំរាបសួរ|ហេឡូ|ហាយ)[\s!.,។?]*$/,
];

// ── Unclear / Too-Vague Patterns ───────────────────────────────────────────────
// Short inputs with no specific target or action verb.
const UNCLEAR_PATTERNS_EN = [
  /^(help|help me|do something|do it|go|start|please|thanks|thank you|ok|okay|yes|no|idk|hmm|umm|huh|what|why|how|show me|tell me|guide me|assist me|i need help|can you help)[\s!.,?]*$/i,
];

const UNCLEAR_PATTERNS_KM = [
  /^(ជួយ|ជួយខ្ញុំ|ធ្វើអ្វី|សូម|អរគុណ|បាទ|ចាស|យ៉ាងម៉េច|អ្វី|ហេតុអ្វី|បង្ហាញ|ប្រាប់ខ្ញុំ)[\s!.,។?]*$/,
];

// Minimum meaningful length for an actionable prompt (in characters)
const MIN_ACTIONABLE_LENGTH = 4;

// Maximum words that could still be "unclear" even without pattern match
const MAX_UNCLEAR_WORD_COUNT = 2;

// ── Action Verbs that signal clear intent ──────────────────────────────────────
const ACTION_VERBS_EN = /\b(click|press|tap|open|go\s+to|navigate|visit|search|find|type|enter|fill|submit|save|apply|buy|add|remove|delete|edit|create|sign\s*in|log\s*in|sign\s*up|register|checkout|download|upload|share|invite|send|copy|paste|select|toggle|switch|enable|disable|view|show\s+me\s+how|scroll)\b/i;

const ACTION_VERBS_KM = /(ចុច|បើក|ទៅ|ស្វែងរក|វាយ|បញ្ចូល|រក្សាទុក|ទិញ|បន្ថែម|លុប|កែ|បង្កើត|ចូល|ចុះឈ្មោះ|ទាញយក|ផ្ញើ|ចម្លង|ជ្រើសរើស|មើល)/;


/**
 * Classifies a user prompt into one of three categories.
 *
 * @param {string} rawPrompt - The user's raw input text
 * @returns {{ type: 'greeting'|'unclear'|'actionable', responses: { km: string, en: string } }}
 */
export function classifyPrompt(rawPrompt) {
  const prompt = (rawPrompt || '').trim();

  // Empty input is implicitly unclear
  if (!prompt) {
    return {
      type: 'unclear',
      responses: {
        km: 'សូមប្រាប់ខ្ញុំថាអ្នកចង់ធ្វើអ្វីលើទំព័រនេះ? ឧទាហរណ៍: "ចុចប៊ូតុង Sign In" ឬ "ស្វែងរកផលិតផល"',
        en: 'What would you like to do on this page? For example: "Click the Sign In button" or "Search for a product"',
      },
    };
  }

  // ── 1. Greeting Detection ────────────────────────────────────────────────
  const isGreetingEN = GREETING_PATTERNS_EN.some((pattern) => pattern.test(prompt));
  const isGreetingKM = GREETING_PATTERNS_KM.some((pattern) => pattern.test(prompt));

  if (isGreetingEN || isGreetingKM) {
    return {
      type: 'greeting',
      responses: {
        km: 'សួស្ដី! 👋 ខ្ញុំជាជំនួយការ GuideMe។ តើអ្នកចង់ឱ្យខ្ញុំជួយណែនាំអ្វីលើទំព័រនេះ?',
        en: 'Hello! 👋 I\'m your GuideMe assistant. What would you like me to help you with on this page?',
      },
    };
  }

  // ── 2. Actionable Detection (check BEFORE unclear — specific beats vague) ─
  const hasActionVerbEN = ACTION_VERBS_EN.test(prompt);
  const hasActionVerbKM = ACTION_VERBS_KM.test(prompt);

  if (hasActionVerbEN || hasActionVerbKM) {
    return { type: 'actionable', responses: { km: '', en: '' } };
  }

  // If the prompt is long enough and has a quoted entity, treat as actionable
  const hasQuotedEntity = /["']([^"']+)["']/.test(prompt);
  if (hasQuotedEntity && prompt.length >= MIN_ACTIONABLE_LENGTH) {
    return { type: 'actionable', responses: { km: '', en: '' } };
  }

  // ── 3. Unclear Detection ────────────────────────────────────────────────
  const isUnclearEN = UNCLEAR_PATTERNS_EN.some((pattern) => pattern.test(prompt));
  const isUnclearKM = UNCLEAR_PATTERNS_KM.some((pattern) => pattern.test(prompt));

  if (isUnclearEN || isUnclearKM) {
    return {
      type: 'unclear',
      responses: {
        km: 'សូមប្រាប់ខ្ញុំឱ្យច្បាស់ជាងនេះ។ ឧទាហរណ៍: "ចុចប៊ូតុង Login" ឬ "វាយ email នៅក្នុង search bar"',
        en: 'Could you be more specific? For example: "Click the Login button" or "Type email in the search bar"',
      },
    };
  }

  // Short prompts without action verbs are likely unclear
  const wordCount = prompt.split(/\s+/).length;
  if (prompt.length < MIN_ACTIONABLE_LENGTH || wordCount <= MAX_UNCLEAR_WORD_COUNT) {
    // But if the short text could be a UI label (e.g. "Settings", "Profile"), treat as actionable
    const couldBeLabel = /^[A-Z]/.test(prompt) && wordCount === 1 && prompt.length >= 3;
    if (couldBeLabel) {
      return { type: 'actionable', responses: { km: '', en: '' } };
    }

    return {
      type: 'unclear',
      responses: {
        km: 'សូមប្រាប់ខ្ញុំឱ្យច្បាស់ជាងនេះ។ ឧទាហរណ៍: "ចុចប៊ូតុង Login" ឬ "វាយ email នៅក្នុង search bar"',
        en: 'Could you be more specific? For example: "Click the Login button" or "Type email in the search bar"',
      },
    };
  }

  // ── 4. Default: treat as actionable ──────────────────────────────────────
  return { type: 'actionable', responses: { km: '', en: '' } };
}
