/**
 * Session history — metadata-only log of decode/compare operations.
 * Stored in localStorage (no binary data — just file names, dtypes, stats).
 */

import { type DType } from './binaryDecoder';

const STORAGE_KEY = 'binary-viz-history';
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  id: string;
  timestamp: number;
  mode: 'decode' | 'compare';
  // Decode-specific
  fileName?: string;
  fileSize?: number;
  // Compare-specific
  fileNameA?: string;
  fileNameB?: string;
  // Shared
  dtype: DType;
  elementCount: number;
  diffCount?: number;
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): void {
  const history = getHistory();
  const newEntry: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  };
  history.unshift(newEntry);
  if (history.length > MAX_ENTRIES) history.length = MAX_ENTRIES;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage full — silently drop
  }
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
