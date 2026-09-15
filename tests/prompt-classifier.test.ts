import { classifyPrompt } from '../packages/engine/src/intent/prompt-classifier.ts';

describe('Prompt Classifier Unit Tests', () => {
  // ── Greetings ────────────────────────────────────────────────────────────────

  describe('greeting detection', () => {
    const greetings: string[] = [
      'hi', 'Hi!', 'hello', 'Hello!', 'hey', 'Hey!',
      'yo', 'hiya', 'howdy', 'sup',
      'good morning', 'Good afternoon!', 'good evening',
      'hi there', 'hello there', 'hey buddy',
      'greetings', 'Greetings!',
      // Slang, vocatives, character repeats
      'hi bro', 'hi broo', 'hi broooo', 'hey bro', 'yo bro!',
      'hey man', 'hello dude', 'heyyy', 'helloooo', 'hiiiii',
      'good morning team', "what's up bro", 'sup mate',
      // Khmer greetings
      'សួស្ដី', 'ជំរាបសួរ', 'ហេឡូ', 'ហាយ',
      'សួស្ដី!', 'សួស្ដីបង', 'សួស្តី bro', 'ជំរាបសួរបងប្រុស',
      'heeloo brooo', 'heeloo bro', 'helo bro', 'heyyy bro',
    ];

    for (const greeting of greetings) {
      test(`classifies "${greeting}" as greeting`, () => {
        const result = classifyPrompt(greeting);
        expect(result.type, `Expected greeting for "${greeting}", got ${result.type}`).toBe('greeting');
        expect(result.responses.km, 'Should have Khmer response').toBeTruthy();
        expect(result.responses.en, 'Should have English response').toBeTruthy();
      });
    }
  });

  // ── Unclear / Vague ──────────────────────────────────────────────────────────

  describe('unclear prompt detection', () => {
    const unclearInputs: string[] = [
      'help', 'help me', 'do something', 'please',
      'ok', 'yes', 'no', 'hmm', 'huh',
      'what', 'why', 'how',
      'guide me', 'assist me', 'i need help',
      'thanks', 'thank you',
      // Khmer unclear
      'ជួយ', 'ជួយខ្ញុំ', 'សូម', 'អរគុណ',
      'អ្វី', 'ហេតុអ្វី',
    ];

    for (const input of unclearInputs) {
      test(`classifies "${input}" as unclear`, () => {
        const result = classifyPrompt(input);
        expect(result.type, `Expected unclear for "${input}", got ${result.type}`).toBe('unclear');
        expect(result.responses.km, 'Should have Khmer clarification prompt').toBeTruthy();
        expect(result.responses.en, 'Should have English clarification prompt').toBeTruthy();
      });
    }

    test('classifies empty string as unclear', () => {
      expect(classifyPrompt('').type).toBe('unclear');
      expect(classifyPrompt('  ').type).toBe('unclear');
    });

    test('classifies very short non-action text as unclear', () => {
      expect(classifyPrompt('ab').type).toBe('unclear');
      expect(classifyPrompt('go').type).toBe('unclear');
    });
  });

  // ── Actionable ───────────────────────────────────────────────────────────────

  describe('actionable prompt detection', () => {
    const actionableInputs: string[] = [
      'click the sign in button',
      'Click Login',
      'press the submit button',
      'open settings page',
      'go to the profile tab',
      'search for products',
      'type email in the search bar',
      'fill in the registration form',
      'submit the order',
      'save my settings',
      'navigate to dashboard',
      'add item to cart',
      'sign in to my account',
      'download the report',
      'share this page',
      'scroll down to footer',
      'ok help me share the doc to my friend so he can edit it too',
      'help me share the file',
      'how to export spreadsheet',
      // Khmer actionable
      'ចុចប៊ូតុង Login',
      'បើកទំព័រ Settings',
      'ស្វែងរកផលិតផល',
      'វាយ email',
      'ជួយខ្ញុំចែករំលែកឯកសារ',
    ];

    for (const input of actionableInputs) {
      test(`classifies "${input}" as actionable`, () => {
        const result = classifyPrompt(input);
        expect(result.type, `Expected actionable for "${input}", got ${result.type}`).toBe('actionable');
      });
    }

    test('classifies quoted entities as actionable', () => {
      expect(classifyPrompt('"mytube" repo').type).toBe('actionable');
      expect(classifyPrompt("find 'settings'").type).toBe('actionable');
    });

    test('classifies capitalized single words (UI labels) as actionable', () => {
      expect(classifyPrompt('Settings').type).toBe('actionable');
      expect(classifyPrompt('Profile').type).toBe('actionable');
    });
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    test('greeting + action verb is actionable, not greeting', () => {
      const result = classifyPrompt('hello world click button');
      expect(result.type).toBe('actionable');
    });

    test('greeting + help me share is actionable, not greeting', () => {
      const result = classifyPrompt('hi bro help me share doc');
      expect(result.type).toBe('actionable');
    });

    test('"show me" alone is unclear (no specific target)', () => {
      expect(classifyPrompt('show me').type).toBe('unclear');
    });

    test('"show me how to login" is actionable', () => {
      const result = classifyPrompt('show me how to login');
      expect(result.type).toBe('actionable');
    });

    test('response objects always have km and en keys', () => {
      const inputs = ['hi', 'help', 'click button', 'hi broooo'];
      for (const input of inputs) {
        const result = classifyPrompt(input);
        expect('km' in result.responses, `Missing km response for "${input}"`).toBeTruthy();
        expect('en' in result.responses, `Missing en response for "${input}"`).toBeTruthy();
      }
    });
  });
});
