const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
} as const;

export const fmt = {
  model: (name: string) => `${c.cyan}[${name}]${c.reset}`,
  searching: () => `${c.dim}Searching...${c.reset}\n`,
  error: (msg: string) => `${c.red}Error: ${msg}${c.reset}\n`,
  citation: (i: number, url: string) => `${c.dim}  ${i}. ${url}${c.reset}`,
  stats: (tokens: number, ms: number) => 
    `\n${c.gray}[${tokens} tokens, ${(ms / 1000).toFixed(1)}s]${c.reset}\n`,
  sources: () => `\n${c.yellow}Sources:${c.reset}`,
  historyEntry: (ts: number, model: string, query: string) => {
    const date = new Date(ts).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    return `${c.dim}${date}${c.reset} ${c.cyan}[${model}]${c.reset} ${query}`;
  },
  continuing: (query: string) => `${c.dim}Continuing from:${c.reset} ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}\n`,
};

export async function write(text: string): Promise<void> {
  await Bun.write(Bun.stdout, text);
}

export async function writeLn(text: string): Promise<void> {
  await Bun.write(Bun.stdout, text + '\n');
}
