import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { Model } from './api';

export interface HistoryEntry {
  ts: number;
  q: string;
  m: Model;
  a: string;
  citations?: string[];
}

const HISTORY_DIR = join(homedir(), '.pplx');
const HISTORY_PATH = join(HISTORY_DIR, 'history.jsonl');
const MAX_ENTRIES = 1000;
const MAX_ANSWER_LENGTH = 2000;

async function ensureDir(): Promise<void> {
  const dir = Bun.file(HISTORY_DIR);
  if (!(await dir.exists())) {
    await mkdir(HISTORY_DIR, { recursive: true });
  }
}

export async function appendHistory(entry: Omit<HistoryEntry, 'ts'>): Promise<void> {
  await ensureDir();
  
  const file = Bun.file(HISTORY_PATH);
  const exists = await file.exists();
  
  if (exists) {
    const text = await file.text();
    const lines = text.trim().split('\n').filter(l => l.length > 0);
    if (lines.length >= MAX_ENTRIES) {
      const keep = lines.slice(-MAX_ENTRIES + 1).join('\n') + '\n';
      await Bun.write(HISTORY_PATH, keep);
    }
  }
  
  const record: HistoryEntry = {
    ts: Date.now(),
    q: entry.q,
    m: entry.m,
    a: entry.a.slice(0, MAX_ANSWER_LENGTH),
    ...(entry.citations?.length ? { citations: entry.citations } : {}),
  };
  
  const line = JSON.stringify(record) + '\n';
  
  if (exists) {
    const current = await Bun.file(HISTORY_PATH).text();
    await Bun.write(HISTORY_PATH, current + line);
  } else {
    await Bun.write(HISTORY_PATH, line);
  }
}

export async function readHistory(limit = 20): Promise<HistoryEntry[]> {
  const file = Bun.file(HISTORY_PATH);
  if (!(await file.exists())) return [];
  
  const text = await file.text();
  const lines = text.trim().split('\n').filter(l => l.length > 0);
  
  return lines
    .map(line => {
      try {
        return JSON.parse(line) as HistoryEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is HistoryEntry => e !== null)
    .reverse()
    .slice(0, limit);
}

export async function getLastEntry(): Promise<HistoryEntry | null> {
  const entries = await readHistory(1);
  return entries[0] ?? null;
}

export async function clearHistory(): Promise<void> {
  const file = Bun.file(HISTORY_PATH);
  if (await file.exists()) {
    await Bun.write(HISTORY_PATH, '');
  }
}
