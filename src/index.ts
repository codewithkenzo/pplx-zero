#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { search, MODELS, type Model } from './api';
import { encodeFile } from './files';
import { getEnv } from './env';
import { fmt, write, writeLn } from './output';
import { appendHistory, readHistory, getLastEntry } from './history';
import { renderMarkdown, createMarkdownState } from './markdown';
import { search as ragSearch, searchForRag, ingestDirectory, ingestFile, ingestPath, getDocCount, getKnowledgeDir } from './rag';

getEnv();

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    model: { type: 'string', short: 'm', default: 'sonar' },
    file: { type: 'string', short: 'f' },
    image: { type: 'string', short: 'i' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
    history: { type: 'boolean', default: false },
    'no-history': { type: 'boolean', default: false },
    continue: { type: 'boolean', short: 'c', default: false },
    local: { type: 'boolean', short: 'l', default: false },
    ingest: { type: 'boolean', default: false },
    output: { type: 'string', short: 'o' },
    raw: { type: 'boolean', default: false },
  },
  allowPositionals: true,
  strict: true,
});

if (values.help) {
  console.log(`
pplx - Perplexity AI search from terminal

Usage: pplx [options] <query>

Options:
  -m, --model <name>   Model: ${MODELS.join(', ')} (default: sonar)
  -f, --file <path>    Attach a file (PDF, TXT, etc.)
  -i, --image <path>   Attach an image (PNG, JPG, etc.)
  -o, --output <path>  Save output to file (.md, .txt)
  -c, --continue       Continue from last query (add context)
  -l, --local          RAG: search local docs, inject as context
  --ingest [path]      Index file/dir/glob (default: ~/.pplx/knowledge/)
  --history            Show query history
  --no-history         Don't save this query to history
  --raw                Raw output (no markdown rendering)
  --json               Output as JSON
  -h, --help           Show this help

Examples:
  pplx "what is bun"
  pplx -m sonar-pro "explain quantum computing"
  pplx -f report.pdf "summarize this document"
  pplx -c "tell me more about that"
  pplx --history | grep "bun"
  pplx --ingest
  pplx -l "my notes on rust"
`);
  process.exit(0);
}

if (values.history) {
  const entries = await readHistory(20);
  if (entries.length === 0) {
    console.log('No history yet.');
  } else {
    for (const entry of entries) {
      console.log(fmt.historyEntry(entry.ts, entry.m, entry.q));
    }
  }
  process.exit(0);
}

if (values.ingest) {
  const target = positionals[0];

  try {
    if (target) {
      const stats = await ingestPath(target);
      if (stats.added + stats.updated + stats.skipped === 0) {
        console.log(`No files found matching: ${target}`);
      } else {
        console.log(`Done! Added: ${stats.added}, Updated: ${stats.updated}, Skipped: ${stats.skipped}`);
      }
    } else {
      console.log(`Indexing files from ${getKnowledgeDir()}...`);
      const stats = await ingestDirectory();
      console.log(`Done! Added: ${stats.added}, Updated: ${stats.updated}, Skipped: ${stats.skipped}`);
    }

    console.log(`Total documents: ${getDocCount()}`);
  } catch (err) {
    console.error(fmt.error(err instanceof Error ? err.message : 'Ingest failed'));
    process.exit(2);
  }
  process.exit(0);
}

let ragContext = '';

if (values.local) {
  const query = positionals.join(' ');
  if (!query) {
    console.error(fmt.error('No query provided for local search.'));
    process.exit(2);
  }

  const results = searchForRag(query);

  if (results.length === 0) {
    console.log('No local documents match. Proceeding with Perplexity only...\n');
  } else {
    if (!values.json) {
      console.log(`${fmt.model('local')} Found ${results.length} relevant doc(s), using as context...\n`);
    }

    ragContext = 'Context from user\'s knowledge base:\n---\n';
    for (const r of results) {
      ragContext += `[${r.title}]:\n${r.content}\n\n`;
    }
    ragContext += '---\n\nQuestion: ';
  }
}

if (positionals.length === 0 && !values.continue && !values.local) {
  console.error(fmt.error('No query provided. Use -h for help.'));
  process.exit(2);
}

// Validate model before proceeding
if (!MODELS.includes(values.model as Model)) {
  console.error(fmt.error(`Invalid model: ${values.model}. Available: ${MODELS.join(', ')}`));
  process.exit(2);
}
const model = values.model as Model;

let query = positionals.join(' ');

if (ragContext) {
  query = ragContext + query;
}

if (values.continue) {
  const last = await getLastEntry();
  if (last) {
    const userQuery = positionals.join(' ') || 'Continue and elaborate on the previous answer.';
    const historyContext = `Previous question: "${last.q}"\nPrevious answer: "${last.a.slice(0, 500)}..."\n\nFollow-up question: ${userQuery}`;
    const context = ragContext ? ragContext + historyContext : historyContext;
    query = context;
    if (!values.json) {
      await write(fmt.continuing(last.q));
    }
  } else if (!query) {
    console.error(fmt.error('No previous query to continue from.'));
    process.exit(2);
  }
}

const filePath = values.file || values.image;
let file;
if (filePath) {
  try {
    file = await encodeFile(filePath);
  } catch (err) {
    let msg = err instanceof Error ? err.message : 'Unknown error reading file';
    if (msg.includes('ENOENT')) {
      msg = `File not found: ${filePath}`;
    }
    console.error(fmt.error(msg));
    process.exit(2);
  }
}

// Validate model supports image input
if (file?.type === 'image' && model === 'sonar-deep-research') {
  console.error(fmt.error('sonar-deep-research does not support image input. Use sonar or sonar-pro.'));
  process.exit(2);
}

const startTime = Date.now();
let fullContent = '';
const mdState = createMarkdownState();

if (!values.json) {
  await write(fmt.model(model) + ' ');
  await write(fmt.searching());
}

await search(query, model, {
  onContent: async (text) => {
    fullContent += text;
    if (!values.json) {
      const out = values.raw ? text : renderMarkdown(text, mdState);
      await write(out);
    }
  },
  onDone: async (citations, usage) => {
    const elapsed = Date.now() - startTime;
    const citationUrls = citations.map((c) => c.url);

    if (values.json) {
      const output = {
        answer: fullContent,
        citations: citationUrls,
        model,
        tokens: usage.prompt_tokens + usage.completion_tokens,
        latency_ms: elapsed,
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      if (citations.length > 0) {
        await writeLn(fmt.sources());
        for (let i = 0; i < citations.length; i++) {
          await writeLn(fmt.citation(i + 1, citations[i]!.url));
        }
      }
      await write(fmt.stats(usage.prompt_tokens + usage.completion_tokens, elapsed));
    }

    if (values.output) {
      const ext = values.output.split('.').pop()?.toLowerCase();
      let content = '';

      if (ext === 'md') {
        content = `# ${positionals.join(' ') || 'Query'}\n\n`;
        content += `**Model:** ${model}\n`;
        content += `**Date:** ${new Date().toISOString()}\n\n`;
        content += `## Answer\n\n${fullContent}\n\n`;
        if (citationUrls.length > 0) {
          content += `## Sources\n\n`;
          citationUrls.forEach((url, i) => {
            content += `${i + 1}. ${url}\n`;
          });
        }
      } else {
        content = fullContent;
        if (citationUrls.length > 0) {
          content += '\n\nSources:\n';
          citationUrls.forEach((url, i) => {
            content += `${i + 1}. ${url}\n`;
          });
        }
      }

      await Bun.write(values.output, content);
      if (!values.json) {
        await writeLn(`\n${fmt.model('saved')} ${values.output}`);
      }
    }

    if (!values['no-history'] && !values.json) {
      await appendHistory({
        q: positionals.join(' ') || '(continued)',
        m: model,
        a: fullContent,
        citations: citationUrls,
      });
    }
  },
  onError: async (error) => {
    if (values.json) {
      console.error(JSON.stringify({ error: error.message }));
    } else {
      await write(fmt.error(error.message));
    }
    process.exit(1);
  },
}, file);
