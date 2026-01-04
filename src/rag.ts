import { Database } from 'bun:sqlite';
import { Glob } from 'bun';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

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
    return stmt.all(query, limit) as SearchResult[];
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
