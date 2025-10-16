# Backend Architecture Consolidation - Migration Guide

## Overview

This document outlines the major backend architecture consolidation that eliminated duplicated engine layers and unified the Perplexity AI search functionality.

## What Changed

### 1. Unified Engine Architecture

**Before:**
- `OptimizedPerplexitySearchEngine` in `src/core.ts` (780 lines)
- `PerplexitySearchTool` in `src/index.ts` (488 lines)
- Duplicated functionality with different APIs

**After:**
- `UnifiedPerplexityEngine` in `src/engine/unified.ts` (single source of truth)
- Backward compatibility layers in `src/core.ts` and `src/index.ts`
- All functionality consolidated into one engine class

### 2. Public API for File Attachments

**Before:**
```typescript
// Private API access (BREAKS ENCAPSULATION)
const attachments = await engine['processFileAttachments'](filePaths);
```

**After:**
```typescript
// Public API with proper encapsulation
import { processFileAttachments } from './core.js';
const attachments = await processFileAttachments(filePaths);
```

### 3. Unified Environment Variable Handling

**Before:**
- CLI only checked `PERPLEXITY_API_KEY`
- Library accepted both `PERPLEXITY_API_KEY` and `PERPLEXITY_AI_API_KEY`

**After:**
- Both CLI and library use unified `getApiKey()` function
- Consistent fallback strategy: `PERPLEXITY_API_KEY` → `PERPLEXITY_AI_API_KEY`
- Clear error messages for missing API keys

### 4. Canonical Error Handling

**Before:**
- CLI built ad-hoc error objects
- Library had canonical `ERROR_CODES` but they weren't used consistently

**After:**
- All errors use canonical `ErrorCode` enum
- Consistent error shapes across CLI and library
- Proper error mapping with intelligent error code detection

### 5. Improved Timeout and Resilience

**Before:**
- Basic timeout handling
- No retry logic
- Limited resilience patterns

**After:**
- Configurable timeout handling with automatic retry
- Exponential backoff for retryable errors
- Circuit breaker patterns
- Resilience profiles (conservative, balanced, aggressive)

## Backward Compatibility

### CLI Compatibility
All existing CLI commands continue to work without changes:

```bash
# These commands work exactly as before
pplx "latest AI developments"
pplx --model sonar-pro --export research.txt "quantum" "blockchain"
pplx --file report.pdf "Summarize this document"
```

### Library Compatibility
All existing library APIs are preserved:

```typescript
// These APIs work exactly as before
import { OptimizedPerplexitySearchEngine, fastSearch, fastMultiSearch } from './core.js';
import { PerplexitySearchTool } from './index.js';

const engine = new OptimizedPerplexitySearchEngine(apiKey);
const results = await fastSearch("query");
```

## New Features

### 1. Unified Engine Configuration

```typescript
import { createPerplexityEngine } from './engine/unified.js';

const engine = createPerplexityEngine({
  defaultModel: 'sonar-pro',
  timeout: 60000,
  enableResilience: true,
  maxRetries: 5,
  logLevel: 'debug'
});
```

### 2. Public Attachment Processing

```typescript
import { processFileAttachments } from './core.js';

const attachments = await processFileAttachments([
  'document.pdf',
  'image.png'
]);
```

### 3. Unified Environment Variables

```typescript
import { getApiKey } from './core.js';

// Automatically checks PERPLEXITY_API_KEY first, then PERPLEXITY_AI_API_KEY
const apiKey = getApiKey();
```

## Performance Improvements

1. **Reduced Bundle Size**: Eliminated duplicate code (~500 lines saved)
2. **Better Memory Usage**: Single engine instance instead of multiple
3. **Improved Error Handling**: Consistent error codes reduce debugging time
4. **Enhanced Resilience**: Automatic retry with exponential backoff

## Security Enhancements

1. **No More Private API Access**: All APIs are now properly public
2. **Consistent API Key Handling**: No environment variable confusion
3. **Better Error Sanitization**: Sensitive information not exposed in errors

## Migration Steps for Users

### No Changes Required
The migration is designed to be fully backward compatible. No changes are required for existing code.

### Optional Improvements
If you want to take advantage of new features:

1. **Use the new public attachment API:**
   ```typescript
   // Instead of: engine['processFileAttachments'](...)
   import { processFileAttachments } from './core.js';
   const attachments = await processFileAttachments(filePaths);
   ```

2. **Use unified environment variable handling:**
   ```typescript
   import { getApiKey } from './core.js';
   const apiKey = getApiKey(); // Handles both env vars
   ```

3. **Consider using the unified engine directly:**
   ```typescript
   import { createPerplexityEngine } from './engine/unified.js';
   const engine = createPerplexityEngine({
     defaultModel: 'sonar-pro',
     enableResilience: true
   });
   ```

## Testing

Run the following tests to ensure everything works:

```bash
# Test CLI functionality
bun run cli:test

# Test library functionality
bun run lib:test

# Test unified engine
bun run engine:test
```

## File Structure Changes

```
src/
├── engine/
│   └── unified.ts          # New unified engine implementation
├── core.ts                 # Updated: backward compatibility layer
├── index.ts                # Updated: uses unified engine
├── cli.ts                  # Updated: uses public APIs
└── types.ts                # Unchanged: canonical error codes
```

## Troubleshooting

### Issues and Solutions

1. **TypeScript compilation errors:**
   - Clear cache: `rm -rf node_modules/.cache`
   - Rebuild: `bun run build`

2. **Runtime errors with attachments:**
   - Update imports: `import { processFileAttachments } from './core.js'`
   - Use public API instead of private bracket access

3. **Environment variable issues:**
   - The new unified handling supports both `PERPLEXITY_API_KEY` and `PERPLEXITY_AI_API_KEY`
   - Set one of these environment variables

4. **Error handling changes:**
   - Error codes are now canonical and consistent
   - Check `ErrorCode` enum in `types.ts` for available codes

## Support

If you encounter any issues during migration:

1. Check the error codes in `src/types.ts`
2. Review the implementation in `src/engine/unified.ts`
3. Run the test suite to identify issues
4. Check backward compatibility layers in `src/core.ts`

## Conclusion

This consolidation provides:
- ✅ Single, cohesive engine surface
- ✅ Eliminated all duplicated responsibilities
- ✅ Consistent environment variable handling
- ✅ Unified error handling with canonical error codes
- ✅ No more private API access
- ✅ Improved backend security and reliability
- ✅ Full backward compatibility
- ✅ Enhanced performance and maintainability

The migration is designed to be seamless for existing users while providing a solid foundation for future development.