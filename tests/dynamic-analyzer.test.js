import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DynamicPageAnalyzer, TutorialParser, GeminiDomAnalyzer } from '../packages/engine/src/index.js';

// Mock simple DOM document for unit testing
function createMockDoc({
  title = 'Test Page',
  forms = [],
  inputs = [],
  buttons = [],
  navs = [],
}) {
  const enhancedForms = forms.map((f) => ({ ...f, tagName: 'FORM', getAttribute: (attr) => f[attr] || null, querySelectorAll: () => [] }));
  const enhancedInputs = inputs.map((i) => ({ ...i, tagName: 'INPUT', getAttribute: (attr) => i[attr] || null }));
  const enhancedButtons = buttons.map((b) => ({ ...b, tagName: 'BUTTON', getAttribute: (attr) => b[attr] || null }));
  const enhancedNavs = navs.map((n) => ({ ...n, tagName: 'NAV', getAttribute: (attr) => n[attr] || null }));

  const allElements = [...enhancedForms, ...enhancedButtons, ...enhancedNavs, ...enhancedInputs];

  return {
    title,
    querySelectorAll: (selector) => {
      if (!selector) return [];
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return allElements.filter((el) => el.id === id);
      }
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        return allElements.filter((el) => el.className && el.className.includes(cls));
      }
      if (selector.includes('data-testid')) {
        const match = selector.match(/data-testid=["']?([^"']+)["']?/);
        return match ? allElements.filter((el) => el.getAttribute('data-testid') === match[1]) : [];
      }
      if (selector.startsWith('form')) return enhancedForms;
      if (selector.startsWith('button')) return enhancedButtons;
      if (selector.startsWith('nav')) return enhancedNavs;
      if (selector.startsWith('input')) return enhancedInputs;
      return allElements.filter((el) => el.tagName.toLowerCase() === selector.toLowerCase());
    },
  };
}

describe('DynamicPageAnalyzer Unit Tests', () => {
  test('Classifies and generates Login Form walkthrough', () => {
    const mockDoc = createMockDoc({
      title: 'Sign In to GuideMe',
      inputs: [
        { type: 'text', name: 'username', placeholder: 'Enter email or username', id: 'user-field' },
        { type: 'password', name: 'password', placeholder: 'Password', id: 'pass-field' },
      ],
      buttons: [
        { textContent: 'Sign In', id: 'login-btn', role: 'button' },
      ],
    });

    const analysis = DynamicPageAnalyzer.analyzePage(mockDoc, 'https://example.com/login');
    assert.strictEqual(analysis.pageType, 'loginForm');

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/login');
    assert.strictEqual(tutorial.steps.length, 3);
    assert.strictEqual(tutorial.steps[0].id, 'dynamic_step_username');
    assert.strictEqual(tutorial.steps[1].id, 'dynamic_step_password');
    assert.strictEqual(tutorial.steps[2].id, 'dynamic_step_submit');

    const parseResult = TutorialParser.parse(tutorial);
    assert.strictEqual(parseResult.success, true);
  });

  test('Classifies and generates E-Commerce walkthrough', () => {
    const mockDoc = createMockDoc({
      title: 'Awesome Sneakers - Store',
      inputs: [
        { type: 'search', name: 'q', placeholder: 'Search products...', id: 'search-input' },
      ],
      buttons: [
        { textContent: 'Add to Cart', id: 'buy-button', role: 'button' },
        { textContent: 'View Cart', id: 'cart-button', role: 'button' },
      ],
    });

    const analysis = DynamicPageAnalyzer.analyzePage(mockDoc, 'https://store.example.com/product/123');
    assert.strictEqual(analysis.pageType, 'ecommerceProduct');

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://store.example.com/product/123');
    assert.ok(tutorial.steps.length >= 2);
    assert.strictEqual(tutorial.steps[0].id, 'dynamic_step_search');
    assert.strictEqual(tutorial.steps[1].id, 'dynamic_step_add_cart');
  });

  test('Classifies and generates Search Page walkthrough', () => {
    const mockDoc = createMockDoc({
      title: 'Search Results',
      inputs: [
        { type: 'search', name: 'search', placeholder: 'Search...', id: 'site-search' },
      ],
      buttons: [
        { textContent: 'Search', id: 'search-btn' },
      ],
    });

    const analysis = DynamicPageAnalyzer.analyzePage(mockDoc, 'https://example.com/search');
    assert.strictEqual(analysis.pageType, 'searchPage');

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/search');
    assert.strictEqual(tutorial.steps[0].id, 'dynamic_step_search_query');
  });

  test('Classifies Settings / Configuration page', () => {
    const mockDoc = createMockDoc({
      title: 'Account Settings',
      inputs: [
        { type: 'text', name: 'displayName', placeholder: 'Display Name' },
        { type: 'text', name: 'bio', placeholder: 'Bio' },
        { type: 'text', name: 'website', placeholder: 'Website' },
      ],
      buttons: [
        { textContent: 'Save Changes', id: 'save-btn' },
      ],
    });

    const analysis = DynamicPageAnalyzer.analyzePage(mockDoc, 'https://example.com/settings');
    assert.strictEqual(analysis.pageType, 'settingsPage');

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/settings');
    assert.ok(tutorial.steps.length >= 2);
  });

  test('Generates custom steps matching user input prompt keywords', () => {
    const mockDoc = createMockDoc({
      title: 'Custom Dashboard',
      inputs: [
        { type: 'text', name: 'search_query', placeholder: 'Search repository', id: 'repo-search' },
        { type: 'email', name: 'user_email', placeholder: 'Feedback Email', id: 'email-input' },
      ],
      buttons: [
        { textContent: 'Share Project', id: 'share-btn' },
      ],
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/dashboard', 'share project');
    assert.strictEqual(tutorial.name, 'Guide: share project');
    assert.ok(tutorial.steps.some(s => s.title.includes('Share')));
  });

  test('Parses raw JSON prompt directly as tutorial schema', () => {
    const mockDoc = createMockDoc({});
    const jsonPrompt = JSON.stringify({
      id: 'custom-json-guide',
      name: 'Custom JSON Walkthrough',
      steps: [
        { id: 's1', title: 'Step 1', target: { css: '#btn' }, action: { type: 'spotlight' }, validation: { type: 'click' } }
      ]
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com', jsonPrompt);
    assert.strictEqual(tutorial.id, 'custom-json-guide');
    assert.strictEqual(tutorial.name, 'Custom JSON Walkthrough');
    assert.strictEqual(tutorial.steps.length, 1);
  });

  test('Target DOM elements using explicit CSS selectors in user prompt', () => {
    const mockDoc = createMockDoc({
      title: 'Store Page',
      buttons: [
        { textContent: 'Buy Now', id: 'buy-now-btn', className: 'btn-accent' },
      ],
      inputs: [
        { type: 'text', name: 'promo', placeholder: 'Promo code', id: 'promo-code-input' },
      ],
    });

    // Prompt specifying explicit selector
    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://store.com', 'click #buy-now-btn');
    assert.strictEqual(tutorial.steps.length, 1);
    assert.strictEqual(tutorial.steps[0].target.css, '#buy-now-btn');
    assert.strictEqual(tutorial.steps[0].validation.type, 'click');
  });

  test('Target multiple DOM elements in sequence via comma/arrow prompt', () => {
    const mockDoc = createMockDoc({
      title: 'Sign In Page',
      inputs: [
        { type: 'text', name: 'email', id: 'user-email', placeholder: 'Email' },
        { type: 'password', name: 'password', id: 'user-password', placeholder: 'Password' },
      ],
      buttons: [
        { textContent: 'Sign In', id: 'submit-login' },
      ],
    });

    // Multi-step chained selectors prompt
    const prompt = 'step 1: #user-email -> step 2: #user-password -> step 3: #submit-login';
    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com', prompt);
    assert.strictEqual(tutorial.steps.length, 3);
    assert.strictEqual(tutorial.steps[0].target.css, '#user-email');
    assert.strictEqual(tutorial.steps[0].validation.type, 'input');
    assert.strictEqual(tutorial.steps[1].target.css, '#user-password');
    assert.strictEqual(tutorial.steps[1].validation.type, 'input');
    assert.strictEqual(tutorial.steps[2].target.css, '#submit-login');
    assert.strictEqual(tutorial.steps[2].validation.type, 'click');
  });

  test('GeminiDomAnalyzer extracts structured interactive elements', () => {
    const mockDoc = createMockDoc({
      title: 'Interactive Testbed',
      buttons: [
        { textContent: 'Checkout', id: 'checkout-btn' },
      ],
      inputs: [
        { type: 'search', name: 'query', placeholder: 'Search products', id: 'search-box' },
      ],
    });

    const domList = GeminiDomAnalyzer.extractInteractiveDom(mockDoc);
    assert.ok(Array.isArray(domList));
    assert.ok(domList.length >= 2);
    assert.ok(domList.some((el) => el.id === 'checkout-btn' && el.tag === 'button'));
    assert.ok(domList.some((el) => el.id === 'search-box' && el.tag === 'input'));
  });

  test('GeminiDomAnalyzer synthesizes valid tutorial schema with mock fetch', async () => {
    const mockDoc = createMockDoc({
      title: 'Store Front',
      buttons: [
        { textContent: 'Add to Bag', id: 'add-bag' },
      ],
    });

    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  id: 'gemini-test-guide',
                  name: { km: 'ការទិញទំនិញ', en: 'Shopping Guide' },
                  description: { km: 'ការណែនាំអំពីការទិញ', en: 'Shopping walkthrough' },
                  steps: [
                    {
                      id: 'step_add_bag',
                      title: { km: 'ចុចបន្ថែមក្នុងកន្ត្រក', en: 'Click Add to Bag' },
                      description: { km: 'ចុចប៊ូតុងនេះ', en: 'Click this button' },
                      target: { css: '#add-bag' },
                      action: {
                        type: 'spotlight',
                        title: { km: 'កន្ត្រក', en: 'Bag' },
                        content: { km: 'ចុចទីនេះ', en: 'Click here' },
                        placement: 'bottom',
                      },
                      validation: { type: 'click' },
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const tutorial = await GeminiDomAnalyzer.analyzeWithGemini({
      prompt: 'Help me add this item to bag',
      doc: mockDoc,
      apiKey: 'test-gemini-key',
      fetchFn: mockFetch,
    });

    assert.strictEqual(tutorial.id, 'gemini-test-guide');
    assert.strictEqual(tutorial.steps.length, 1);
    assert.strictEqual(tutorial.steps[0].target.css, '#add-bag');
  });

  test('DynamicPageAnalyzer.generateDynamicTutorialAsync falls back to local selector matching if API key missing', async () => {
    const mockDoc = createMockDoc({
      title: 'Demo',
      buttons: [
        { textContent: 'Confirm Order', id: 'confirm-order-btn' },
      ],
    });

    const tutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
      mockDoc,
      'https://example.com',
      'click #confirm-order-btn'
    );

    assert.ok(tutorial);
    assert.strictEqual(tutorial.steps[0].target.css, '#confirm-order-btn');
  });
});
