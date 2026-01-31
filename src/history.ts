import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, appendFile } from 'node:fs/promises';
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
const MAX_ENTRIES_TO_KEEP = 500;
const ROTATION_SIZE_THRESHOLD = 512 * 1024; // 512KB
const MAX_ANSWER_LENGTH = 2000;

let appendCount = 0;

async function ensureDir(): Promise<void> {
  const dir = Bun.file(HISTORY_DIR);
  if (!(await dir.exists())) {
    await mkdir(HISTORY_DIR, { recursive: true });
  }
}

export async function maybeRotateHistory(): Promise<void> {
  const file = Bun.file(HISTORY_PATH);
  if (!(await file.exists()) || file.size < ROTATION_SIZE_THRESHOLD) return;

  const text = await file.text();
  const lines = text.trim().split('\n').filter(l => l.length > 0);

  if (lines.length > MAX_ENTRIES_TO_KEEP) {
    const keep = lines.slice(-MAX_ENTRIES_TO_KEEP).join('\n') + '\n';
    await Bun.write(HISTORY_PATH, keep);
  }
}

export async function appendHistory(entry: Omit<HistoryEntry, 'ts'>): Promise<void> {
  await ensureDir();

  if (appendCount % 10 === 0) {
    await maybeRotateHistory();
  }
  appendCount++;

  const record: HistoryEntry = {
    ts: Date.now(),
    q: entry.q,
    m: entry.m,
    a: entry.a.slice(0, MAX_ANSWER_LENGTH),
    ...(entry.citations?.length ? { citations: entry.citations } : {}),
  };

  const line = JSON.stringify(record) + '\n';
  await appendFile(HISTORY_PATH, line);
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
