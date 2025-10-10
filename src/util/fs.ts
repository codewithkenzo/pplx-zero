import { realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export class WorkspaceSandbox {
  private workspacePath: string | null;

  constructor(workspacePath?: string) {
    this.workspacePath = workspacePath ? resolve(workspacePath) : null;
  }

  async validatePath(path: string): Promise<string> {
    const resolved = await realpath(path).catch(() => resolve(path));
    
    if (!this.workspacePath) {
      return resolved;
    }

    if (!resolved.startsWith(this.workspacePath)) {
      throw new Error(`Path ${resolved} is outside workspace ${this.workspacePath}`);
    }

    return resolved;
  }

  async resolveRelative(path: string, basePath: string = process.cwd()): Promise<string> {
    const absolute = resolve(basePath, path);
    return this.validatePath(absolute);
  }

  getWorkspacePath(): string | null {
    return this.workspacePath;
  }

  isInWorkspace(path: string): boolean {
    if (!this.workspacePath) return true;
    return resolve(path).startsWith(this.workspacePath);
  }
}
