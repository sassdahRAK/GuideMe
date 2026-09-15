import { DynamicPageAnalyzer, TutorialParser, GeminiDomAnalyzer, IntentRegistry, LlmReranker } from '../packages/engine/src/index.ts';

// ---------------------------------------------------------------------------
// Mock DOM factory
// ---------------------------------------------------------------------------
interface MockDocOptions {
  title?: string;
  forms?: Record<string, unknown>[];
  inputs?: Record<string, unknown>[];
  buttons?: Record<string, unknown>[];
  navs?: Record<string, unknown>[];
}

function createMockDoc({
  title = 'Test Page',
  forms = [],
  inputs = [],
  buttons = [],
  navs = [],
}: MockDocOptions) {
  const enhancedForms = forms.map((f) => ({
    ...f, tagName: 'FORM',
    getAttribute: (attr: string) => (f as Record<string, unknown>)[attr] || null,
    querySelectorAll: () => [],
  }));
  const enhancedInputs = inputs.map((i) => ({
    ...i, tagName: 'INPUT',
    getAttribute: (attr: string) => (i as Record<string, unknown>)[attr] || null,
  }));
  const enhancedButtons = buttons.map((b) => ({
    ...b, tagName: 'BUTTON',
    getAttribute: (attr: string) => (b as Record<string, unknown>)[attr] || null,
  }));
  const enhancedNavs = navs.map((n) => ({
    ...n, tagName: 'NAV',
    getAttribute: (attr: string) => (n as Record<string, unknown>)[attr] || null,
  }));

  const allElements = [...enhancedForms, ...enhancedButtons, ...enhancedNavs, ...enhancedInputs];

  return {
    title,
    querySelectorAll: (selector: string) => {
      if (!selector) return [];
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return allElements.filter((el) => el.id === id);
      }
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        return allElements.filter((el) => (el as Record<string, unknown>).className && String((el as Record<string, unknown>).className).includes(cls));
      }
      if (selector.includes('data-testid')) {
        const match = selector.match(/data-testid=["']?([^"']+)["']?/);
        return match ? allElements.filter((el) => el.getAttribute('data-testid') === match![1]) : [];
      }
      if (selector.startsWith('form')) return enhancedForms;
      if (selector.startsWith('button')) return enhancedButtons;
      if (selector.startsWith('nav')) return enhancedNavs;
      if (selector.startsWith('input')) return enhancedInputs;
      return allElements.filter((el) => el.tagName.toLowerCase() === selector.toLowerCase());
    },
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('DynamicPageAnalyzer Unit Tests', () => {
  test('Classifies and generates Login Form walkthrough', () => {
    const mockDoc = createMockDoc({
      title: 'Sign In to GuideMe',
      inputs: [
        { type: 'text', name: 'username', placeholder: 'Enter email or username', id: 'user-field' },
        { type: 'password', name: 'password', placeholder: 'Password', id: 'pass-field' },
      ],
      buttons: [{ textContent: 'Sign In', id: 'login-btn', role: 'button' }],
    });

    const analysis = DynamicPageAnalyzer.analyzePage(mockDoc, 'https://example.com/login');
    expect(analysis.pageType).toBe('loginForm');

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/login');
    expect(tutorial.steps.length).toBe(3);
    expect(tutorial.steps[0].id).toBe('dynamic_step_username');
    expect(tutorial.steps[1].id).toBe('dynamic_step_password');
    expect(tutorial.steps[2].id).toBe('dynamic_step_submit');

    const parseResult = TutorialParser.parse(tutorial);
    expect(parseResult.success).toBe(true);
  });

  test('Classifies and generates E-Commerce walkthrough', () => {
    const mockDoc = createMockDoc({
      title: 'Awesome Sneakers - Store',
      inputs: [{ type: 'search', name: 'q', placeholder: 'Search products...', id: 'search-input' }],
      buttons: [
        { textContent: 'Add to Cart', id: 'buy-button', role: 'button' },
        { textContent: 'View Cart', id: 'cart-button', role: 'button' },
      ],
    });

    const analysis = DynamicPageAnalyzer.analyzePage(mockDoc, 'https://store.example.com/product/123');
    expect(analysis.pageType).toBe('ecommerceProduct');

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://store.example.com/product/123');
    expect(tutorial.steps.length >= 2).toBeTruthy();
    expect(tutorial.steps[0].id).toBe('dynamic_step_search');
    expect(tutorial.steps[1].id).toBe('dynamic_step_add_cart');
  });

  test('Classifies and generates Search Page walkthrough', () => {
    const mockDoc = createMockDoc({
      title: 'Search Results',
      inputs: [{ type: 'search', name: 'search', placeholder: 'Search...', id: 'site-search' }],
      buttons: [{ textContent: 'Search', id: 'search-btn' }],
    });

    const analysis = DynamicPageAnalyzer.analyzePage(mockDoc, 'https://example.com/search');
    expect(analysis.pageType).toBe('searchPage');

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/search');
    expect(tutorial.steps[0].id).toBe('dynamic_step_search_query');
  });

  test('Classifies Settings / Configuration page', () => {
    const mockDoc = createMockDoc({
      title: 'Account Settings',
      inputs: [
        { type: 'text', name: 'displayName', placeholder: 'Display Name' },
        { type: 'text', name: 'bio', placeholder: 'Bio' },
        { type: 'text', name: 'website', placeholder: 'Website' },
      ],
      buttons: [{ textContent: 'Save Changes', id: 'save-btn' }],
    });

    const analysis = DynamicPageAnalyzer.analyzePage(mockDoc, 'https://example.com/settings');
    expect(analysis.pageType).toBe('settingsPage');

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/settings');
    expect(tutorial.steps.length >= 2).toBeTruthy();
  });

  test('Generates custom steps matching user input prompt keywords', () => {
    const mockDoc = createMockDoc({
      title: 'Custom Dashboard',
      inputs: [
        { type: 'text', name: 'search_query', placeholder: 'Search repository', id: 'repo-search' },
        { type: 'email', name: 'user_email', placeholder: 'Feedback Email', id: 'email-input' },
      ],
      buttons: [{ textContent: 'Share Project', id: 'share-btn' }],
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/dashboard', 'share project');
    expect(tutorial.name).toBe('Guide: share project');
    expect(tutorial.steps.some((s: { title: string }) => s.title.includes('Share'))).toBeTruthy();
  });

  test('Parses raw JSON prompt directly as tutorial schema', () => {
    const mockDoc = createMockDoc({});
    const jsonPrompt = JSON.stringify({
      id: 'custom-json-guide',
      name: 'Custom JSON Walkthrough',
      steps: [
        { id: 's1', title: 'Step 1', target: { css: '#btn' }, action: { type: 'spotlight' }, validation: { type: 'click' } },
      ],
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com', jsonPrompt);
    expect(tutorial.id).toBe('custom-json-guide');
    expect(tutorial.name).toBe('Custom JSON Walkthrough');
    expect(tutorial.steps.length).toBe(1);
  });

  test('Target DOM elements using explicit CSS selectors in user prompt', () => {
    const mockDoc = createMockDoc({
      title: 'Store Page',
      buttons: [{ textContent: 'Buy Now', id: 'buy-now-btn', className: 'btn-accent' }],
      inputs: [{ type: 'text', name: 'promo', placeholder: 'Promo code', id: 'promo-code-input' }],
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://store.com', 'click #buy-now-btn');
    expect(tutorial.steps.length).toBe(1);
    expect(tutorial.steps[0].target.css).toBe('#buy-now-btn');
    expect(tutorial.steps[0].validation.type).toBe('click');
  });

  test('Target multiple DOM elements in sequence via comma/arrow prompt', () => {
    const mockDoc = createMockDoc({
      title: 'Sign In Page',
      inputs: [
        { type: 'text', name: 'email', id: 'user-email', placeholder: 'Email' },
        { type: 'password', name: 'password', id: 'user-password', placeholder: 'Password' },
      ],
      buttons: [{ textContent: 'Sign In', id: 'submit-login' }],
    });

    const prompt = 'step 1: #user-email -> step 2: #user-password -> step 3: #submit-login';
    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com', prompt);
    expect(tutorial.steps.length).toBe(3);
    expect(tutorial.steps[0].target.css).toBe('#user-email');
    expect(tutorial.steps[0].validation.type).toBe('input');
    expect(tutorial.steps[1].target.css).toBe('#user-password');
    expect(tutorial.steps[1].validation.type).toBe('input');
    expect(tutorial.steps[2].target.css).toBe('#submit-login');
    expect(tutorial.steps[2].validation.type).toBe('click');
  });

  test('GeminiDomAnalyzer extracts structured interactive elements', () => {
    const mockDoc = createMockDoc({
      title: 'Interactive Testbed',
      buttons: [{ textContent: 'Checkout', id: 'checkout-btn' }],
      inputs: [{ type: 'search', name: 'query', placeholder: 'Search products', id: 'search-box' }],
    });

    const domList = GeminiDomAnalyzer.extractInteractiveDom(mockDoc);
    expect(Array.isArray(domList)).toBeTruthy();
    expect(domList.length >= 2).toBeTruthy();
    expect(domList.some((el: { id: string; tag: string }) => el.id === 'checkout-btn' && el.tag === 'button')).toBeTruthy();
    expect(domList.some((el: { id: string; tag: string }) => el.id === 'search-box' && el.tag === 'input')).toBeTruthy();
  });

  test('GeminiDomAnalyzer excludes hidden interactive elements from the current DOM scan', () => {
    const visibleButton = {
      tagName: 'BUTTON',
      textContent: 'File',
      getAttribute: () => null,
      getClientRects: () => [{}],
    };
    const hiddenMenuItem = {
      tagName: 'DIV',
      textContent: 'New',
      getAttribute: (name: string) => (name === 'aria-hidden' ? 'true' : null),
      getClientRects: () => [] as Record<string, unknown>[],
    };
    const mockDoc = { querySelectorAll: () => [visibleButton, hiddenMenuItem] };

    const domList = GeminiDomAnalyzer.extractInteractiveDom(mockDoc);
    expect(domList.some((el: { text: string }) => el.text === 'File')).toBeTruthy();
    expect(!domList.some((el: { text: string }) => el.text === 'New')).toBeTruthy();
  });

  test('GeminiDomAnalyzer synthesizes valid tutorial schema with mock fetch', async () => {
    const mockDoc = createMockDoc({
      title: 'Store Front',
      buttons: [{ textContent: 'Add to Bag', id: 'add-bag' }],
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

    expect(tutorial.id).toBe('gemini-test-guide');
    expect(tutorial.steps.length).toBe(1);
    expect(tutorial.steps[0].target.css).toBe('#add-bag');
  });

  test('DynamicPageAnalyzer.generateDynamicTutorialAsync falls back to local selector matching if API key missing', async () => {
    const mockDoc = createMockDoc({
      title: 'Demo',
      buttons: [{ textContent: 'Confirm Order', id: 'confirm-order-btn' }],
    });

    const tutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
      mockDoc,
      'https://example.com',
      'click #confirm-order-btn'
    );

    expect(tutorial).toBeTruthy();
    expect(tutorial.steps[0].target.css).toBe('#confirm-order-btn');
  });

  test('DynamicPageAnalyzer routes via backendUrl proxy when provided', async () => {
    const mockDoc = createMockDoc({
      title: 'Store Front',
      buttons: [{ textContent: 'Add to Bag', id: 'add-bag' }],
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
    const mockFetch = async (url: string) => {
      requestedUrl = url;
      return { ok: true, status: 200, json: async () => mockProxyTutorial };
    };

    const tutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
      mockDoc,
      'https://store.example.com',
      'Help me add to bag',
      { backendUrl: 'http://localhost:4000', fetchFn: mockFetch }
    );

    expect(requestedUrl).toBe('http://localhost:4000/api/ai/dom-guide');
    expect(tutorial.id).toBe('proxy-guide-123');
    expect(tutorial.steps.length).toBe(1);
  });

  test('Disambiguation: Prioritizes button inside active dialog over identical background button', () => {
    const modalContainer = {
      tagName: 'DIALOG',
      open: true,
      getAttribute: (attr: string) => (attr === 'open' ? '' : null),
      querySelectorAll: () => [],
    };

    const modalButton = {
      tagName: 'BUTTON',
      id: 'modal-save-btn',
      textContent: 'Save Changes',
      parentElement: modalContainer,
      getAttribute: () => null,
      closest: (selector: string) => {
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
      querySelectorAll: (selector: string) => {
        if (selector.includes('dialog[open]') || selector.includes('dialog')) return [modalContainer];
        if (selector.includes('button')) return [backgroundButton, modalButton];
        if (selector.startsWith('#')) {
          const id = selector.slice(1);
          if (id === 'modal-save-btn') return [modalButton];
          if (id === 'bg-save-btn') return [backgroundButton];
        }
        return [];
      },
      querySelector: (selector: string) => {
        if (selector.includes('dialog[open]') || selector.includes('dialog')) return modalContainer;
        return null;
      },
    };

    (modalButton as Record<string, unknown>).ownerDocument = mockDoc;
    (backgroundButton as Record<string, unknown>).ownerDocument = mockDoc;

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/app', 'click save changes');
    expect(tutorial.steps.length > 0).toBeTruthy();
    expect(tutorial.steps[0].target.css).toBe('#modal-save-btn');
    expect(tutorial.steps[0].target.container).toBe('dialog[open], [role="dialog"], .modal');
  });

  test('Layout Primacy: Prioritizes button in <main> over identical button in <footer>', () => {
    const mainContainer = { tagName: 'MAIN', id: 'main-content', getAttribute: () => null };
    const footerContainer = { tagName: 'FOOTER', getAttribute: () => null };

    const mainActionBtn = {
      tagName: 'BUTTON',
      id: 'main-action',
      textContent: 'Get Started',
      parentElement: mainContainer,
      getAttribute: () => null,
      closest: (sel: string) => (sel.includes('main') ? mainContainer : null),
    };

    const footerActionBtn = {
      tagName: 'BUTTON',
      id: 'footer-action',
      textContent: 'Get Started',
      parentElement: footerContainer,
      getAttribute: () => null,
      closest: (sel: string) => (sel.includes('footer') ? footerContainer : null),
    };

    const mockDoc = {
      title: 'Layout Page',
      querySelectorAll: (selector: string) => {
        if (selector.includes('dialog')) return [];
        if (selector.includes('button')) return [footerActionBtn, mainActionBtn];
        if (selector === '#main-action') return [mainActionBtn];
        if (selector === '#footer-action') return [footerActionBtn];
        return [];
      },
      querySelector: () => null,
    };

    (mainActionBtn as Record<string, unknown>).ownerDocument = mockDoc;
    (footerActionBtn as Record<string, unknown>).ownerDocument = mockDoc;

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com', 'get started');
    expect(tutorial.steps.length > 0).toBeTruthy();
    expect(tutorial.steps[0].target.css).toBe('#main-action');
  });

  test('Spatial Proximity: Prioritizes button physically close to previousElement', () => {
    const sharedForm = { tagName: 'FORM', getAttribute: () => null };

    const prevInput = {
      tagName: 'INPUT',
      id: 'order-notes',
      parentElement: sharedForm,
      closest: (sel: string) => (sel.includes('form') ? sharedForm : null),
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 40 }),
      getAttribute: () => null,
    };

    const closeBtn = {
      tagName: 'BUTTON',
      id: 'close-submit-btn',
      textContent: 'Confirm',
      parentElement: sharedForm,
      closest: (sel: string) => (sel.includes('form') ? sharedForm : null),
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
      querySelectorAll: (selector: string) => {
        if (selector.includes('dialog')) return [];
        if (selector.includes('button')) return [distantBtn, closeBtn];
        return [];
      },
      querySelector: () => null,
    };

    (closeBtn as Record<string, unknown>).ownerDocument = mockDoc;
    (distantBtn as Record<string, unknown>).ownerDocument = mockDoc;

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(
      mockDoc,
      'https://example.com/order',
      'confirm',
      { previousElement: prevInput }
    );

    expect(tutorial.steps.length > 0).toBeTruthy();
    expect(tutorial.steps[0].target.css).toBe('#close-submit-btn');
  });

  test('Hover Resolution: Dispatches synthetic hover on menu trigger and sets target.hoverTrigger', () => {
    const dispatchedEvents: string[] = [];

    // ownerDocument.defaultView must be null so dispatchHoverEvents uses view:null
    // in event options instead of jsdom's real window, which causes PointerEvent
    // constructor to throw silently before our spy can record events.
    const mockOwnerDoc = { defaultView: null, querySelectorAll: () => [], querySelector: () => null };

    const triggerBtn = {
      tagName: 'BUTTON',
      id: 'user-profile-toggle',
      textContent: 'Account',
      ownerDocument: mockOwnerDoc,
      getAttribute: (attr: string) => (attr === 'aria-haspopup' ? 'true' : null),
      dispatchEvent: (evt: Event) => { dispatchedEvents.push(evt.type); },
      matches: (sel: string) => sel.includes('button') || sel.includes('aria-haspopup'),
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
      getAttribute: (attr: string) => (attr === 'role' ? 'menu' : null),
    };

    const flyoutItem = {
      tagName: 'A',
      id: 'settings-menu-item',
      textContent: 'Settings and Preferences',
      parentElement: dropdownList,
      ownerDocument: mockOwnerDoc,
      getAttribute: (attr: string) => (attr === 'role' ? 'menuitem' : null),
      closest: () => null,
    };

    const mockDoc = {
      title: 'App with Flyout Menu',
      querySelectorAll: (selector: string) => {
        if (selector.includes('role="menuitem"') || selector.includes('.dropdown-item') || selector.includes('.dropdown-menu a')) {
          return [flyoutItem];
        }
        if (selector.includes('button') || selector.includes('a[href]')) {
          return [triggerBtn, flyoutItem];
        }
        return [];
      },
      querySelector: (selector: string) => {
        if (selector.includes('#user-profile-toggle')) return triggerBtn;
        return null;
      },
    };

    (flyoutItem as Record<string, unknown>).ownerDocument = mockOwnerDoc;
    (triggerBtn as Record<string, unknown>).ownerDocument = mockOwnerDoc;

    // Stub PointerEvent to a dummy class so jsdom doesn't throw a TypeError
    // ("member view is not of type Window") when dispatching on our plain object mock.
    vi.stubGlobal('PointerEvent', class {
      type: string;
      constructor(type: string) { this.type = type; }
    });

    try {
      const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/dashboard', 'settings');

      expect(tutorial.steps.length > 0).toBeTruthy();
      expect(dispatchedEvents.includes('mouseover') || dispatchedEvents.includes('mouseenter') || dispatchedEvents.includes('pointerover')).toBeTruthy();
      const step = tutorial.steps[0];
      expect(step.target.css).toBe('#settings-menu-item');
      expect(step.target.hoverTrigger).toBeTruthy();
      expect(step.target.hoverTrigger.css).toBe('#user-profile-toggle');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('DynamicPageAnalyzer.generateDynamicTutorialAsync uses intent-resolver path when reranker is configured', async () => {
    const mockDoc = createMockDoc({
      title: 'Sign In Page',
      inputs: [
        { type: 'text', name: 'email', id: 'user-email', placeholder: 'Email' },
        { type: 'password', name: 'password', id: 'user-password', placeholder: 'Password' },
      ],
      buttons: [{ textContent: 'Sign In', id: 'sign-in-btn' }],
    });

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ stepIds: ['cand-0', 'cand-1'] }) } }],
      }),
    });

    const reranker = IntentRegistry.create({
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
      endpoint: 'https://mock-openrouter.example.com/v1/chat/completions',
      fetchFn: mockFetch,
    });

    const tutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
      mockDoc,
      'https://example.com/login',
      'sign in to my account',
      { reranker }
    );

    expect(tutorial, 'Tutorial must be generated').toBeTruthy();
    expect(tutorial.id.startsWith('intent-guide-'), 'Tutorial id must start with intent-guide-').toBeTruthy();
    expect(Array.isArray(tutorial.steps), 'Steps must be an array').toBeTruthy();
    expect(tutorial.steps.length > 0, 'At least one step').toBeTruthy();
    expect(tutorial.steps[0].target?.css, 'Step must have target css').toBeTruthy();
    expect(tutorial.steps[0].validation?.type, 'Step must have validation type').toBeTruthy();
  });
});
