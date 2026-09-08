/**
 * Prompt Classifier — Pre-filters user input before guide generation.
 *
 * Three categories:
 *  - 'greeting'   → Social pleasantries (e.g., "hi", "hi bro", "heyyy", "yo bro", "សួស្ដីបង"). AI greets back.
 *  - 'unclear'    → Too vague to act on without target (e.g., "help", "do something", "hmm"). AI asks for clarification.
 *  - 'actionable' → Clear intent that can drive an in-page tutorial (e.g., "click search", "help me share doc", "export data").
 */

// ── Normalization Helper ────────────────────────────────────────────────────────
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    // Collapse 3+ repeating characters (e.g., "broooo" -> "bro", "hiiiii" -> "hi", "heyyyy" -> "hey", "helloooo" -> "hello", "suuuup" -> "sup")
    .replace(/(.)\1{2,}/g, '$1')
    // Remove leading/trailing punctuation and symbols
    .replace(/^[\s!.,?~#@$%^&*()_\-+=\[\]{}|\\:;"'<>\/]+|[\s!.,?~#@$%^&*()_\-+=\[\]{}|\\:;"'<>\/]+$/g, '')
    .trim();
}

// ── Action Verbs & Phrases that signal clear intent ─────────────────────────────
const ACTION_VERBS_EN = /\b(click|press|tap|open|go\s+to|navigate|visit|search|find|type|enter|fill|submit|save|apply|buy|add|remove|delete|edit|create|sign\s*in|log\s*in|sign\s*up|register|checkout|download|upload|share|invite|send|copy|paste|select|toggle|switch|enable|disable|view|show\s+me\s+how|scroll|export|import|print|filter|sort|move|drag|drop|choose|pick|check|uncheck|setup|set\s*up|manage|customize)\b/i;

const ACTION_VERBS_KM = /(ចុច|បើក|ទៅ|ស្វែងរក|វាយ|បញ្ចូល|រក្សាទុក|ទិញ|បន្ថែម|លុប|កែ|បង្កើត|ចូល|ចុះឈ្មោះ|ទាញយក|ផ្ញើ|ចម្លង|ជ្រើសរើស|មើល|ចែករំលែក|អញ្ជើញ|ប្តូរ|ទាញ|ទម្លាក់|កំណត់)/;

const ACTION_PHRASES_EN = /\b(help\s+me\s+(to\s+)?(share|click|open|find|search|sign|log|do|make|get|edit|create|invite|send|save|delete|change|setup|set\s*up|export|import|view|manage)|how\s+to|how\s+can\s+i|can\s+you\s+help\s+me\s+with|i\s+want\s+to|i\s+need\s+to|walk\s+me\s+through)\b/i;

const ACTION_PHRASES_KM = /(ជួយ\s*(ខ្ញុំ)?\s*(ក្នុងការ|រក|បើក|ចុច|ចែករំលែក|ផ្ញើ|បង្កើត|កែ|ចូល)|របៀប|ចង់|ត្រូវ)/;

// ── Greetings Vocabulary ────────────────────────────────────────────────────────
const GREETING_STARTERS_EN = /^(hi|hello|hey|heya|yo|hiya|howdy|sup|what'?s\s*up|wassup|wazzup|good\s*(morning|afternoon|evening|night|day)|greetings|salute|hola|bonjour|aloha|namaste)$/i;

const VOCATIVES_EN = /^(there|everyone|everybody|guys|guy|buddy|buddies|pal|pals|friend|friends|mate|mates|bro|broo|brother|broth|dude|man|sis|sister|fam|homie|homies|boss|chief|sir|ma'?am|team|all|y'?all|folks|bot|ai|guideme|assistant|my\s+friend|my\s+bro|my\s+guy)$/i;

const GREETING_PATTERNS_KM = [
  /^(សួស្ដី|ជំរាបសួរ|សួស្តី|ជម្រាបសួរ|ហេឡូ|ហាយ|សួស្ដីបាទ|សួស្ដីចាស)(\s*(បង|ប្អូន|មិត្ត|ប្រូ|អ្នកទាំងអស់គ្នា|បងប្រុស|បងស្រី|លោក|លោកស្រី|អ្នកគ្រូ|លោកគ្រូ|អូន|គ្នា|bro|brother|dude|mate|friend|team))?[\s!.,។?]*$/i,
];

// ── Unclear / Too-Vague Patterns ───────────────────────────────────────────────
const UNCLEAR_PATTERNS_EN = [
  /^(help|help me|do something|do it|go|start|please|thanks|thank you|ok|okay|yes|no|idk|hmm|umm|huh|what|why|how|show me|tell me|guide me|assist me|i need help|can you help)[\s!.,?]*$/i,
];

const UNCLEAR_PATTERNS_KM = [
  /^(ជួយ|ជួយខ្ញុំ|ធ្វើអ្វី|សូម|អរគុណ|បាទ|ចាស|យ៉ាងម៉េច|អ្វី|ហេតុអ្វី|បង្ហាញ|ប្រាប់ខ្ញុំ)[\s!.,។?]*$/,
];

const MIN_ACTIONABLE_LENGTH = 3;
const MAX_UNCLEAR_WORD_COUNT = 2;

/**
 * Checks if normalized tokens represent a pure greeting (e.g. "hi bro", "yo dude", "good morning team").
 */
function isGreetingEnglish(normalized) {
  if (!normalized) return false;

  // Single word greeting (e.g., "hi", "hello", "hey", "sup")
  if (GREETING_STARTERS_EN.test(normalized)) return true;

  // Multi-word greeting combinations
  // 1. "<starter> <vocative>" e.g., "hi bro", "hey man", "hello there", "what's up guys"
  // 2. "<starter> there <vocative>" e.g., "hi there friend", "hey there bro"
  // 3. "<vocative> <starter>" e.g., "bro hi", "hey bro"
  const words = normalized.split(/\s+/);
  
  if (words.length >= 2 && words.length <= 4) {
    const firstWord = words[0];
    const rest = words.slice(1).join(' ');

    if (GREETING_STARTERS_EN.test(firstWord) && (VOCATIVES_EN.test(rest) || rest === 'there')) {
      return true;
    }

    if (words.length === 3 && GREETING_STARTERS_EN.test(firstWord) && words[1] === 'there' && VOCATIVES_EN.test(words[2])) {
      return true;
    }

    // "good morning bro", "good afternoon team"
    if (words.length >= 3 && /^(good)$/i.test(words[0]) && /^(morning|afternoon|evening|night|day)$/i.test(words[1])) {
      const remaining = words.slice(2).join(' ');
      if (!remaining || VOCATIVES_EN.test(remaining)) return true;
    }

    // "what's up bro"
    if (/^(what'?s|whats)$/i.test(words[0]) && words[1] === 'up') {
      const remaining = words.slice(2).join(' ');
      if (!remaining || VOCATIVES_EN.test(remaining)) return true;
    }

    // "bro hi", "dude hello"
    const lastWord = words[words.length - 1];
    const prefix = words.slice(0, words.length - 1).join(' ');
    if (GREETING_STARTERS_EN.test(lastWord) && VOCATIVES_EN.test(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Classifies a user prompt into one of three categories.
 *
 * @param {string} rawPrompt - The user's raw input text
 * @returns {{ type: 'greeting'|'unclear'|'actionable', responses: { km: string, en: string } }}
 */
export function classifyPrompt(rawPrompt) {
  const original = (rawPrompt || '').trim();
  const normalized = normalizeText(original);

  // Empty input is implicitly unclear
  if (!normalized) {
    return {
      type: 'unclear',
      responses: {
        km: 'សូមប្រាប់ខ្ញុំថាអ្នកចង់ធ្វើអ្វីលើទំព័រនេះ? ឧទាហរណ៍: "ចុចប៊ូតុង Sign In" ឬ "ស្វែងរកផលិតផល"',
        en: 'What would you like to do on this page? For example: "Click the Sign In button" or "Search for a product"',
      },
    };
  }

  // ── 1. Actionable Detection (check FIRST if explicit action verbs or phrases exist) ─
  const hasActionVerb = ACTION_VERBS_EN.test(original) || ACTION_VERBS_KM.test(original);
  const hasActionPhrase = ACTION_PHRASES_EN.test(original) || ACTION_PHRASES_KM.test(original);

  if (hasActionVerb || hasActionPhrase) {
    return { type: 'actionable', responses: { km: '', en: '' } };
  }

  // If the prompt contains a quoted UI label or selector, treat as actionable
  const hasQuotedEntity = /["']([^"']+)["']/.test(original);
  if (hasQuotedEntity && original.length >= MIN_ACTIONABLE_LENGTH) {
    return { type: 'actionable', responses: { km: '', en: '' } };
  }

  // ── 2. Greeting Detection ────────────────────────────────────────────────
  const isGreetingEN = isGreetingEnglish(normalized);
  const isGreetingKM = GREETING_PATTERNS_KM.some((pattern) => pattern.test(original) || pattern.test(normalized));

  if (isGreetingEN || isGreetingKM) {
    return {
      type: 'greeting',
      responses: {
        km: 'សួស្ដី! 👋 ខ្ញុំជាជំនួយការ GuideMe។ តើអ្នកចង់ឱ្យខ្ញុំជួយណែនាំអ្វីលើទំព័រនេះ?',
        en: "Hello! 👋 I'm your GuideMe assistant. What would you like me to help you with on this page?",
      },
    };
  }

  // ── 3. Unclear Detection ────────────────────────────────────────────────
  const isUnclearEN = UNCLEAR_PATTERNS_EN.some((pattern) => pattern.test(original) || pattern.test(normalized));
  const isUnclearKM = UNCLEAR_PATTERNS_KM.some((pattern) => pattern.test(original) || pattern.test(normalized));

  if (isUnclearEN || isUnclearKM) {
    return {
      type: 'unclear',
      responses: {
        km: 'សូមប្រាប់ខ្ញុំឱ្យច្បាស់ជាងនេះ។ ឧទាហរណ៍: "ចុចប៊ូតុង Login" ឬ "វាយ email នៅក្នុង search bar"',
        en: 'Could you be more specific? For example: "Click the Login button" or "Type email in the search bar"',
      },
    };
  }

  // Short prompts without action verbs or labels are likely unclear
  const wordCount = normalized.split(/\s+/).length;
  if (normalized.length < MIN_ACTIONABLE_LENGTH || wordCount <= MAX_UNCLEAR_WORD_COUNT) {
    // If the short text could be a UI button/tab title (e.g. "Settings", "Profile", "Dashboard"), treat as actionable
    const couldBeLabel = /^[A-Z]/.test(original) && wordCount === 1 && original.length >= 3;
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
