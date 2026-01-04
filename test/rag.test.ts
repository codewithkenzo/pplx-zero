import { test, expect, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'pplx-rag-test-' + Date.now());
const TEST_KNOWLEDGE_DIR = join(TEST_DIR, 'knowledge');

beforeAll(async () => {
  await mkdir(TEST_KNOWLEDGE_DIR, { recursive: true });
  
  await writeFile(join(TEST_KNOWLEDGE_DIR, 'bun.md'), 
    '# Bun Runtime\n\nBun is an all-in-one JavaScript runtime built for speed.');
  
  await writeFile(join(TEST_KNOWLEDGE_DIR, 'rust.md'),
    '# Rust Language\n\nRust is a systems programming language focused on safety and performance.');
  
  await writeFile(join(TEST_KNOWLEDGE_DIR, 'empty.txt'), '');
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

test('FTS5 table creation works with bun:sqlite', () => {
  const db = new Database(':memory:');
  
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS test_fts USING fts5(
      title,
      content,
      tokenize = 'porter unicode61'
    );
  `);
  
  db.run('INSERT INTO test_fts (title, content) VALUES (?, ?)', 
    ['Test Doc', 'This is test content about JavaScript']);
  
  const results = db.query('SELECT * FROM test_fts WHERE test_fts MATCH ?').all('JavaScript');
  
  expect(results).toHaveLength(1);
  expect((results[0] as any).title).toBe('Test Doc');
});

test('BM25 ranking returns results in relevance order', () => {
  const db = new Database(':memory:');
  
  db.exec(`
    CREATE VIRTUAL TABLE test_fts USING fts5(title, content);
  `);
  
  db.run('INSERT INTO test_fts (title, content) VALUES (?, ?)',
    ['Doc A', 'runtime runtime runtime']);
  db.run('INSERT INTO test_fts (title, content) VALUES (?, ?)',
    ['Doc B', 'runtime']);
  db.run('INSERT INTO test_fts (title, content) VALUES (?, ?)',
    ['Doc C', 'something else entirely']);
  
  const results = db.query(`
    SELECT title, bm25(test_fts) as score 
    FROM test_fts 
    WHERE test_fts MATCH ? 
    ORDER BY score
  `).all('runtime') as { title: string; score: number }[];
  
  expect(results).toHaveLength(2);
  expect(results[0]!.title).toBe('Doc A');
});

test('FTS5 snippet extraction works', () => {
  const db = new Database(':memory:');
  
  db.exec(`CREATE VIRTUAL TABLE test_fts USING fts5(title, content);`);
  
  db.run('INSERT INTO test_fts (title, content) VALUES (?, ?)',
    ['Long Doc', 'This is a very long document about JavaScript runtime performance and optimization techniques for modern web applications.']);
  
  const results = db.query(`
    SELECT snippet(test_fts, 1, '>', '<', '...', 10) as snippet
    FROM test_fts
    WHERE test_fts MATCH ?
  `).all('JavaScript') as { snippet: string }[];
  
  expect(results).toHaveLength(1);
  expect(results[0]!.snippet).toContain('>JavaScript<');
});

test('empty content is handled gracefully', () => {
  const db = new Database(':memory:');
  
  db.exec(`CREATE VIRTUAL TABLE test_fts USING fts5(title, content);`);
  
  db.run('INSERT INTO test_fts (title, content) VALUES (?, ?)', ['Empty', '']);
  
  const results = db.query('SELECT * FROM test_fts WHERE test_fts MATCH ?').all('anything');
  
  expect(results).toHaveLength(0);
});

test('special characters in query are handled', () => {
  const db = new Database(':memory:');
  
  db.exec(`CREATE VIRTUAL TABLE test_fts USING fts5(title, content);`);
  
  db.run('INSERT INTO test_fts (title, content) VALUES (?, ?)',
    ['Code', 'function test() { return true; }']);
  
  const safeQuery = (q: string) => {
    try {
      return db.query('SELECT * FROM test_fts WHERE test_fts MATCH ?').all(q);
    } catch {
      return [];
    }
  };
  
  expect(safeQuery('function')).toHaveLength(1);
  expect(safeQuery('"function test"')).toHaveLength(1);
  expect(safeQuery('{')).toHaveLength(0);
});
