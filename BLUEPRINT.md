# Blueprint: pplx-zero v2

## Summary
Minimal rewrite of pplx-zero. Strip 8,347 LOC down to ~500. Core search only, no bloat.
Keep existing npm package `pplx-zero` and AUR package - just update remote to v2.

## Why Rewrite
- v1 has 14K lines of monitoring code (unused)
- 10K lines of "resilience" (retry logic nobody asked for)
- Webhooks, auto-updates, history, exports - all unused
- Minimalism score: 2/10

## v2 Philosophy
- Single responsibility: search Perplexity API
- Minimal dependencies (only what's needed)
- No state, no history, no persistence
- Stream-first for pipes and agents
- Beautiful terminal output

## Tech Stack (aligned with kenzo's patterns)

| Layer      | Tech                           | Rationale                          |
| ---------- | ------------------------------ | ---------------------------------- |
| Runtime    | Bun                            | Fast, native TS                    |
| Args       | `node:util` parseArgs          | Zero deps, native in Bun           |
| Env        | Zod schema parse               | Type-safe env (like himari-bot)    |
| Streaming  | `Bun.write(Bun.stdout, chunk)` | Zero-copy stdout (Shisho research) |
| Colors     | ANSI escapes (no chalk)        | Zero deps                          |
| HTTP       | Native fetch                   | Built into Bun                     |

### Code Patterns (from himari-bot)

**Env validation:**
```typescript
import { z } from 'zod';

const envSchema = z.object({
  PERPLEXITY_API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
```

**Arg parsing (from Shisho research):**
```typescript
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    model: { type: 'string', short: 'm', default: 'sonar' },
    file: { type: 'string', short: 'f' },
    image: { type: 'string', short: 'i' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
  strict: true,
});
```

**Streaming to stdout:**
```typescript
const res = await fetch(url, { method: 'POST', body, headers });
for await (const chunk of res.body!) {
  await Bun.write(Bun.stdout, chunk);
}
```

## Acceptance Criteria
- [ ] `pplx "query"` returns answer to stdout (streaming)
- [ ] `pplx -m sonar-pro "query"` selects model
- [ ] `pplx -f file.pdf "query"` attaches document
- [ ] `pplx -i image.png "query"` attaches image
- [ ] `pplx --json` outputs structured JSON
- [ ] Beautiful colored output (model name, citations, timing)
- [ ] Exit codes: 0 success, 1 API error, 2 usage error
- [ ] <500 LOC total

## Output Design

### Default (streaming with colors)
```
pplx "what is bun"

[sonar] Searching...

Bun is a fast JavaScript runtime built from scratch using Zig...
[continues streaming]

Sources:
  1. bun.sh - Official documentation
  2. github.com/oven-sh/bun - GitHub repository

[234 tokens, 1.2s]
```

### JSON mode
```json
{
  "answer": "Bun is a fast JavaScript runtime...",
  "citations": ["https://bun.sh", "https://github.com/oven-sh/bun"],
  "model": "sonar",
  "tokens": 234,
  "latency_ms": 1200
}
```

## File Structure
```
pplx-zero/
  src/
    index.ts      # Entry point, arg parsing (~80 LOC)
    api.ts        # Perplexity API client (~120 LOC)
    files.ts      # File/image base64 encoding (~60 LOC)
    output.ts     # Terminal formatting, colors (~80 LOC)
    env.ts        # Zod env schema (~20 LOC)
  package.json
  tsconfig.json
  README.md
```

## Dependencies (minimal)
```json
{
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.0"
  }
}
```

## Tasks
| # | Task                                          | Size | Notes                  |
| - | --------------------------------------------- | ---- | ---------------------- |
| 1 | Init fresh in ~/dev/pplx-zero-v2              | S    | Link to existing repo  |
| 2 | Write env.ts - Zod schema for PERPLEXITY_KEY  | S    |                        |
| 3 | Write api.ts - Perplexity streaming client    | M    | SSE parsing            |
| 4 | Write files.ts - base64 encode files/images   | S    |                        |
| 5 | Write output.ts - ANSI colors, formatting     | S    |                        |
| 6 | Write index.ts - parseArgs, wire together     | M    |                        |
| 7 | Test all flags manually                       | S    |                        |
| 8 | Update README, package.json version           | S    |                        |
| 9 | Publish to npm (same package name)            | S    | `npm publish`          |
| 10| Update AUR PKGBUILD                           | S    |                        |

## Risks & Mitigations
| Risk                   | Likelihood | Impact | Mitigation                     |
| ---------------------- | ---------- | ------ | ------------------------------ |
| Feature creep          | High       | High   | Hard limit: 500 LOC            |
| Breaking existing users| Medium     | Medium | Keep CLI flags compatible      |
| SSE parsing edge cases | Low        | Medium | Test with all Perplexity models|

## Answered Questions
- **Keep AUR package?** YES - same package name, just update source
- **Keep npm package?** YES - same package name, bump major version
- **Batch mode?** NO - not worth complexity

## References
- Perplexity API docs: https://docs.perplexity.ai
- v1 source: ~/Archive/Projects/pplx-zero-v1/
- Shisho research: node:util parseArgs, Bun.write streaming patterns
- Tech patterns: ~/dev himari-bot (now himari-bot), lushgf
