import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DynamicPageAnalyzer, TutorialParser, GeminiDomAnalyzer, NvidiaDomAnalyzer } from '../packages/engine/src/index.js';

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

  test('NvidiaDomAnalyzer extracts structured interactive elements', () => {
    const mockDoc = createMockDoc({
      title: 'Kimi NIM Testbed',
      buttons: [
        { textContent: 'Submit Application', id: 'submit-app-btn' },
      ],
      inputs: [
        { type: 'text', name: 'fullname', placeholder: 'Enter your name', id: 'fullname-input' },
      ],
    });

    const domList = NvidiaDomAnalyzer.extractInteractiveDom(mockDoc);
    assert.ok(Array.isArray(domList));
    assert.ok(domList.length >= 2);
    assert.ok(domList.some((el) => el.id === 'submit-app-btn' && el.tag === 'button'));
    assert.ok(domList.some((el) => el.id === 'fullname-input' && el.tag === 'input'));
  });

  test('NvidiaDomAnalyzer synthesizes valid tutorial schema with mock fetch and strips reasoning tokens', async () => {
    const mockDoc = createMockDoc({
      title: 'Store Front',
      buttons: [
        { textContent: 'Add to Bag', id: 'add-bag' },
      ],
    });

    // Mock response containing <think> tokens and Markdown code fences from Kimi-K3
    const mockTutorialJson = JSON.stringify({
      id: 'nvidia-test-guide',
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
    });

    const mockResponse = {
      choices: [
        {
          message: {
            content: `<think>The user wants to add an item to bag. There is a button with id add-bag.</think>\n\`\`\`json\n${mockTutorialJson}\n\`\`\``,
          },
        },
      ],
    };

    let calledEndpoint = '';
    let calledHeaders = {};
    const mockFetch = async (endpoint, options) => {
      calledEndpoint = endpoint;
      calledHeaders = options.headers;
      return {
        ok: true,
        status: 200,
        json: async () => mockResponse,
      };
    };

    const tutorial = await NvidiaDomAnalyzer.analyzeWithNvidia({
      prompt: 'Help me add this item to bag',
      doc: mockDoc,
      apiKey: 'nvapi-test-key',
      fetchFn: mockFetch,
    });

    assert.strictEqual(calledEndpoint, 'https://integrate.api.nvidia.com/v1/chat/completions');
    assert.strictEqual(calledHeaders['Authorization'], 'Bearer nvapi-test-key');
    assert.strictEqual(tutorial.id, 'nvidia-test-guide');
    assert.strictEqual(tutorial.steps.length, 1);
    assert.strictEqual(tutorial.steps[0].target.css, '#add-bag');
  });

  test('NvidiaDomAnalyzer routes via backendUrl proxy when provided', async () => {
    const mockDoc = createMockDoc({
      title: 'Store Front',
      buttons: [
        { textContent: 'Add to Bag', id: 'add-bag' },
      ],
    });

    const mockProxyTutorial = {
      id: 'proxy-guide-123',
      name: { km: 'ការណែនាំតាម Server', en: 'Server Proxy Guide' },
      description: { km: 'វិភាគលើ Backend', en: 'Analyzed on Backend' },
      steps: [
        {
          id: 'step_proxy_1',
          title: { km: 'ជំហានទី ១', en: 'Step 1' },
          description: { km: 'ការពិពណ៌នា', en: 'Description' },
          target: { css: '#add-bag' },
          action: {
            type: 'spotlight',
            title: { km: 'ចំណងជើង', en: 'Title' },
            content: { km: 'ខ្លឹមសារ', en: 'Content' },
            placement: 'bottom',
          },
          validation: { type: 'click' },
        },
      ],
    };

    let requestedUrl = '';
    const mockFetch = async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => mockProxyTutorial,
      };
    };

    const tutorial = await NvidiaDomAnalyzer.analyzeWithNvidia({
      prompt: 'Help me add to bag',
      doc: mockDoc,
      backendUrl: 'http://localhost:4000',
      fetchFn: mockFetch,
    });

    assert.strictEqual(requestedUrl, 'http://localhost:4000/api/ai/dom-guide');
    assert.strictEqual(tutorial.id, 'proxy-guide-123');
    assert.strictEqual(tutorial.steps.length, 1);
  });

  test('DynamicPageAnalyzer.generateDynamicTutorialAsync uses NVIDIA NIM options seamlessly', async () => {
    const mockDoc = createMockDoc({
      title: 'Store Front',
      buttons: [
        { textContent: 'Add to Bag', id: 'add-bag' },
      ],
    });

    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              id: 'nvidia-async-guide',
              name: { km: 'ការណែនាំ', en: 'Guide' },
              description: { km: 'ការណែនាំ', en: 'Guide' },
              steps: [
                {
                  id: 'step_1',
                  title: { km: 'ចុច', en: 'Click' },
                  description: { km: 'ចុច', en: 'Click' },
                  target: { css: '#add-bag' },
                  action: {
                    type: 'spotlight',
                    title: { km: 'កន្ត្រក', en: 'Bag' },
                    content: { km: 'ចុច', en: 'Click' },
                    placement: 'bottom',
                  },
                  validation: { type: 'click' },
                },
              ],
            }),
          },
        },
      ],
    };

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const tutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
      mockDoc,
      'https://store.example.com',
      'Help me click add to bag',
      {
        provider: 'nvidia',
        nvidiaApiKey: 'nvapi-test-key',
        fetchFn: mockFetch,
      }
    );

    assert.strictEqual(tutorial.id, 'nvidia-async-guide');
    assert.strictEqual(tutorial.steps[0].target.css, '#add-bag');
  });

  test('Disambiguation: Prioritizes button inside active dialog over identical background button', () => {
    const modalContainer = {
      tagName: 'DIALOG',
      open: true,
      getAttribute: (attr) => (attr === 'open' ? '' : null),
      querySelectorAll: () => [],
    };

    const modalButton = {
      tagName: 'BUTTON',
      id: 'modal-save-btn',
      textContent: 'Save Changes',
      parentElement: modalContainer,
      getAttribute: () => null,
      closest: (selector) => {
        if (selector.includes('dialog') || selector.includes('modal')) return modalContainer;
        return null;
      },
    };

    const backgroundContainer = {
      tagName: 'DIV',
      className: 'bg-page-container',
      getAttribute: () => null,
      querySelectorAll: () => [],
    };

    const backgroundButton = {
      tagName: 'BUTTON',
      id: 'bg-save-btn',
      textContent: 'Save Changes',
      parentElement: backgroundContainer,
      getAttribute: () => null,
      closest: () => null,
    };

    const mockDoc = {
      title: 'Modal Test Page',
      querySelectorAll: (selector) => {
        if (selector.includes('dialog[open]') || selector.includes('dialog')) return [modalContainer];
        if (selector.includes('button')) return [backgroundButton, modalButton];
        if (selector.startsWith('#')) {
          const id = selector.slice(1);
          if (id === 'modal-save-btn') return [modalButton];
          if (id === 'bg-save-btn') return [backgroundButton];
        }
        return [];
      },
      querySelector: (selector) => {
        if (selector.includes('dialog[open]') || selector.includes('dialog')) return modalContainer;
        return null;
      },
    };

    modalButton.ownerDocument = mockDoc;
    backgroundButton.ownerDocument = mockDoc;

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/app', 'click save changes');
    assert.ok(tutorial.steps.length > 0);
    assert.strictEqual(tutorial.steps[0].target.css, '#modal-save-btn');
    assert.strictEqual(tutorial.steps[0].target.container, 'dialog[open], [role="dialog"], .modal');
  });

  test('Layout Primacy: Prioritizes button in <main> over identical button in <footer>', () => {
    const mainContainer = {
      tagName: 'MAIN',
      id: 'main-content',
      getAttribute: () => null,
    };
    const footerContainer = {
      tagName: 'FOOTER',
      getAttribute: () => null,
    };

    const mainActionBtn = {
      tagName: 'BUTTON',
      id: 'main-action',
      textContent: 'Get Started',
      parentElement: mainContainer,
      getAttribute: () => null,
      closest: (sel) => (sel.includes('main') ? mainContainer : null),
    };

    const footerActionBtn = {
      tagName: 'BUTTON',
      id: 'footer-action',
      textContent: 'Get Started',
      parentElement: footerContainer,
      getAttribute: () => null,
      closest: (sel) => (sel.includes('footer') ? footerContainer : null),
    };

    const mockDoc = {
      title: 'Layout Page',
      querySelectorAll: (selector) => {
        if (selector.includes('dialog')) return [];
        if (selector.includes('button')) return [footerActionBtn, mainActionBtn];
        if (selector === '#main-action') return [mainActionBtn];
        if (selector === '#footer-action') return [footerActionBtn];
        return [];
      },
      querySelector: () => null,
    };

    mainActionBtn.ownerDocument = mockDoc;
    footerActionBtn.ownerDocument = mockDoc;

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com', 'get started');
    assert.ok(tutorial.steps.length > 0);
    assert.strictEqual(tutorial.steps[0].target.css, '#main-action');
  });

  test('Spatial Proximity: Prioritizes button physically close to previousElement', () => {
    const sharedForm = {
      tagName: 'FORM',
      getAttribute: () => null,
    };

    const prevInput = {
      tagName: 'INPUT',
      id: 'order-notes',
      parentElement: sharedForm,
      closest: (sel) => (sel.includes('form') ? sharedForm : null),
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 40 }),
      getAttribute: () => null,
    };

    const closeBtn = {
      tagName: 'BUTTON',
      id: 'close-submit-btn',
      textContent: 'Confirm',
      parentElement: sharedForm,
      closest: (sel) => (sel.includes('form') ? sharedForm : null),
      getBoundingClientRect: () => ({ left: 100, top: 160, width: 100, height: 40 }),
      getAttribute: () => null,
    };

    const distantBtn = {
      tagName: 'BUTTON',
      id: 'distant-submit-btn',
      textContent: 'Confirm',
      parentElement: { tagName: 'DIV' },
      closest: () => null,
      getBoundingClientRect: () => ({ left: 1800, top: 2200, width: 100, height: 40 }),
      getAttribute: () => null,
    };

    const mockDoc = {
      title: 'Order Page',
      querySelectorAll: (selector) => {
        if (selector.includes('dialog')) return [];
        if (selector.includes('button')) return [distantBtn, closeBtn];
        return [];
      },
      querySelector: () => null,
    };

    closeBtn.ownerDocument = mockDoc;
    distantBtn.ownerDocument = mockDoc;

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(
      mockDoc,
      'https://example.com/order',
      'confirm',
      { previousElement: prevInput }
    );

    assert.ok(tutorial.steps.length > 0);
    assert.strictEqual(tutorial.steps[0].target.css, '#close-submit-btn');
  });

  test('Hover Resolution: Dispatches synthetic hover on menu trigger and sets target.hoverTrigger', () => {
    const dispatchedEvents = [];

    const triggerBtn = {
      tagName: 'BUTTON',
      id: 'user-profile-toggle',
      textContent: 'Account',
      getAttribute: (attr) => (attr === 'aria-haspopup' ? 'true' : null),
      dispatchEvent: (evt) => {
        dispatchedEvents.push(evt.type);
      },
      matches: (sel) => sel.includes('button') || sel.includes('aria-haspopup'),
    };

    const dropdownList = {
      tagName: 'UL',
      className: 'dropdown-menu',
      parentElement: {
        tagName: 'DIV',
        className: 'user-dropdown-container',
        children: [triggerBtn],
        querySelector: () => triggerBtn,
      },
      previousElementSibling: triggerBtn,
      getAttribute: (attr) => (attr === 'role' ? 'menu' : null),
    };

    const flyoutItem = {
      tagName: 'A',
      id: 'settings-menu-item',
      textContent: 'Settings and Preferences',
      parentElement: dropdownList,
      getAttribute: (attr) => (attr === 'role' ? 'menuitem' : null),
      closest: () => null,
    };

    const mockDoc = {
      title: 'App with Flyout Menu',
      querySelectorAll: (selector) => {
        if (selector.includes('role="menuitem"') || selector.includes('.dropdown-item') || selector.includes('.dropdown-menu a')) {
          return [flyoutItem];
        }
        if (selector.includes('button') || selector.includes('a[href]')) {
          return [triggerBtn, flyoutItem];
        }
        return [];
      },
      querySelector: () => null,
    };

    flyoutItem.ownerDocument = mockDoc;
    triggerBtn.ownerDocument = mockDoc;

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(
      mockDoc,
      'https://example.com/dashboard',
      'settings'
    );

    assert.ok(tutorial.steps.length > 0);
    assert.ok(dispatchedEvents.includes('mouseover') || dispatchedEvents.includes('mouseenter'));
    const step = tutorial.steps[0];
    assert.strictEqual(step.target.css, '#settings-menu-item');
    assert.ok(step.target.hoverTrigger);
    assert.strictEqual(step.target.hoverTrigger.css, '#user-profile-toggle');
  });
});

