const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  bgBlue: '\x1b[44m',
} as const;

export interface MarkdownState {
  inCode: boolean;
  codeLanguage: string;
}

export function createMarkdownState(): MarkdownState {
  return { inCode: false, codeLanguage: '' };
}

export function renderMarkdown(chunk: string, state: MarkdownState): string {
  let out = chunk;

  const fenceMatch = out.match(/```(\w*)/);
  if (fenceMatch) {
    state.inCode = !state.inCode;
    state.codeLanguage = fenceMatch[1] || '';
    out = out.replace(/```\w*/g, state.inCode ? `${c.yellow}━━━ ${state.codeLanguage || 'code'} ━━━${c.reset}` : `${c.yellow}━━━━━━━━━━━${c.reset}`);
    return out;
  }

  if (state.inCode) {
    return `${c.dim}${out}${c.reset}`;
  }

  if (out.startsWith('### ')) {
    return `${c.bold}${c.cyan}${out.slice(4)}${c.reset}`;
  }
  if (out.startsWith('## ')) {
    return `${c.bold}${c.magenta}${out.slice(3)}${c.reset}`;
  }
  if (out.startsWith('# ')) {
    return `${c.bold}${c.cyan}▸ ${out.slice(2)}${c.reset}`;
  }

  if (out.startsWith('> ')) {
    return `${c.italic}${c.gray}│ ${out.slice(2)}${c.reset}`;
  }

  if (out.match(/^[\-\*] /)) {
    out = out.replace(/^[\-\*] /, `${c.cyan}• ${c.reset}`);
  }
  if (out.match(/^\d+\. /)) {
    out = out.replace(/^(\d+)\. /, `${c.cyan}$1.${c.reset} `);
  }

  out = out
    .replace(/\*\*([^*]+)\*\*/g, `${c.bold}$1${c.reset}`)
    .replace(/\*([^*]+)\*/g, `${c.italic}$1${c.reset}`)
    .replace(/`([^`]+)`/g, `${c.bgBlue} $1 ${c.reset}`);

  return out;
}
