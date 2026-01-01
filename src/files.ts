import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

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
  const ext = extname(path).toLowerCase();
  const mimeType = MIME_TYPES[ext];
  
  if (!mimeType) {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  const buffer = await readFile(path);
  const data = buffer.toString('base64');
  const isImage = mimeType.startsWith('image/');

  return {
    type: isImage ? 'image' : 'file',
    data,
    mimeType,
    filename: path.split('/').pop() || 'file',
  };
}

export function toDataUrl(attachment: FileAttachment): string {
  return `data:${attachment.mimeType};base64,${attachment.data}`;
}
