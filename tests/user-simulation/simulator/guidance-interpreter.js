/**
 * GuideMe — Guidance Interpreter
 *
 * Parses GuideMe's noise-filtered guidance texts into actionable instructions.
 * The simulator acts ONLY on what this returns — no hardcoded fallbacks.
 *
 * Output quality directly reflects GuideMe's guidance quality:
 *  clear guidance  → high confidence → simulator succeeds
 *  vague guidance  → low confidence  → simulator gets confused → task fails
 *  no guidance     → no instructions → task fails immediately
 */

const ACTION_KEYWORDS = {
  click:    ['ចុច', 'click', 'press', 'tap', 'select', 'ចុចលើ', 'ចុចប៊ូតុង'],
  fill:     ['វាយ', 'type', 'fill', 'enter', 'បញ្ចូល', 'សរសេរ', 'ដាក់'],
  navigate: ['ទៅ', 'go to', 'open', 'navigate', 'ចូល', 'បើក'],
  save:     ['រក្សាទុក', 'save', 'submit', 'confirm'],
  change:   ['ប្ដូរ', 'change', 'update', 'edit'],
};

const ELEMENT_HINTS = {
  password:    ['password', 'លេខសម្ងាត់', 'ពាក្យសម្ងាត់'],
  name:        ['ឈ្មោះ', 'name', 'username'],
  email:       ['email', 'អ៊ីម៉ែល'],
  save_button: ['រក្សាទុក', 'save', 'submit'],
  settings:    ['settings', 'ការកំណត់'],
  profile:     ['profile', 'គណនី'],
  upload:      ['upload', 'បង្ហោះ', 'ឯកសារ', 'file'],
  avatar:      ['រូបភាព', 'avatar', 'photo', 'រូប'],
  change_pwd:  ['ប្ដូរ password', 'change password'],
  current_pwd: ['password បច្ចុប្បន្ន', 'current password', 'old password'],
  new_pwd:     ['password ថ្មី', 'new password', 'បញ្ចូល password ថ្មី'],
  confirm_pwd: ['confirm password', 'បញ្ជាក់', 'ម្ដងទៀត'],
  choose_file: ['ជ្រើសរើសឯកសារ', 'choose file', 'select file'],
};

/**
 * Parse noise-filtered guidance texts into actionable instructions.
 * guidanceTexts = step card content (from shadow DOM)
 * chatTexts     = AI reply sentences
 */
export function parseGuidance(guidanceTexts = [], chatTexts = []) {
  // Use all available texts; chatTexts weighted 2x (AI's direct answer)
  const combined = [...guidanceTexts, ...chatTexts, ...chatTexts].join(' ').toLowerCase();

  if (!combined || combined.length < 5) {
    return [{ action: null, target: null, confidence: 'none', raw: '' }];
  }

  const instructions = [];

  for (const [actionType, keywords] of Object.entries(ACTION_KEYWORDS)) {
    if (!keywords.some(kw => combined.includes(kw))) continue;

    for (const [elementType, hints] of Object.entries(ELEMENT_HINTS)) {
      // Count how many hints for this element appear in the combined text
      const hits = hints.filter(h => combined.includes(h.toLowerCase())).length;
      if (hits === 0) continue;

      // Also check if any hints appear specifically in the AI chat reply
      const chatCombined = chatTexts.join(' ').toLowerCase();
      const chatHits = hints.filter(h => chatCombined.includes(h.toLowerCase())).length;

      const confidence = chatHits >= 2 ? 'high' : chatHits === 1 ? 'medium' : hits >= 2 ? 'low' : 'low';

      instructions.push({ action: actionType, target: elementType, confidence, chatHits, hits });
    }
  }

  // Keep only the highest-confidence result per target
  const best = {};
  const order = { high: 3, medium: 2, low: 1, none: 0 };
  for (const inst of instructions) {
    if (!best[inst.target] || order[inst.confidence] > order[best[inst.target].confidence]) {
      best[inst.target] = inst;
    }
  }

  const deduped = Object.values(best);
  if (!deduped.length) {
    return combined.length > 10
      ? [{ action: 'unknown', target: 'unknown', confidence: 'low' }]
      : [{ action: null, target: null, confidence: 'none' }];
  }
  return deduped;
}

/**
 * Decide whether the simulator can act, and how confidently.
 *
 * low confidence  → 55% chance the simulator gets confused (realistic failure)
 * medium/high     → simulator attempts the action
 */
export function interpretGuidance(instructions) {
  if (!instructions?.length || instructions[0].confidence === 'none') {
    return { canAct: false, primaryInstruction: null,
      simulatorConfusion: 'No guidance received — simulator cannot proceed' };
  }

  const order = { high: 3, medium: 2, low: 1, none: 0 };
  const best = [...instructions].sort((a, b) => (order[b.confidence] || 0) - (order[a.confidence] || 0))[0];

  if (best.confidence === 'low') {
    const roll = Math.random();
    if (roll < 0.55) {
      return { canAct: false, primaryInstruction: best,
        simulatorConfusion: `Guidance vague (low confidence) — simulator confused (roll ${Math.round(roll * 100)}%)` };
    }
  }

  return { canAct: true, primaryInstruction: best, simulatorConfusion: null };
}

/**
 * Map an instruction target to visible page interaction hints.
 * Hints are what a user would visually see — NOT selectors.
 */
export function mapInstructionToPageAction(instruction) {
  const map = {
    password:    { type: 'fill',     hints: ['Password', 'password'] },
    name:        { type: 'fill',     hints: ['ឈ្មោះ', 'Name', 'name'] },
    email:       { type: 'fill',     hints: ['Email', 'email', 'អ៊ីម៉ែល'] },
    save_button: { type: 'click',    hints: ['រក្សាទុក', 'Save', 'Submit'] },
    settings:    { type: 'navigate', hints: ['ការកំណត់', 'Settings'] },
    profile:     { type: 'navigate', hints: ['Profile', 'គណនី'] },
    upload:      { type: 'click',    hints: ['Upload', 'បង្ហោះ'] },
    avatar:      { type: 'click',    hints: ['ប្ដូររូបភាព', 'Change photo', 'រូបភាព'] },
    change_pwd:  { type: 'click',    hints: ['ប្ដូរ Password', 'Change Password'] },
    current_pwd: { type: 'fill',     hints: ['Password បច្ចុប្បន្ន', 'Current password'] },
    new_pwd:     { type: 'fill',     hints: ['Password ថ្មី', 'New password', 'បញ្ចូល Password ថ្មី'] },
    confirm_pwd: { type: 'fill',     hints: ['Password ថ្មីម្ដងទៀត', 'Confirm password'] },
    choose_file: { type: 'click',    hints: ['ជ្រើសរើសឯកសារ', 'Choose file', 'Select file'] },
    unknown:     { type: 'unknown',  hints: [] },
  };
  return instruction?.target ? (map[instruction.target] || null) : null;
}
