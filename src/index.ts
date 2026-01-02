#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { search, MODELS, type Model } from './api';
import { encodeFile } from './files';
import { fmt, write, writeLn } from './output';


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

if (values.help || positionals.length === 0) {
  console.log(`
pplx - Perplexity AI search from terminal

Usage: pplx [options] <query>

Options:
  -m, --model <name>   Model: ${MODELS.join(', ')} (default: sonar)
  -f, --file <path>    Attach a file (PDF, TXT, etc.)
  -i, --image <path>   Attach an image (PNG, JPG, etc.)
  --json               Output as JSON
  -h, --help           Show this help

Examples:
  pplx "what is bun"
  pplx -m sonar-pro "explain quantum computing"
  pplx -f report.pdf "summarize this document"
`);
  process.exit(0);
}

const query = positionals.join(' ');
const model = (MODELS.includes(values.model as Model) ? values.model : 'sonar') as Model;

const filePath = values.file || values.image;
const file = filePath ? await encodeFile(filePath) : undefined;

const startTime = Date.now();
let fullContent = '';

if (!values.json) {
  await write(fmt.model(model) + ' ');
  await write(fmt.searching());
}

await search(query, model, {
  onContent: async (text) => {
    fullContent += text;
    if (!values.json) {
      await write(text);
    }
  },
  onDone: async (citations, usage) => {
    const elapsed = Date.now() - startTime;

    if (values.json) {
      const output = {
        answer: fullContent,
        citations: citations.map((c) => c.url),
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
