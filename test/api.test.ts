import { test, expect, describe, mock, beforeAll, afterAll } from 'bun:test';
import { MODELS, type Model, search } from '../src/api';

describe('MODELS', () => {
  test('includes all expected models', () => {
    expect(MODELS).toContain('sonar');
    expect(MODELS).toContain('sonar-pro');
    expect(MODELS).toContain('sonar-reasoning-pro');
    expect(MODELS).toContain('sonar-deep-research');
  });

  test('has exactly 4 models', () => {
    expect(MODELS).toHaveLength(4);
  });

  test('does not include deprecated sonar-reasoning', () => {
    expect(MODELS).not.toContain('sonar-reasoning');
  });

  test('Model type matches MODELS array', () => {
    const model: Model = MODELS[0]!;
    expect(MODELS.includes(model)).toBe(true);
  });
});

describe('search parser', () => {
  const originalFetch = global.fetch;
  const originalError = console.error;

  beforeAll(() => {
    process.env.PERPLEXITY_API_KEY = 'pplx-test-key';
  });

  afterAll(() => {
    global.fetch = originalFetch;
    console.error = originalError;
    delete process.env.PERPLEXITY_API_KEY;
  });

  const createMockStream = (chunks: string[]) => {
    return new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
  };

  test('search handles malformed JSON in stream gracefully', async () => {
    const streamChunks = [
      'data: {"choices": [{"delta": {"content": "Valid"}}]}\n',
      'data: { malformed }\n',
      'data: {"choices": [{"delta": {"content": " Part"}}]}\n',
    ];

    const onContent = mock(() => {});
    const onDone = mock(() => {});
    const onError = mock(() => {});
    console.error = mock(() => {});

    // @ts-expect-error - mock fetch for testing
    global.fetch = mock(async () => ({
      ok: true,
      body: createMockStream(streamChunks),
    }));

    await search('query', 'sonar', { onContent, onDone, onError });

    expect(onContent).toHaveBeenCalledWith('Valid');
    expect(onContent).toHaveBeenCalledWith(' Part');
    expect(onDone).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  test('search logs unexpected SSE lines', async () => {
    const streamChunks = [
      'data: {"choices": [{"delta": {"content": "text"}}]}\n',
      'unexpected line\n',
      'data: [DONE]\n',
    ];

    const onContent = mock(() => {});
    const onDone = mock(() => {});
    const onError = mock(() => {});
    console.error = mock(() => {});

    // @ts-expect-error - mock fetch for testing
    global.fetch = mock(async () => ({
      ok: true,
      body: createMockStream(streamChunks),
    }));

    await search('query', 'sonar', { onContent, onDone, onError });

    expect(onContent).toHaveBeenCalledWith('text');
    expect(onDone).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    const errorCalls = (console.error as any).mock.calls;
    expect(errorCalls.some((call: any) => call[0].includes('Unexpected SSE line'))).toBe(true);
  });

  test('search handles empty data: lines', async () => {
    const streamChunks = [
      'data: {"choices": [{"delta": {"content": "start"}}]}\n',
      'data: \n',
      'data: {"choices": [{"delta": {"content": "end"}}]}\n',
    ];

    const onContent = mock(() => {});
    const onDone = mock(() => {});
    const onError = mock(() => {});
    console.error = mock(() => {});

    // @ts-expect-error - mock fetch for testing
    global.fetch = mock(async () => ({
      ok: true,
      body: createMockStream(streamChunks),
    }));

    await search('query', 'sonar', { onContent, onDone, onError });

    expect(onContent).toHaveBeenCalledWith('start');
    expect(onContent).toHaveBeenCalledWith('end');
    expect(onDone).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  test('search extracts citations and usage from stream', async () => {
    const results = [{ title: 'Source', url: 'https://example.com' }];
    const usage = { prompt_tokens: 10, completion_tokens: 20 };
    
    const streamChunks = [
      `data: {"choices": [{"delta": {"content": "text"}}], "search_results": ${JSON.stringify(results)}, "usage": ${JSON.stringify(usage)}}\n`,
      'data: [DONE]\n',
    ];

    const onContent = mock(() => {});
    const onDone = mock(() => {});
    const onError = mock(() => {});

    // @ts-expect-error - mock fetch for testing
    global.fetch = mock(async () => ({
      ok: true,
      body: createMockStream(streamChunks),
    }));

    await search('query', 'sonar', { onContent, onDone, onError });

    expect(onDone).toHaveBeenCalledWith(results, usage);
    expect(onError).not.toHaveBeenCalled();
  });

  test('search handles JSON split across chunks (buffer logic)', async () => {
    const streamChunks = [
      'data: {"choices":[{"delta":',
      '{"content":"Hello"}}]}\n',
    ];

    const onContent = mock(() => {});
    const onDone = mock(() => {});
    const onError = mock(() => {});

    // @ts-expect-error - mock fetch for testing
    global.fetch = mock(async () => ({
      ok: true,
      body: createMockStream(streamChunks),
    }));

    await search('query', 'sonar', { onContent, onDone, onError });

    expect(onContent).toHaveBeenCalledWith('Hello');
    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  test('search calls onError on HTTP failure', async () => {
    // @ts-expect-error - mock fetch for testing
    global.fetch = mock(async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }));

    const onContent = mock(() => {});
    const onDone = mock(() => {});
    const onError = mock(() => {});

    await search('query', 'sonar', { onContent, onDone, onError });

    expect(onError).toHaveBeenCalled();
    expect(onContent).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
