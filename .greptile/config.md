## Review Priorities

1. **Logic bugs** - Flag control flow issues, lost state, race conditions
2. **Security** - API key exposure, injection, auth bypass
3. **Edge cases** - Empty inputs, undefined, boundary conditions
4. **Test gaps** - Untested paths, missing assertions

## Style Preferences

- No comments unless algorithm is complex
- Functions < 50 lines
- Prefer early returns over nested conditionals
- Error messages should be user-friendly (no stack traces in CLI output)

## Stack Context

- Runtime: Bun
- Language: TypeScript (strict)
- Validation: Zod
- Testing: bun:test

## What to Skip

- Nitpicks on formatting (we have linters)
- Suggestions to add comments/docs
- Framework recommendations

## Confidence Scoring

Be direct:
- 5/5 = merge now
- 3-4/5 = fixable, list specific issues
- 1-2/5 = block, explain why

Keep summaries under 200 words. List issues as bullet points with file:line references.
