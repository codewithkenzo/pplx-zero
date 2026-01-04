import { test, expect, beforeEach, afterAll } from 'bun:test';
import { appendHistory, readHistory, getLastEntry, clearHistory } from '../src/history';

beforeEach(async () => {
  await clearHistory();
});

afterAll(async () => {
  await clearHistory();
});

test('appendHistory creates entry', async () => {
  await appendHistory({ q: 'test query', m: 'sonar', a: 'test answer' });
  const entries = await readHistory();
  expect(entries.length).toBe(1);
  expect(entries[0]!.q).toBe('test query');
  expect(entries[0]!.m).toBe('sonar');
  expect(entries[0]!.a).toBe('test answer');
  expect(entries[0]!.ts).toBeGreaterThan(0);
});

test('readHistory returns entries in reverse order', async () => {
  await appendHistory({ q: 'first', m: 'sonar', a: 'a1' });
  await appendHistory({ q: 'second', m: 'sonar-pro', a: 'a2' });
  await appendHistory({ q: 'third', m: 'sonar', a: 'a3' });
  
  const entries = await readHistory();
  expect(entries.length).toBe(3);
  expect(entries[0]!.q).toBe('third');
  expect(entries[1]!.q).toBe('second');
  expect(entries[2]!.q).toBe('first');
});

test('readHistory respects limit', async () => {
  await appendHistory({ q: 'one', m: 'sonar', a: 'a' });
  await appendHistory({ q: 'two', m: 'sonar', a: 'a' });
  await appendHistory({ q: 'three', m: 'sonar', a: 'a' });
  
  const entries = await readHistory(2);
  expect(entries.length).toBe(2);
  expect(entries[0]!.q).toBe('three');
  expect(entries[1]!.q).toBe('two');
});

test('getLastEntry returns most recent', async () => {
  await appendHistory({ q: 'old', m: 'sonar', a: 'old answer' });
  await appendHistory({ q: 'new', m: 'sonar-pro', a: 'new answer' });
  
  const last = await getLastEntry();
  expect(last?.q).toBe('new');
  expect(last?.m).toBe('sonar-pro');
});

test('getLastEntry returns null when empty', async () => {
  const last = await getLastEntry();
  expect(last).toBeNull();
});

test('clearHistory removes all entries', async () => {
  await appendHistory({ q: 'test', m: 'sonar', a: 'answer' });
  await clearHistory();
  const entries = await readHistory();
  expect(entries.length).toBe(0);
});

test('appendHistory stores citations', async () => {
  await appendHistory({ 
    q: 'query', 
    m: 'sonar', 
    a: 'answer',
    citations: ['https://example.com', 'https://test.com']
  });
  
  const entries = await readHistory();
  expect(entries[0]!.citations).toEqual(['https://example.com', 'https://test.com']);
});

test('appendHistory truncates long answers', async () => {
  const longAnswer = 'x'.repeat(3000);
  await appendHistory({ q: 'query', m: 'sonar', a: longAnswer });
  
  const entries = await readHistory();
  expect(entries[0]!.a.length).toBe(2000);
});

test('appendHistory performance at scale (100 entries)', async () => {
  const start = Date.now();
  
  for (let i = 0; i < 100; i++) {
    await appendHistory({ q: `query ${i}`, m: 'sonar', a: `answer ${i}` });
  }
  
  const elapsed = Date.now() - start;
  
  // Should complete in under 2 seconds (O(1) append is fast)
  expect(elapsed).toBeLessThan(2000);
  
  // Verify all entries exist
  const entries = await readHistory(100);
  expect(entries.length).toBe(100);
  expect(entries[0]!.q).toBe('query 99');
});
