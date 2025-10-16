/**
 * Help templates and usage information for PPLX-Zero CLI
 * Provides comprehensive help documentation and examples
 */

import { formatVersionInfo } from '../../utils/version.js';

/**
 * Main help message template
 */
export async function getHelpMessage(): Promise<string> {
  const versionInfo = await formatVersionInfo();

  return `
${versionInfo} - Perplexity AI search CLI with multi-search, history, and export

USAGE:
  pplx [OPTIONS] [QUERY...]

SEARCH OPTIONS:
  -m, --model <model>         AI model: sonar, sonar-pro, sonar-reasoning, sonar-deep-research
  -n, --max-results <n>       Maximum results per query (default: 5, range: 1-20)
  -c, --concurrency <n>       Concurrency for batch searches (default: 5, range: 1-20)
  -t, --timeout <ms>           Request timeout in milliseconds (default: 30000, range: 1000-300000)
  -f, --file <file>           Attach document for analysis (PDF, DOCX, TXT, etc.)
  -i, --image <file>          Attach image for analysis (PNG, JPG, WEBP, etc.)
  -o, --format <format>       Output format: json|jsonl (default: json)
  -q, --query <query>         Search query (alternative to positional queries)

EXPORT OPTIONS:
      --export <filename>     Export results to file (supports .txt, .md, .json)

HISTORY OPTIONS:
  -h, --history [n]           Show search history (last n searches, max 50)
      --search-files          Show individual search files with query+date naming
      --update-check          Check for available updates
      --auto-update           Install available updates and relaunch

INPUT OPTIONS:
  -I, --input <file>          Read queries from JSON file
  -s, --stdin                 Read queries from stdin (JSON format)
      --attach <files>        Additional file attachments (multiple allowed)
      --attach-image <files>  Additional image attachments (multiple allowed)

ADVANCED OPTIONS:
      --async                 Enable async mode for advanced models
      --webhook <url>         Webhook URL for async results
      --workspace <path>      Workspace directory for file operations
      --use-search-api        Use search API (default: true)
      --batch-size <n>        Batch size for processing (default: 20, range: 1-100)

HELP OPTIONS:
      --help                  Show this help message
      --help-advanced         Show advanced help and examples
  -v, --version               Show version information

EXAMPLES:
  # Single search
  pplx "latest AI developments"

  # Multi-search (automatic detection)
  pplx "AI trends 2024" "Rust vs Go" "Web3 adoption"

  # Multi-search with export
  pplx --model sonar-pro --export research.txt "quantum" "blockchain"

  # Search with file attachments
  pplx --file report.pdf "Summarize this document"
  pplx --image screenshot.png "What is this showing?"

  # Advanced models
  pplx --model sonar-reasoning "Explain quantum computing"
  pplx --model sonar-deep-research --export research.pdf "comprehensive AI analysis"

  # View history
  pplx --history          # Show all history (up to 50)
  pplx --history 10       # Show last 10 searches
  pplx -h 10             # Same as above

  # Export results
  pplx --export results.md "machine learning trends"
  pplx --export analysis.txt "AI developments" "blockchain news"

  # Read from file
  pplx --input queries.json
  echo '{"query": "test search"}' | pplx --stdin

  # Multiple attachments
  pplx --file doc1.pdf --file doc2.txt --attach img1.png "analyze these files"

CONFIGURATION:
  • Set API key: export PERPLEXITY_API_KEY="your-key"
  • Get API key: https://www.perplexity.ai/account/api/keys
  • History is automatically saved to ~/.pplx-zero/history/
  • Export files are saved with cleaned, readable text

ADDITIONAL HELP:
  Use --help-advanced for detailed examples and advanced usage patterns
  Use --version to see current version and update information
`;
}

/**
 * Advanced help message with detailed examples
 */
export async function getAdvancedHelpMessage(): Promise<string> {
  const versionInfo = await formatVersionInfo();

  return `
${versionInfo} - Advanced Usage Guide

ADVANCED SEARCH PATTERNS:

1. Complex Research Queries:
   pplx --model sonar-deep-research --export research.pdf \\
     "comprehensive analysis of quantum computing applications in finance"

2. Batch Research with Multiple Topics:
   pplx --model sonar-pro --export batch-research.md \\
     "AI in healthcare" "blockchain supply chain" "quantum cryptography" "neural networks"

3. Document Analysis Workflows:
   pplx --file research.pdf --file data.csv --export analysis.md \\
     "analyze these research documents and provide insights"

4. Multi-Modal Analysis:
   pplx --image chart.png --file data.xlsx \\
     "analyze this chart and spreadsheet data"

PERFORMANCE OPTIMIZATION:

5. High-Concurrency Searches:
   pplx --concurrency 10 --max-results 3 \\
     "topic1" "topic2" "topic3" "topic4" "topic5"

6. Timeout Management:
   pplx --timeout 60000 --model sonar-reasoning \\
     "complex philosophical question requiring deep analysis"

7. Custom Batch Processing:
   pplx --batch-size 50 --export large-results.json \\
     $(cat large-query-list.txt)

INPUT FORMAT EXAMPLES:

JSON File Format (queries.json):
{
  "queries": ["query1", "query2", "query3"],
  "metadata": {
    "project": "research",
    "author": "analyst"
  }
}

Complex JSON Format:
{
  "requests": [
    {"args": {"query": "first search", "model": "sonar-pro"}},
    {"args": {"query": "second search", "maxResults": 10}}
  ]
}

Stdin Input:
echo '{"queries": ["search1", "search2"]}' | pplx --stdin

EXPORT FORMATS AND CONFIGURATIONS:

8. Markdown Export with Metadata:
   pplx --export comprehensive-report.md --model sonar-pro \\
     "detailed analysis topic"

9. JSON Export for Processing:
   pplx --export data.json --format jsonl \\
     "structured data retrieval"

10. Custom Export Filenames:
    pplx --export "research-$(date +%Y-%m-%d).md" \\
      "daily research summary"

ASYNC AND WEBHOOK INTEGRATION:

11. Async Processing:
    pplx --model sonar-reasoning --async --webhook https://api.example.com/webhook \\
      "long-running analysis task"

12. Batch Async Processing:
    pplx --async --webhook https://api.example.com/webhook \\
      "task1" "task2" "task3"

FILE ATTACHMENT WORKFLOWS:

13. Multiple Document Analysis:
    pplx --file doc1.pdf --file doc2.docx --file doc3.txt \\
      --attach additional.pdf --attach-image chart.png \\
      "comprehensive document analysis"

14. Research Paper Analysis:
    pplx --file paper.pdf --export paper-analysis.md \\
      "summarize key findings and methodology"

ERROR HANDLING AND DEBUGGING:

15. Verbose Logging:
    PPLX_DEBUG=1 pplx --model sonar-pro "test query"

16. Custom Timeout Settings:
    pplx --timeout 120000 --max-results 1 "slow network test"

HISTORY AND WORKFLOW MANAGEMENT:

17. Search History Analysis:
    pplx --history 20
    pplx --search-files "research"

18. Continuous Research Workflow:
    pplx --export ongoing-research.md "topic continuation"
    pplx --export ongoing-research.md --append "additional research"

ADVANCED CONFIGURATION:

19. Environment Variables:
    export PERPLEXITY_API_KEY="your-api-key"
    export PPLX_DEFAULT_MODEL="sonar-pro"
    export PPLX_MAX_RESULTS="10"
    export PPLX_TIMEOUT="60000"

20. Workspace Configuration:
    pplx --workspace /path/to/project --file ./docs/report.pdf \\
      "analyze project documentation"

TROUBLESHOOTING:

• API Issues: Verify API key and network connectivity
• Large Files: Use --timeout and --batch-size for large documents
• Rate Limits: Use --concurrency to manage request rates
• Memory Issues: Reduce --concurrency and --batch-size for large batch operations

For more information, visit: https://github.com/codewithkenzo/pplx-zero
`;
}

/**
 * Get examples for specific use cases
 */
export function getExamplesByCategory(): Record<string, string[]> {
  return {
    'Basic Search': [
      'pplx "latest AI developments"',
      'pplx --model sonar-pro "detailed analysis topic"',
      'pplx --max-results 10 "comprehensive search"'
    ],
    'Multi-Search': [
      'pplx "AI trends" "blockchain news" "quantum computing"',
      'pplx --model sonar-pro --export research.md "topic1" "topic2"',
      'pplx --concurrency 3 "fast search 1" "fast search 2" "fast search 3"'
    ],
    'File Analysis': [
      'pplx --file report.pdf "summarize this document"',
      'pplx --image screenshot.png "what is this showing?"',
      'pplx --file doc1.pdf --file doc2.txt "compare these documents"'
    ],
    'Advanced Models': [
      'pplx --model sonar-reasoning "explain complex concept"',
      'pplx --model sonar-deep-research --export research.pdf "comprehensive analysis"',
      'pplx --model sonar-pro --file research.pdf "detailed document analysis"'
    ],
    'Export & History': [
      'pplx --export results.md "research topic"',
      'pplx --history 10',
      'pplx --search-files "research"'
    ],
    'Input Methods': [
      'pplx --input queries.json',
      'echo \'{"query": "test"}\' | pplx --stdin',
      'pplx --query "explicit query syntax"'
    ],
    'Advanced Configuration': [
      'pplx --timeout 60000 --concurrency 2 "slow network search"',
      'pplx --webhook https://api.example.com/webhook --async "background task"',
      'pplx --workspace /project --file ./docs/report.pdf "project analysis"'
    ]
  };
}

/**
 * Get quick usage tips
 */
export function getQuickTips(): string[] {
  return [
    'Use --model sonar-pro for higher quality responses',
    'Add --export <filename> to save results for later reference',
    'Use --history to review your recent searches',
    'Combine multiple queries for efficient batch research',
    'Attach files with --file for document analysis',
    'Use --concurrency to speed up multi-search operations',
    'Set PERPLEXITY_API_KEY environment variable for convenience'
  ];
}

/**
 * Get troubleshooting information
 */
export function getTroubleshootingInfo(): string {
  return `
TROUBLESHOOTING COMMON ISSUES:

1. API Key Problems:
   • Ensure PERPLEXITY_API_KEY is set correctly
   • Verify your API key is active at https://www.perplexity.ai/account/api/keys
   • Check for typos in the API key

2. Network Issues:
   • Check internet connectivity
   • Try increasing --timeout for slow connections
   • Use --concurrency 1 for unstable networks

3. File Attachment Problems:
   • Ensure file paths are correct and accessible
   • Check file size limits (recommended < 10MB)
   • Verify file formats are supported

4. Memory Issues:
   • Reduce --concurrency for large batch operations
   • Use smaller --batch-size for processing
   • Close other applications to free memory

5. Rate Limiting:
   • Use --concurrency to manage request rates
   • Add delays between large batch operations
   • Consider upgrading your API plan

For additional support, visit: https://github.com/codewithkenzo/pplx-zero/issues
`;
}