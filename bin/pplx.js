#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const hasBun = () => {
  try {
    execSync('bun --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

if (hasBun()) {
  const scriptPath = join(__dirname, '..', 'src', 'index.ts');
  const proc = spawn('bun', ['run', scriptPath, ...process.argv.slice(2)], {
    stdio: 'inherit'
  });
  proc.on('exit', (code) => process.exit(code ?? 1));
} else {
  console.error('\x1b[31mError: this tool requires Bun to be installed.\x1b[0m');
  console.error('\nInstall Bun:');
  console.error('  curl -fsSL https://bun.sh/install | bash');
  console.error('\nOr via npm:');
  console.error('  npm install -g bun');
  process.exit(1);
}
