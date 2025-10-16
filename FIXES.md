# CLI Fixes for Attachments and Advanced Models

## Issues Fixed

### 1. **Attachment Routing Fixed**
- **Problem**: Image and document attachments were incorrectly routed through the search API
- **Solution**: ALL attachments now use the chat completions API, regardless of model
- **Implementation**: Modified `executeSearch()` in `src/cli/commands/search.ts` to route any request with attachments to chat completions

### 2. **Advanced Model Response Parsing Fixed**
- **Problem**: `sonar-reasoning` and `sonar-deep-research` models returned `[object Object]` instead of content
- **Solution**: Added proper response parsing for chat completion responses
- **Implementation**: Updated response extraction in `src/engine/unified.ts` to safely extract content from response.choices[0].message.content

### 3. **Error Serialization Improved**
- **Problem**: Error objects were not properly serialized to JSON
- **Solution**: Added consistent error formatting and stringification
- **Implementation**: Enhanced `formatError()` method to handle stringified errors and ensure proper JSON output

### 4. **Output Format Standardization**
- **Problem**: Inconsistent JSON output structure across different modes
- **Solution**: Standardized output format with proper type checking and array validation
- **Implementation**: Added output sanitization in the main search handler to ensure consistent JSON structure

## Code Changes

### Core Engine (`src/engine/unified.ts`)

1. **Enhanced `executeAdvancedModel()`**:
   ```typescript
   // Properly extract content from chat completion response
   let content = '';
   if (response && response.choices && response.choices.length > 0) {
     const choice = response.choices[0];
     if (choice && choice.message && choice.message.content) {
       content = choice.message.content;
     }
   }
   ```

2. **Fixed `executeChatWithAttachments()`**:
   ```typescript
   // Extract citations and images safely
   const citations = response && Array.isArray(response.citations) ? response.citations : [];
   const images = response && Array.isArray(response.images) ? response.images : [];
   ```

3. **Improved `formatError()`**:
   ```typescript
   // Handle stringified errors (from JSON.parse)
   if (typeof error === 'string') {
     try {
       const parsed = JSON.parse(error);
       if (parsed.code && parsed.message) {
         return parsed;
       }
     } catch {
       // Not a JSON string, continue with normal processing
     }
   }
   ```

### CLI Commands (`src/cli/commands/search.ts`)

1. **Fixed attachment routing**:
   ```typescript
   if (isAdvancedModel || hasAttachments) {
     // ALL advanced models and attachments use chat completions API
     mode = isAdvancedModel ? 'advanced-model' : 'chat-attachments';
   ```

2. **Enhanced output serialization**:
   ```typescript
   // Use custom replacer to handle circular references
   const seen = new WeakSet();
   const jsonString = JSON.stringify(output, (key, value) => {
     if (typeof value === 'object' && value !== null) {
       if (seen.has(value)) {
         return '[Circular]';
       }
       seen.add(value);
     }
     return value;
   }, 2);
   ```

## Testing

Run the test script to verify fixes:

```bash
# Ensure API key is set
export PERPLEXITY_API_KEY="your-api-key"

# Run tests
bun test-fixes.js
```

## Usage Examples

### Advanced Models (Fixed)
```bash
# Now works correctly
pplx "Explain quantum computing" --model sonar-reasoning

# With attachments
pplx "Analyze this chart" --image chart.png --model sonar-deep-research
```

### Attachments (Fixed)
```bash
# Images and documents now route correctly
pplx "What's in this document?" --file report.pdf
pplx "Describe this image" --image photo.jpg
```

### Consistent Output
All modes now return consistent JSON structure:
```json
{
  "version": "1.0.0",
  "ok": true,
  "query": "your query",
  "mode": "advanced-model|chat-attachments|search-api",
  "content": "response content",
  "citations": [],
  "images": [],
  "executionTime": 1234
}
```

## Architecture Decisions

1. **Unified Routing**: Any request with attachments OR using advanced models goes through chat completions
2. **Safe Parsing**: All response parsing includes null checks and type validation
3. **Error Consistency**: Errors are always returned as strings, never as objects
4. **Output Validation**: Final JSON output is checked for circular references and properly serialized

These fixes ensure reliable handling of attachments and advanced models while maintaining backward compatibility with existing functionality.