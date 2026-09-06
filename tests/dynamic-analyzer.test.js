import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DynamicPageAnalyzer, TutorialParser } from '../packages/engine/src/index.js';

// Mock simple DOM document for unit testing
function createMockDoc({
  title = 'Test Page',
  forms = [],
  inputs = [],
  buttons = [],
  links = [],
  navs = [],
  canvases = [],
  svgs = [],
  iframes = [],
  shadowHosts = [],
}) {
  const enhancedForms = forms.map((f) => ({ ...f, tagName: 'FORM', getAttribute: (attr) => f[attr] || null, querySelectorAll: () => [] }));
  const enhancedInputs = inputs.map((i) => ({ ...i, tagName: 'INPUT', getAttribute: (attr) => i[attr] || null }));
  const enhancedButtons = buttons.map((b) => ({ ...b, tagName: 'BUTTON', getAttribute: (attr) => b[attr] || null }));
  const enhancedLinks = links.map((l) => ({ ...l, tagName: 'A', getAttribute: (attr) => l[attr] || null }));
  const enhancedNavs = navs.map((n) => ({ ...n, tagName: 'NAV', getAttribute: (attr) => n[attr] || null }));
  const enhancedCanvases = canvases.map((c) => ({ ...c, tagName: 'CANVAS', getAttribute: (attr) => c[attr] || null }));
  const enhancedSvgs = svgs.map((s) => ({ ...s, tagName: 'SVG', getAttribute: (attr) => s[attr] || null }));
  const enhancedIframes = iframes.map((ifr) => ({ ...ifr, tagName: 'IFRAME', getAttribute: (attr) => ifr[attr] || null }));
  const enhancedShadowHosts = shadowHosts.map((sh) => ({
    tagName: sh.tagName || 'CUSTOM-ELEMENT',
    getAttribute: (attr) => sh[attr] || null,
    shadowRoot: {
      querySelectorAll: (selector) => {
        if (selector.startsWith('button') && sh.buttons) return sh.buttons.map((b) => ({ ...b, tagName: 'BUTTON', getAttribute: (a) => b[a] || null }));
        if (selector.startsWith('input') && sh.inputs) return sh.inputs.map((i) => ({ ...i, tagName: 'INPUT', getAttribute: (a) => i[a] || null }));
        return [];
      },
    },
  }));

  return {
    title,
    querySelectorAll: (selector) => {
      if (selector === '*') return enhancedShadowHosts;
      if (selector.startsWith('form')) return enhancedForms;
      if (selector.startsWith('button')) return enhancedButtons;
      if (selector.startsWith('nav')) return enhancedNavs;
      if (selector.startsWith('input')) return enhancedInputs;
      if (selector.startsWith('a') || selector.includes('[role="tab"]')) return enhancedLinks;
      if (selector.startsWith('canvas')) return enhancedCanvases;
      if (selector.startsWith('svg')) return enhancedSvgs;
      if (selector.startsWith('iframe')) return enhancedIframes;
      return [];
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

  test('Accurately matches and ranks GitHub-style navigation tabs (e.g. Repositories over Overview)', () => {
    const mockDoc = createMockDoc({
      title: 'thangsaoly (Thang Saoly)',
      links: [
        { textContent: 'Overview', href: '/thangsaoly', role: 'tab', className: 'UnderlineNav-item' },
        { textContent: 'Repositories 31', href: '/thangsaoly?tab=repositories', role: 'tab', className: 'UnderlineNav-item', 'aria-label': 'Repositories' },
        { textContent: 'Projects', href: '/thangsaoly?tab=projects', role: 'tab', className: 'UnderlineNav-item' },
        { textContent: 'Stars 19', href: '/thangsaoly?tab=stars', role: 'tab', className: 'UnderlineNav-item' },
      ],
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://github.com/thangsaoly', 'View Repositories');
    assert.ok(tutorial.steps.length >= 1);
    
    // First step MUST target the Repositories tab, not Overview!
    const firstStep = tutorial.steps[0];
    assert.ok(firstStep.title.includes('Repositories'));
    assert.ok(firstStep.target.css.includes('tab=repositories') || firstStep.target.text.includes('Repositories'));
  });

  test('Accurately detects and targets Canvas elements', () => {
    const mockDoc = createMockDoc({
      title: 'Analytics Dashboard',
      canvases: [
        { id: 'revenue-chart', 'aria-label': 'Monthly Revenue Chart', role: 'img' },
      ],
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/analytics', 'examine revenue chart');
    assert.ok(tutorial.steps.length >= 1);
    assert.ok(tutorial.steps[0].title.includes('Revenue Chart'));
    assert.ok(tutorial.steps[0].target.css.includes('revenue-chart'));
  });

  test('Accurately detects and targets SVG elements with title/aria-label', () => {
    const mockDoc = createMockDoc({
      title: 'Settings Area',
      svgs: [
        { 'aria-label': 'Security settings icon', role: 'img', className: 'octicon-lock' },
      ],
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/settings', 'open security settings');
    assert.ok(tutorial.steps.length >= 1);
    assert.ok(tutorial.steps[0].title.includes('Security settings'));
    assert.strictEqual(tutorial.steps[0].validation.type, 'click');
  });

  test('Accurately detects and targets Iframe elements', () => {
    const mockDoc = createMockDoc({
      title: 'Checkout Flow',
      iframes: [
        { title: 'ABA PayWay Gateway', name: 'payment-frame', src: 'https://payway.aba.com.kh/checkout' },
      ],
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/checkout', 'complete aba payment frame');
    assert.ok(tutorial.steps.length >= 1);
    assert.ok(tutorial.steps[0].title.includes('ABA PayWay'));
    assert.ok(tutorial.steps[0].target.css.includes('iframe[title="ABA PayWay Gateway"]'));
  });

  test('Accurately detects elements inside open Shadow DOM roots (web components)', () => {
    const mockDoc = createMockDoc({
      title: 'Web Component App',
      shadowHosts: [
        {
          tagName: 'PROFILE-CARD',
          buttons: [
            { textContent: 'Edit Profile Avatar', id: 'shadow-edit-btn', role: 'button' },
          ],
        },
      ],
    });

    const tutorial = DynamicPageAnalyzer.generateDynamicTutorial(mockDoc, 'https://example.com/profile', 'edit profile avatar');
    assert.ok(tutorial.steps.length >= 1);
    assert.ok(tutorial.steps[0].title.toLowerCase().includes('edit profile'));
  });
});

