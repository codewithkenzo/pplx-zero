import { Database } from 'bun:sqlite';
import { Glob } from 'bun';
import { homedir } from 'node:os';
import { join, basename, resolve, extname } from 'node:path';
import { mkdir, stat, copyFile } from 'node:fs/promises';

const PPLX_DIR = join(homedir(), '.pplx');
const KNOWLEDGE_DIR = join(PPLX_DIR, 'knowledge');
const DB_PATH = join(PPLX_DIR, 'rag.db');

let db: Database | null = null;

function getDb(): Database {
  if (db) return db;
  
  db = new Database(DB_PATH);
  
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
      path,
      title,
      content,
      tokenize = 'porter unicode61'
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE NOT NULL,
      title TEXT,
      ingested_at INTEGER DEFAULT (unixepoch())
    );
  `);
  
  return db;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export interface IngestStats {
  added: number;
  updated: number;
  skipped: number;
}

export async function ensureKnowledgeDir(): Promise<void> {
  await mkdir(KNOWLEDGE_DIR, { recursive: true });
}

export async function ingestFile(filePath: string): Promise<'added' | 'updated' | 'skipped'> {
  const db = getDb();
  const content = await Bun.file(filePath).text();
  
  if (!content.trim()) return 'skipped';
  
  const title = filePath.split('/').pop()?.replace(/\.(md|txt)$/, '') || filePath;
  
  const existing = db.query('SELECT id FROM docs WHERE path = ?').get(filePath) as { id: number } | null;
  
  if (existing) {
    db.run('DELETE FROM docs_fts WHERE rowid = ?', [existing.id]);
    db.run('UPDATE docs SET title = ?, ingested_at = unixepoch() WHERE id = ?', [title, existing.id]);
    db.run('INSERT INTO docs_fts (rowid, path, title, content) VALUES (?, ?, ?, ?)', 
      [existing.id, filePath, title, content]);
    return 'updated';
  }
  
  const result = db.run('INSERT INTO docs (path, title) VALUES (?, ?)', [filePath, title]);
  const docId = result.lastInsertRowid;
  db.run('INSERT INTO docs_fts (rowid, path, title, content) VALUES (?, ?, ?, ?)', 
    [docId, filePath, title, content]);
  
  return 'added';
}

export async function ingestDirectory(dir?: string): Promise<IngestStats> {
  await ensureKnowledgeDir();
  
  const targetDir = dir || KNOWLEDGE_DIR;
  const glob = new Glob('**/*.{md,txt}');
  const files: string[] = [];
  
  for await (const file of glob.scan({ cwd: targetDir, absolute: true })) {
    files.push(file);
  }
  
  const stats: IngestStats = { added: 0, updated: 0, skipped: 0 };
  
  for (const file of files) {
    const result = await ingestFile(file);
    stats[result]++;
  }
  
  return stats;
}

export function search(query: string, limit = 5): SearchResult[] {
  const db = getDb();
  
  const ftsQuery = query
    .trim()
    .split(/\s+/)
    .map(word => `${word}*`)
    .join(' OR ');
  
  const stmt = db.prepare(`
    SELECT 
      path,
      title,
      snippet(docs_fts, 2, '>', '<', '...', 40) as snippet,
      bm25(docs_fts) as score
    FROM docs_fts
    WHERE docs_fts MATCH ?
    ORDER BY score
    LIMIT ?
  `);
  
  try {
    return stmt.all(ftsQuery, limit) as SearchResult[];
  } catch {
    return [];
  }
}

export function getDocCount(): number {
  const db = getDb();
  const result = db.query('SELECT COUNT(*) as count FROM docs').get() as { count: number };
  return result.count;
}

export function getKnowledgeDir(): string {
  return KNOWLEDGE_DIR;
}

const SUPPORTED_EXTS = new Set(['.md', '.txt']);

async function copyToKnowledge(filePath: string): Promise<string> {
  await ensureKnowledgeDir();
  const ext = extname(filePath);
  const name = basename(filePath, ext);
  let dest = join(KNOWLEDGE_DIR, basename(filePath));
  let counter = 1;
  while (await Bun.file(dest).exists()) {
    dest = join(KNOWLEDGE_DIR, `${name}_${counter}${ext}`);
    counter++;
  }
  await copyFile(filePath, dest);
  return dest;
}

export async function ingestPath(target: string): Promise<IngestStats> {
  await ensureKnowledgeDir();
  const stats: IngestStats = { added: 0, updated: 0, skipped: 0 };
  const resolved = resolve(target);
  
  const isGlob = target.includes('*');
  
  if (isGlob) {
    const glob = new Glob(target);
    for await (const file of glob.scan({ cwd: process.cwd(), absolute: true })) {
      const ext = extname(file).toLowerCase();
      if (!SUPPORTED_EXTS.has(ext)) {
        console.log(`Skipping unsupported: ${file} (only .md, .txt)`);
        stats.skipped++;
        continue;
      }
      const dest = await copyToKnowledge(file);
      const result = await ingestFile(dest);
      stats[result]++;
      console.log(`${result}: ${basename(file)}`);
    }
    return stats;
  }
  
  let info;
  try {
    info = await stat(resolved);
  } catch {
    throw new Error(`Path not found: ${target}`);
  }
  
  if (info.isDirectory()) {
    console.log(`Indexing directory: ${resolved}`);
    const glob = new Glob('**/*.{md,txt}');
    for await (const file of glob.scan({ cwd: resolved, absolute: true })) {
      const dest = await copyToKnowledge(file);
      const result = await ingestFile(dest);
      stats[result]++;
      console.log(`${result}: ${basename(file)}`);
    }
    return stats;
  }
  
  const ext = extname(resolved).toLowerCase();
  if (ext === '.pdf') {
    throw new Error('PDF indexing not supported (requires text extraction library). Use -f to send PDFs to Perplexity API instead.');
  }
  if (!SUPPORTED_EXTS.has(ext)) {
    throw new Error(`Unsupported file type: ${ext}. Supported: .md, .txt`);
  }
  
  const dest = await copyToKnowledge(resolved);
  const result = await ingestFile(dest);
  stats[result]++;
  console.log(`${result}: ${basename(resolved)} → ~/.pplx/knowledge/`);
  
  return stats;
}
