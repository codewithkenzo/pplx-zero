#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const { join } = require('path');

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
  console.error('\x1b[31mError: pplx-zero requires Bun to be installed.\x1b[0m');
  console.error('\nInstall Bun:');
  console.error('  curl -fsSL https://bun.sh/install | bash');
  console.error('\nOr via npm:');
  console.error('  npm install -g bun');
  process.exit(1);
}
