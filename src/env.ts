import { z } from 'zod';

const c = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
} as const;

const envSchema = z.object({
  PERPLEXITY_API_KEY: z.string()
    .min(1, 'API key is required')
    .startsWith('pplx-', 'API key should start with "pplx-"'),
});

let _env: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (_env) return _env;

  const result = envSchema.safeParse({
    PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || process.env.PERPLEXITY_AI_API_KEY,
  });

  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join(', ');
    console.error(`
${c.red}✗ Invalid Environment${c.reset}

${issues}

Set your Perplexity API key:

  ${c.cyan}export PERPLEXITY_API_KEY="pplx-..."${c.reset}

${c.dim}Get one at: https://www.perplexity.ai/settings/api${c.reset}
`);
    process.exit(1);
  }

  _env = result.data;
  return _env;
}
