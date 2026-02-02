import { readFile, stat } from 'node:fs/promises';
import { extname, basename, resolve } from 'node:path';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB - Perplexity API limit

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export interface FileAttachment {
  type: 'file' | 'image';
  data: string;
  mimeType: string;
  filename: string;
}

export async function encodeFile(path: string): Promise<FileAttachment> {
  // Security: prevent path traversal
  if (path.includes('..')) {
    throw new Error('Path traversal not allowed');
  }

  const resolved = resolve(path);
  const ext = extname(resolved).toLowerCase();
  const mimeType = MIME_TYPES[ext];

  if (!mimeType) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  // Security: check file size before reading into memory
  const stats = await stat(resolved);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max 50MB)`);
  }

  const buffer = await readFile(resolved);
  const data = buffer.toString('base64');
  const isImage = mimeType.startsWith('image/');

  return {
    type: isImage ? 'image' : 'file',
    data,
    mimeType,
    filename: basename(resolved),
  };
}

export function toDataUrl(attachment: FileAttachment): string {
  return `data:${attachment.mimeType};base64,${attachment.data}`;
}

