import { test, expect, describe } from 'bun:test';
import { encodeFile, toDataUrl, type FileAttachment } from '../src/files';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const TMP_DIR = '/tmp';

describe('encodeFile', () => {
  test('encodes text file correctly', async () => {
    const testPath = join(TMP_DIR, 'test.txt');
    await writeFile(testPath, 'hello world');
    
    const result = await encodeFile(testPath);
    
    expect(result.type).toBe('file');
    expect(result.mimeType).toBe('text/plain');
    expect(result.filename).toBe('test.txt');
    expect(result.data).toBe(Buffer.from('hello world').toString('base64'));
    
    await unlink(testPath);
  });

  test('encodes PDF as file type', async () => {
    const testPath = join(TMP_DIR, 'test.pdf');
    await writeFile(testPath, '%PDF-1.4 test');
    
    const result = await encodeFile(testPath);
    
    expect(result.type).toBe('file');
    expect(result.mimeType).toBe('application/pdf');
    
    await unlink(testPath);
  });

  test('encodes PNG as image type', async () => {
    const testPath = join(TMP_DIR, 'test.png');
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    await writeFile(testPath, pngHeader);
    
    const result = await encodeFile(testPath);
    
    expect(result.type).toBe('image');
    expect(result.mimeType).toBe('image/png');
    
    await unlink(testPath);
  });

  test('throws on unsupported file type', async () => {
    const testPath = join(TMP_DIR, 'test.xyz');
    await writeFile(testPath, 'test');
    
    await expect(encodeFile(testPath)).rejects.toThrow('Unsupported file type: .xyz');
    
    await unlink(testPath);
  });
});

describe('toDataUrl', () => {
  test('creates valid data URL', () => {
    const attachment: FileAttachment = {
      type: 'image',
      data: 'aGVsbG8gd29ybGQ=',
      mimeType: 'image/png',
      filename: 'test.png',
    };
    
    const result = toDataUrl(attachment);
    
    expect(result).toBe('data:image/png;base64,aGVsbG8gd29ybGQ=');
  });
});
