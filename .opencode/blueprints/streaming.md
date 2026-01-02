# Blueprint: Streaming Architecture

## Summary
Document current streaming implementation and evaluate AI SDK integration. Current native SSE parsing is sufficient; AI SDK is overkill for this minimal tool.

## Current Implementation

### How It Works
1. Send POST to `https://api.perplexity.ai/chat/completions` with `stream: true`
2. Response is Server-Sent Events (SSE) in OpenAI-compatible format
3. Parse chunks, extract `delta.content`, write to stdout

### SSE Format
```text
data: {"id":"...","model":"sonar","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"...","model":"sonar","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: [DONE]
```

### Current Code (src/api.ts)
- Uses native `fetch` with `response.body` ReadableStream
- Manual SSE parsing (~20 lines)
- Writes chunks to stdout via `Bun.write(Bun.stdout, chunk)`

## AI SDK Evaluation

### What AI SDK Provides
| Feature | Native | AI SDK |
|---------|--------|--------|
| SSE parsing | Manual (~20 lines) | Automatic |
| Type safety | Manual interfaces | Built-in Zod schemas |
| Multi-provider | Separate code per API | Unified API |
| Tool calling | Not supported | Built-in |
| Structured output | Manual JSON parsing | `streamObject()` |

### Bundle Size Impact
| Package | Size (gzipped) |
|---------|----------------|
| Native fetch | 0 KB |
| `ai` | ~15 KB |
| `@ai-sdk/perplexity` | ~2 KB |
| **Total** | **~17 KB** |

### Verdict: Not Worth It (For Now)

**Reasons to skip AI SDK**:
1. Tool is 300 LOC, adding 17KB for parsing is overkill
2. Only using one provider (Perplexity)
3. Not using tool calling or structured output
4. Current SSE parsing works fine

**When to reconsider**:
- Adding multiple providers (OpenAI, Anthropic, etc.)
- Adding tool/function calling
- Adding structured JSON streaming
- Significant changes to Perplexity API format

## Streaming Best Practices

### Current (Keep)
```typescript
const res = await fetch(url, { method: 'POST', body, headers });
for await (const chunk of res.body!) {
  // Parse SSE, extract content, write to stdout
}
```

### If Migrating to AI SDK (Future)
```typescript
import { createPerplexity } from '@ai-sdk/perplexity';
import { streamText } from 'ai';

const perplexity = createPerplexity({ apiKey: env.PERPLEXITY_API_KEY });
const result = await streamText({
  model: perplexity('sonar'),
  prompt: query,
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Decision
**Status**: Keep native implementation. Document for future reference.
