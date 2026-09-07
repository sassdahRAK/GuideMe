import { test, describe } from 'node:test';
import assert from 'node:assert';
import { classifyPrompt } from '../packages/engine/src/intent/prompt-classifier.js';

describe('Prompt Classifier Unit Tests', () => {
  // ── Greetings ────────────────────────────────────────────────────────────────

  describe('greeting detection', () => {
    const greetings = [
      'hi', 'Hi!', 'hello', 'Hello!', 'hey', 'Hey!',
      'yo', 'hiya', 'howdy', 'sup',
      'good morning', 'Good afternoon!', 'good evening',
      'hi there', 'hello there', 'hey buddy',
      'greetings', 'Greetings!',
      // Khmer greetings
      'សួស្ដី', 'ជំរាបសួរ', 'ហេឡូ', 'ហាយ',
      'សួស្ដី!',
    ];

    for (const greeting of greetings) {
      test(`classifies "${greeting}" as greeting`, () => {
        const result = classifyPrompt(greeting);
        assert.strictEqual(result.type, 'greeting', `Expected greeting for "${greeting}", got ${result.type}`);
        assert.ok(result.responses.km, 'Should have Khmer response');
        assert.ok(result.responses.en, 'Should have English response');
      });
    }
  });

  // ── Unclear / Vague ──────────────────────────────────────────────────────────

  describe('unclear prompt detection', () => {
    const unclearInputs = [
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
        assert.strictEqual(result.type, 'unclear', `Expected unclear for "${input}", got ${result.type}`);
        assert.ok(result.responses.km, 'Should have Khmer clarification prompt');
        assert.ok(result.responses.en, 'Should have English clarification prompt');
      });
    }

    test('classifies empty string as unclear', () => {
      assert.strictEqual(classifyPrompt('').type, 'unclear');
      assert.strictEqual(classifyPrompt('  ').type, 'unclear');
    });

    test('classifies very short non-action text as unclear', () => {
      assert.strictEqual(classifyPrompt('ab').type, 'unclear');
      assert.strictEqual(classifyPrompt('go').type, 'unclear');
    });
  });

  // ── Actionable ───────────────────────────────────────────────────────────────

  describe('actionable prompt detection', () => {
    const actionableInputs = [
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
      // Khmer actionable
      'ចុចប៊ូតុង Login',
      'បើកទំព័រ Settings',
      'ស្វែងរកផលិតផល',
      'វាយ email',
    ];

    for (const input of actionableInputs) {
      test(`classifies "${input}" as actionable`, () => {
        const result = classifyPrompt(input);
        assert.strictEqual(result.type, 'actionable', `Expected actionable for "${input}", got ${result.type}`);
      });
    }

    test('classifies quoted entities as actionable', () => {
      assert.strictEqual(classifyPrompt('"mytube" repo').type, 'actionable');
      assert.strictEqual(classifyPrompt("find 'settings'").type, 'actionable');
    });

    test('classifies capitalized single words (UI labels) as actionable', () => {
      assert.strictEqual(classifyPrompt('Settings').type, 'actionable');
      assert.strictEqual(classifyPrompt('Profile').type, 'actionable');
    });
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    test('greeting + action verb is actionable, not greeting', () => {
      const result = classifyPrompt('hello world click button');
      assert.strictEqual(result.type, 'actionable');
    });

    test('"show me" alone is unclear (no specific target)', () => {
      assert.strictEqual(classifyPrompt('show me').type, 'unclear');
    });

    test('"show me how to login" is actionable', () => {
      const result = classifyPrompt('show me how to login');
      assert.strictEqual(result.type, 'actionable');
    });

    test('response objects always have km and en keys', () => {
      const inputs = ['hi', 'help', 'click button'];
      for (const input of inputs) {
        const result = classifyPrompt(input);
        assert.ok('km' in result.responses, `Missing km response for "${input}"`);
        assert.ok('en' in result.responses, `Missing en response for "${input}"`);
      }
    });
  });
});
