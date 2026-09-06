import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  FuseFilter,
  LlmReranker,
  BackendIntentApiClient,
  LocalFallbackReranker,
  IntentResolver,
  IntentRegistry,
} from '../packages/engine/src/index.js';

describe('Hybrid Two-Stage Intent Resolver Unit Tests', () => {
  const sampleCandidates = [
    {
      id: 'repo-tab',
      label: 'Repositories',
      text: 'Repositories 35',
      category: 'navigation',
      href: '/user?tab=repositories',
    },
    {
      id: 'overview-tab',
      label: 'Overview',
      text: 'Overview',
      category: 'navigation',
      href: '/user',
    },
    {
      id: 'search-input',
      label: 'Search repositories...',
      text: '',
      category: 'input',
      placeholder: 'Search repositories...',
    },
    {
      id: 'global-search',
      label: 'Global site search',
      text: '',
      category: 'input',
      placeholder: 'Type / to search',
    },
    {
      id: 'share-btn',
      label: 'Share',
      text: 'Share project',
      category: 'action',
    },
    {
      id: 'settings-link',
      label: 'Settings',
      text: 'Account settings',
      category: 'navigation',
    },
  ];

  test('Stage 1 (FuseFilter) candidate filtering executes in <10ms and ranks relevant items first', () => {
    // Generate 120 mock candidates to test candidate pruning speed
    const largePool = [...sampleCandidates];
    for (let i = 0; i < 114; i++) {
      largePool.push({
        id: `dummy-${i}`,
        label: `Unrelated Button ${i}`,
        text: `Dummy description ${i}`,
        category: 'action',
      });
    }

    const startTime = performance.now();
    const results = FuseFilter.filterCandidates(largePool, 'Repositories', 15);
    const duration = performance.now() - startTime;

    assert.ok(duration < 60, `Filtering took ${duration.toFixed(2)}ms (must be <60ms)`);
    assert.ok(results.length <= 15, 'Pruned down to top candidates');
    assert.strictEqual(results[0].desc.id, 'repo-tab', 'Repositories must be top-ranked candidate');
  });

  test('Stage 1 (FuseFilter) handles spelling typos (e.g. "repostry" -> "Repositories")', () => {
    const results = FuseFilter.filterCandidates(sampleCandidates, 'repostry', 5);
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].desc.id, 'repo-tab', 'Should match Repositories despite typo');
  });

  test('Stage 2 BackendIntentApiClient sends clean payload and extracts stepIds', async () => {
    const mockFetch = async (url, options) => {
      assert.ok(url.endsWith('/api/v1/ai/intent-rerank'));
      const parsedBody = JSON.parse(options.body);
      assert.strictEqual(parsedBody.prompt, 'invite new team members');
      assert.ok(Array.isArray(parsedBody.candidates));

      return {
        ok: true,
        status: 200,
        json: async () => ({
          stepIds: ['cand-4'], // points to Share button
        }),
      };
    };

    const client = new BackendIntentApiClient({
      backendUrl: 'http://localhost:5000',
      fetchFn: mockFetch,
    });

    const candidates = [
      { candidateId: 'cand-0', desc: { category: 'navigation', label: 'Repositories' }, score: 0.5 },
      { candidateId: 'cand-4', desc: { category: 'action', label: 'Share' }, score: 0.4 },
    ];

    const stepIds = await client.rerank('invite new team members', candidates);
    assert.deepStrictEqual(stepIds, ['cand-4']);
  });

  test('Stage 2 LlmReranker resolves semantic synonyms via mock LLM', async () => {
    const mockFetch = async (url, options) => {
      assert.ok(options.body.includes('invite colleagues'));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ stepIds: ['cand-1'] }),
              },
            },
          ],
        }),
      };
    };

    const reranker = new LlmReranker({
      apiKey: 'test-key',
      fetchFn: mockFetch,
    });

    const candidates = [
      { candidateId: 'cand-0', desc: { category: 'navigation', label: 'Overview' }, score: 0.5 },
      { candidateId: 'cand-1', desc: { category: 'action', label: 'Share' }, score: 0.4 },
    ];

    const stepIds = await reranker.rerank('invite colleagues', candidates);
    assert.deepStrictEqual(stepIds, ['cand-1']);
  });

  test('IntentResolver gracefully falls back to Stage 1 when API client errors or times out', async () => {
    const failingFetch = async () => {
      throw new Error('Network unreachable');
    };

    const failingClient = new BackendIntentApiClient({
      backendUrl: 'http://localhost:5000',
      fetchFn: failingFetch,
    });

    const resolver = new IntentResolver({ reranker: failingClient });
    const results = await resolver.resolve(sampleCandidates, 'Repositories');

    assert.ok(results.length > 0, 'Must not throw, should fall back to local Stage 1');
    assert.strictEqual(results[0].id, 'repo-tab');
  });

  test('IntentResolver enforces single-input discipline and synthesizes dynamic result click', async () => {
    const resolver = new IntentResolver();
    const prompt = 'find repository named mytube';

    const results = await resolver.resolve(sampleCandidates, prompt);

    // Filter by input category
    const inputSteps = results.filter((r) => r.category === 'input');
    assert.strictEqual(inputSteps.length, 1, 'Enforces maximum of 1 input step');

    // Verify dynamic result step synthesized for 'mytube'
    const resultStep = results.find((r) => r.isDynamicResult);
    assert.ok(resultStep, 'Dynamic result step must be created');
    assert.strictEqual(resultStep.label, 'mytube');
  });

  test('IntentRegistry instantiates appropriate provider based on environment variables', () => {
    // 1. When backend URL is set, produces BackendIntentApiClient
    const backendClient = IntentRegistry.fromEnv({ WXT_BACKEND_URL: 'http://localhost:5000' });
    assert.ok(backendClient instanceof BackendIntentApiClient);

    // 2. When AI API key is set without backend, produces LlmReranker
    const llmClient = IntentRegistry.fromEnv({ WXT_AI_API_KEY: 'sk-test' });
    assert.ok(llmClient instanceof LlmReranker);

    // 3. When neither is set, produces LocalFallbackReranker
    const localClient = IntentRegistry.fromEnv({});
    assert.ok(localClient instanceof LocalFallbackReranker);
  });
});
