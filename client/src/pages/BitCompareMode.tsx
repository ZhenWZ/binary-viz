/**
 * Bit Compare Mode — compare 2+ numbers bit by bit for a chosen dtype.
 * Supports direct hex/decimal input or pre-populated entries from Compare panel.
 */

import { useState, useMemo, useCallback, useEffect, useId } from 'react';
import { Plus, X } from 'lucide-react';
import { type DType, type ByteOrder, DTYPE_INFO, decodeBinary, formatValue } from '@/lib/binaryDecoder';
import {
  hexToBytes,
  validateHex,
  valueToBytes,
  bytesToBits,
  getBitFields,
  computeBitDiffs,
} from '@/lib/bitUtils';
import DTypeSelector from '@/components/DTypeSelector';
import BitGrid from '@/components/BitGrid';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BitEntry {
  id: string;
  inputMode: 'hex' | 'decimal';
  hexInput: string;
  decimalInput: string;
  bytes: Uint8Array | null;
  error: string | null;
}

export interface BitCompareInit {
  entries: { value: number; bytes: Uint8Array }[];
  dtype: DType;
  byteOrder: ByteOrder;
}

interface BitCompareModeProps {
  init?: BitCompareInit | null;
  onInitConsumed?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let nextId = 0;
function makeId(): string {
  return `entry-${++nextId}`;
}

function emptyEntry(): BitEntry {
  return { id: makeId(), inputMode: 'hex', hexInput: '', decimalInput: '', bytes: null, error: 'Enter a hex value' };
}

const MAX_ENTRIES = 8;

// ─── Component ──────────────────────────────────────────────────────────────

export default function BitCompareMode({ init, onInitConsumed }: BitCompareModeProps) {
  const [entries, setEntries] = useState<BitEntry[]>([emptyEntry(), emptyEntry()]);
  const [dtype, setDtype] = useState<DType>('float32');
  const [byteOrder, setByteOrder] = useState<ByteOrder>('little');

  // Consume init from Compare panel
  useEffect(() => {
    if (!init) return;
    const newEntries: BitEntry[] = init.entries.map((e) => {
      const hexStr = Array.from(e.bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      return {
        id: makeId(),
        inputMode: 'hex' as const,
        hexInput: hexStr,
        decimalInput: String(e.value),
        bytes: e.bytes,
        error: null,
      };
    });
    setEntries(newEntries);
    setDtype(init.dtype);
    setByteOrder(init.byteOrder);
    onInitConsumed?.();
  }, [init, onInitConsumed]);

  // Parse/validate entries when dtype or byteOrder changes
  const processEntry = useCallback((entry: BitEntry, dt: DType, bo: ByteOrder): BitEntry => {
    if (entry.inputMode === 'hex') {
      const raw = entry.hexInput;
      const err = validateHex(raw, dt);
      if (err) return { ...entry, bytes: null, error: err };
      const bytes = hexToBytes(raw);
      return { ...entry, bytes, error: null };
    } else {
      const raw = entry.decimalInput.trim();
      if (!raw) return { ...entry, bytes: null, error: 'Enter a value' };
      let num: number;
      if (/^nan$/i.test(raw)) num = NaN;
      else if (/^\+?inf(inity)?$/i.test(raw)) num = Infinity;
      else if (/^-inf(inity)?$/i.test(raw)) num = -Infinity;
      else {
        num = Number(raw);
        if (isNaN(num)) return { ...entry, bytes: null, error: 'Invalid number' };
      }
      try {
        const bytes = valueToBytes(num, dt, bo);
        return { ...entry, bytes, error: null };
      } catch {
        return { ...entry, bytes: null, error: 'Cannot encode value' };
      }
    }
  }, []);

  // Reprocess all entries when dtype/byteOrder changes
  useEffect(() => {
    setEntries(prev => prev.map(e => processEntry(e, dtype, byteOrder)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dtype, byteOrder]);

  const updateEntry = useCallback((id: string, patch: Partial<BitEntry>) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      const updated = { ...e, ...patch };
      return processEntry(updated, dtype, byteOrder);
    }));
  }, [dtype, byteOrder, processEntry]);

  const addEntry = useCallback(() => {
    if (entries.length >= MAX_ENTRIES) return;
    setEntries(prev => [...prev, emptyEntry()]);
  }, [entries.length]);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.length <= 2 ? prev : prev.filter(e => e.id !== id));
  }, []);

  // ─── Computed Bit Data ──────────────────────────────────────────────────

  // For non-hifloat8 dtypes, shared fields; for hifloat8, computed per-entry
  const sharedFields = useMemo(() => dtype !== 'hifloat8' ? getBitFields(dtype) : null, [dtype]);

  const bitData = useMemo(() => {
    return entries.map((entry) => {
      if (!entry.bytes || entry.error) return null;
      const bits = bytesToBits(entry.bytes, byteOrder);
      const decoded = decodeBinary(entry.bytes.buffer, dtype, byteOrder);
      const val = decoded.values[0];
      const decodedStr = formatValue(val, dtype, 8);
      const hexStr = Array.from(entry.bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      // Per-entry fields for hifloat8
      const fields = dtype === 'hifloat8'
        ? getBitFields('hifloat8', entry.bytes[0])
        : sharedFields!;
      return { bits, decodedValue: decodedStr, hexValue: hexStr, fields };
    });
  }, [entries, dtype, byteOrder, sharedFields]);

  const validBitStrings = bitData.filter((d): d is NonNullable<typeof d> => d !== null).map(d => d.bits);
  const diffIndices = useMemo(() => computeBitDiffs(validBitStrings), [validBitStrings]);

  const totalBits = DTYPE_INFO[dtype].bytes * 8;
  const diffCount = diffIndices.size;
  const validCount = validBitStrings.length;

  // ─── Hamming distances ──────────────────────────────────────────────────

  const hammingPairs = useMemo(() => {
    if (validCount < 2) return [];
    const pairs: { a: number; b: number; distance: number }[] = [];
    for (let i = 0; i < validBitStrings.length; i++) {
      for (let j = i + 1; j < validBitStrings.length; j++) {
        let dist = 0;
        for (let k = 0; k < validBitStrings[i].length; k++) {
          if (validBitStrings[i][k] !== validBitStrings[j][k]) dist++;
        }
        pairs.push({ a: i, b: j, distance: dist });
      }
    }
    return pairs;
  }, [validBitStrings, validCount]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto">
      {/* Controls */}
      <div className="shrink-0 bg-card/60 rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-end gap-4 flex-wrap">
          <DTypeSelector
            dtype={dtype}
            byteOrder={byteOrder}
            onDTypeChange={setDtype}
            onByteOrderChange={setByteOrder}
            compact
          />
          <button
            onClick={addEntry}
            disabled={entries.length >= MAX_ENTRIES}
            className="h-9 px-3 text-xs rounded-md bg-secondary/50 border border-border text-foreground hover:bg-secondary/80 disabled:opacity-30 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Entry Inputs */}
      <div className="shrink-0 space-y-2">
        {entries.map((entry, idx) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 bg-card/40 rounded-lg border border-border/50 px-3 py-2"
          >
            {/* Label */}
            <span className="text-[11px] text-muted-foreground font-medium w-6 shrink-0 text-right">
              #{idx + 1}
            </span>

            {/* Input mode toggle */}
            <div className="flex rounded-md border border-border/50 overflow-hidden shrink-0">
              <button
                className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                  entry.inputMode === 'hex'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                }`}
                onClick={() => updateEntry(entry.id, { inputMode: 'hex' })}
              >
                Hex
              </button>
              <button
                className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                  entry.inputMode === 'decimal'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-secondary/30 text-muted-foreground hover:bg-secondary/50'
                }`}
                onClick={() => updateEntry(entry.id, { inputMode: 'decimal' })}
              >
                Dec
              </button>
            </div>

            {/* Input */}
            <input
              type="text"
              value={entry.inputMode === 'hex' ? entry.hexInput : entry.decimalInput}
              onChange={(e) =>
                updateEntry(entry.id, entry.inputMode === 'hex'
                  ? { hexInput: e.target.value }
                  : { decimalInput: e.target.value }
                )
              }
              placeholder={entry.inputMode === 'hex'
                ? `e.g. ${'FF'.repeat(DTYPE_INFO[dtype].bytes)}`
                : 'e.g. 1.0'
              }
              className={`
                flex-1 h-8 px-3 rounded-md border text-sm font-mono
                bg-secondary/30 text-foreground outline-none
                focus:ring-1 focus:ring-ring transition-colors
                placeholder:text-muted-foreground/40
                ${entry.error && (entry.hexInput || entry.decimalInput) ? 'border-rose-500/40' : 'border-border/50'}
              `}
            />

            {/* Error */}
            {entry.error && (entry.hexInput || entry.decimalInput) && (
              <span className="text-[10px] text-rose-400 shrink-0 max-w-[180px] truncate">
                {entry.error}
              </span>
            )}

            {/* Remove */}
            <button
              onClick={() => removeEntry(entry.id)}
              disabled={entries.length <= 2}
              className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-20"
              title="Remove entry"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>

      {/* Bit Visualization */}
      {validCount >= 2 && (
        <div className="bg-card/60 rounded-xl border border-border p-4 space-y-1 overflow-x-auto">
          {/* Visualization header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-foreground">Bit Comparison</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground font-mono">
                {totalBits} bits
              </span>
              {diffCount > 0 ? (
                <span className="text-[11px] text-rose-400 font-mono px-1.5 py-0.5 rounded bg-rose-500/10">
                  {diffCount} bit{diffCount !== 1 ? 's' : ''} differ ({((diffCount / totalBits) * 100).toFixed(1)}%)
                </span>
              ) : (
                <span className="text-[11px] text-emerald-400 font-mono px-1.5 py-0.5 rounded bg-emerald-500/10">
                  Identical
                </span>
              )}
            </div>
          </div>

          {/* Bit grids */}
          <div className="space-y-0.5">
            {entries.map((entry, idx) => {
              const data = bitData[idx];
              if (!data) return null;
              const isHiFloat8 = dtype === 'hifloat8';
              return (
                <BitGrid
                  key={entry.id}
                  bits={data.bits}
                  fields={data.fields}
                  diffIndices={diffIndices}
                  hexValue={data.hexValue}
                  decodedValue={data.decodedValue}
                  dtype={dtype}
                  label={`#${idx + 1}`}
                  showFieldLabels={isHiFloat8 ? true : idx === 0}
                />
              );
            })}
          </div>

          {/* Field legend */}
          {(() => {
            const legendFields = dtype === 'hifloat8'
              ? [
                  { name: 'S', color: 'amber' },
                  { name: 'Dot', color: 'violet' },
                  { name: 'Exp', color: 'sky' },
                  { name: 'Mant', color: 'emerald' },
                ]
              : (sharedFields ?? []).map((f) => ({ name: f.name, color: f.color }));
            return legendFields.length > 0 && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
                <span className="text-[10px] text-muted-foreground">Fields:</span>
                {legendFields.map((f) => (
                  <span
                    key={f.name}
                    className={`text-[10px] font-medium text-${f.color}-400`}
                  >
                    {f.name}
                  </span>
                ))}
                {dtype === 'hifloat8' && (
                  <span className="text-[10px] text-muted-foreground/50 italic ml-1">
                    (field widths vary per value)
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Hamming Distance Summary */}
      {hammingPairs.length > 0 && (
        <div className="shrink-0 bg-card/60 rounded-xl border border-border p-4">
          <span className="text-xs font-semibold text-foreground block mb-2">Hamming Distance</span>
          <div className="flex flex-wrap gap-3">
            {hammingPairs.map(({ a, b, distance }) => (
              <div
                key={`${a}-${b}`}
                className="flex items-center gap-2 text-[11px] font-mono bg-secondary/30 rounded-md px-2.5 py-1.5 border border-border/30"
              >
                <span className="text-muted-foreground">#{a + 1} ↔ #{b + 1}</span>
                <span className={distance > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                  {distance}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {validCount < 2 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Enter at least 2 valid values to compare bits
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Use hex bytes (e.g. 3F800000 for float32 1.0) or decimal values
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
