# Blueprint: History Feature

## Summary
Add query history to pplx-zero using JSON Lines file. Minimal addition (~80 LOC) that stays true to "zero bloat" philosophy. Let Unix tools handle filtering.

## Acceptance Criteria
- [ ] `pplx "query"` appends to history (unless --no-history)
- [ ] `pplx --history` shows last 20 entries
- [ ] `pplx --no-history "query"` skips history append
- [ ] History stored at `~/.pplx/history.jsonl`
- [ ] Auto-rotate at 1000 entries
- [ ] Pipe-friendly output for grep/tail

## Technical Approach

### Chosen: JSON Lines File

**Format** (`~/.pplx/history.jsonl`):
```json
{"ts":1735850000000,"q":"what is bun","m":"sonar","a":"Bun is a fast..."}
```

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `ts` | number | Unix timestamp |
| `q` | string | Query |
| `m` | string | Model |
| `a` | string | Answer (max 2000 chars) |

### Rejected Alternatives

| Alternative | Why Rejected |
|-------------|--------------|
| SQLite | Overkill for 1000 entries, adds complexity |
| Markdown files | Too many files, harder to manage |
| No history | User requested feature |

## Tasks

| # | Task | Size | File |
|---|------|------|------|
| 1 | Create history.ts with appendHistory, readHistory | S | src/history.ts |
| 2 | Add --history flag to show entries | S | src/index.ts |
| 3 | Add --no-history flag to disable | S | src/index.ts |
| 4 | Add rotation logic (max 1000) | S | src/history.ts |
| 5 | Add history formatting | S | src/output.ts |
| 6 | Update README | S | README.md |
| 7 | Add tests | S | src/history.test.ts |

## Implementation

### src/history.ts (~40 LOC)

```typescript
import type { Model } from './api';

export interface HistoryEntry {
  ts: number;
  q: string;
  m: Model;
  a: string;
}

const HISTORY_PATH = `${process.env.HOME}/.pplx/history.jsonl`;
const MAX_ENTRIES = 1000;

export async function appendHistory(entry: HistoryEntry): Promise<void> {
  const file = Bun.file(HISTORY_PATH);
  const exists = await file.exists();
  
  if (exists) {
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length >= MAX_ENTRIES) {
      const keep = lines.slice(-MAX_ENTRIES + 1).join('\n') + '\n';
      await Bun.write(HISTORY_PATH, keep);
    }
  }
  
  const line = JSON.stringify(entry) + '\n';
  await Bun.write(HISTORY_PATH, line, { createPath: true, append: true });
}

export async function readHistory(): Promise<HistoryEntry[]> {
  const file = Bun.file(HISTORY_PATH);
  if (!await file.exists()) return [];
  
  const text = await file.text();
  return text.trim().split('\n').map(line => JSON.parse(line)).reverse();
}
```

### CLI Integration

```typescript
// Add to parseArgs options
history: { type: 'boolean', default: false },
'no-history': { type: 'boolean', default: false },

// Handle --history flag
if (values.history) {
  const entries = await readHistory();
  for (const entry of entries.slice(0, 20)) {
    console.log(fmt.historyEntry(entry));
  }
  process.exit(0);
}

// After search completes
if (!values['no-history'] && !values.json) {
  await appendHistory({ ts: Date.now(), q: query, m: model, a: answer.slice(0, 2000) });
}
```

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Race conditions | Low | Low | CLI is single-user, low concurrency |
| File corruption | Low | Medium | Append-only, can regenerate |
| Large file | Low | Low | Auto-rotate at 1000 entries |

## Open Questions
- Should citations be stored? (Currently: no, keeps entries small)
- Should JSON mode queries be logged? (Currently: no)

## Future Upgrades (Not Now)
- SQLite if complex queries needed
- `pplx history search <term>` subcommand
- History sync across machines
