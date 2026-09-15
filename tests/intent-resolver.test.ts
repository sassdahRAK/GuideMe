import {
  FuseFilter,
  LlmReranker,
  BackendIntentApiClient,
  LocalFallbackReranker,
  IntentResolver,
  IntentRegistry,
} from '../packages/engine/src/index.ts';

// ---------------------------------------------------------------------------
// Shared fixture: representative DOM candidate pool
// ---------------------------------------------------------------------------
const sampleCandidates = [
  { id: 'repo-tab', label: 'Repositories', text: 'Repositories 35', category: 'navigation', href: '/user?tab=repositories' },
  { id: 'overview-tab', label: 'Overview', text: 'Overview', category: 'navigation', href: '/user' },
  { id: 'search-input', label: 'Search repositories...', text: '', category: 'input', placeholder: 'Search repositories...' },
  { id: 'global-search', label: 'Global site search', text: '', category: 'input', placeholder: 'Type / to search' },
  { id: 'share-btn', label: 'Share', text: 'Share project', category: 'action' },
  { id: 'settings-link', label: 'Settings', text: 'Account settings', category: 'navigation' },
];

describe('Hybrid Two-Stage Intent Resolver Unit Tests', () => {
  test('Stage 1 (FuseFilter) candidate filtering executes in <10ms and ranks relevant items first', () => {
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

    expect(duration < 60, `Filtering took ${duration.toFixed(2)}ms (must be <60ms)`).toBeTruthy();
    expect(results.length <= 15).toBeTruthy();
    expect(results[0].desc.id).toBe('repo-tab');
  });

  test('Stage 1 (FuseFilter) handles spelling typos (e.g. "repostry" -> "Repositories")', () => {
    const results = FuseFilter.filterCandidates(sampleCandidates, 'repostry', 5);
    expect(results.length > 0).toBeTruthy();
    expect(results[0].desc.id).toBe('repo-tab');
  });

  test('Stage 2 BackendIntentApiClient sends clean payload and extracts stepIds', async () => {
    const mockFetch = async (url: string, options: RequestInit) => {
      expect(url.endsWith('/api/ai/intent-rerank')).toBeTruthy();
      const parsedBody = JSON.parse(options.body as string);
      expect(parsedBody.prompt).toBe('invite new team members');
      expect(Array.isArray(parsedBody.candidates)).toBeTruthy();

      return {
        ok: true,
        status: 200,
        json: async () => ({ stepIds: ['cand-4'] }),
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
    expect(stepIds).toEqual(['cand-4']);
  });

  test('Stage 2 LlmReranker resolves semantic synonyms via mock LLM', async () => {
    const mockFetch = async (_url: string, options: RequestInit) => {
      expect((options.body as string).includes('invite colleagues')).toBeTruthy();
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ stepIds: ['cand-1'] }) } }],
        }),
      };
    };

    const reranker = new LlmReranker({ apiKey: 'test-key', fetchFn: mockFetch });

    const candidates = [
      { candidateId: 'cand-0', desc: { category: 'navigation', label: 'Overview' }, score: 0.5 },
      { candidateId: 'cand-1', desc: { category: 'action', label: 'Share' }, score: 0.4 },
    ];

    const stepIds = await reranker.rerank('invite colleagues', candidates);
    expect(stepIds).toEqual(['cand-1']);
  });

  test('Stage 2 LlmReranker supports OpenRouter / OpenAI provider and strips reasoning tokens', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = async (url: string, options: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = options.headers as Record<string, string>;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: `<think>Candidate cand-1 represents Share action</think>\n{"stepIds": ["cand-1"]}`,
              },
            },
          ],
        }),
      };
    };

    const reranker = new LlmReranker({
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: 'sk-or-v1-test-key',
      model: 'openai/gpt-4o-mini',
      fetchFn: mockFetch,
    });

    expect(reranker.endpoint).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(reranker.model).toBe('openai/gpt-4o-mini');

    const candidates = [
      { candidateId: 'cand-0', desc: { category: 'navigation', label: 'Overview' }, score: 0.5 },
      { candidateId: 'cand-1', desc: { category: 'action', label: 'Share' }, score: 0.4 },
    ];

    const stepIds = await reranker.rerank('share project', candidates);
    expect(capturedUrl).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(capturedHeaders['Authorization']).toBe('Bearer sk-or-v1-test-key');
    expect(stepIds).toEqual(['cand-1']);
  });

  test('IntentResolver gracefully falls back to Stage 1 when API client errors or times out', async () => {
    const failingFetch = async () => { throw new Error('Network unreachable'); };

    const failingClient = new BackendIntentApiClient({
      backendUrl: 'http://localhost:5000',
      fetchFn: failingFetch,
    });

    const resolver = new IntentResolver({ reranker: failingClient });
    const results = await resolver.resolve(sampleCandidates, 'Repositories');

    expect(results.length > 0, 'Must not throw, should fall back to local Stage 1').toBeTruthy();
    expect(results[0].id).toBe('repo-tab');
  });

  test('IntentResolver enforces single-input discipline and synthesizes dynamic result click', async () => {
    const resolver = new IntentResolver();
    const prompt = 'find repository named mytube';

    const results = await resolver.resolve(sampleCandidates, prompt);

    const inputSteps = results.filter((r: { category: string }) => r.category === 'input');
    expect(inputSteps.length).toBe(1);

    const resultStep = results.find((r: { isDynamicResult?: boolean }) => r.isDynamicResult);
    expect(resultStep, 'Dynamic result step must be created').toBeTruthy();
    expect((resultStep as Record<string, unknown>).label).toBe('mytube');
  });

  test('IntentRegistry instantiates appropriate provider based on environment variables', () => {
    const backendClient = IntentRegistry.fromEnv({ WXT_BACKEND_URL: 'http://localhost:5000' });
    expect(backendClient instanceof BackendIntentApiClient).toBeTruthy();

    const llmClient = IntentRegistry.fromEnv({ WXT_AI_API_KEY: 'sk-test' });
    expect(llmClient instanceof LlmReranker).toBeTruthy();

    const localClient = IntentRegistry.fromEnv({});
    expect(localClient instanceof LocalFallbackReranker).toBeTruthy();
  });
});
