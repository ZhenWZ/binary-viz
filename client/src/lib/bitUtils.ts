/**
 * Bit-level utilities for the Bit Compare feature.
 * Handles hex/decimal ↔ bytes conversion, bit string generation,
 * bit field annotations, and bit-level diff computation.
 */

import { type DType, type ByteOrder, DTYPE_INFO, decodeBinary } from './binaryDecoder';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BitField {
  name: string;
  start: number; // inclusive, 0 = MSB
  end: number;   // exclusive
  color: string; // tailwind color token (e.g. 'amber', 'sky', 'emerald')
}

// ─── Hex ↔ Bytes ────────────────────────────────────────────────────────────

/** Parse a hex string (e.g. "3F800000") into a Uint8Array. Strips 0x prefix and spaces. */
export function hexToBytes(hex: string): Uint8Array {
  let cleaned = hex.replace(/\s+/g, '').replace(/^0x/i, '');
  if (cleaned.length % 2 !== 0) cleaned = '0' + cleaned;
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Validate a hex string for a given dtype. Returns error message or null. */
export function validateHex(hex: string, dtype: DType): string | null {
  const cleaned = hex.replace(/\s+/g, '').replace(/^0x/i, '');
  if (cleaned.length === 0) return 'Enter a hex value';
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) return 'Invalid hex characters';
  const expectedLen = DTYPE_INFO[dtype].bytes * 2;
  if (cleaned.length !== expectedLen) return `Expected ${expectedLen} hex digits for ${dtype}`;
  return null;
}

// ─── Value → Bytes ──────────────────────────────────────────────────────────

/**
 * Encode a numeric value to its byte representation for a given dtype.
 * For standard types, uses DataView. For FP8/HiFloat8, uses reverse decode matching.
 */
export function valueToBytes(value: number, dtype: DType, byteOrder: ByteOrder): Uint8Array {
  const numBytes = DTYPE_INFO[dtype].bytes;
  const buf = new ArrayBuffer(numBytes);
  const dv = new DataView(buf);
  const le = byteOrder === 'little';

  switch (dtype) {
    case 'float32':
      dv.setFloat32(0, value, le);
      break;
    case 'float64':
      dv.setFloat64(0, value, le);
      break;
    case 'float16':
      dv.setUint16(0, encodeFloat16(value), le);
      break;
    case 'bfloat16':
      dv.setUint16(0, encodeBFloat16(value), le);
      break;
    case 'int8':
      dv.setInt8(0, value);
      break;
    case 'int16':
      dv.setInt16(0, value, le);
      break;
    case 'int32':
      dv.setInt32(0, value, le);
      break;
    case 'int64':
      dv.setBigInt64(0, BigInt(Math.trunc(value)), le);
      break;
    case 'uint8':
      dv.setUint8(0, value);
      break;
    case 'uint16':
      dv.setUint16(0, value, le);
      break;
    case 'uint32':
      dv.setUint32(0, value, le);
      break;
    case 'uint64':
      dv.setBigUint64(0, BigInt(Math.trunc(value)), le);
      break;
    case 'bool':
      dv.setUint8(0, value ? 1 : 0);
      break;
    case 'float8_e4m3':
    case 'float8_e5m2':
    case 'float8_e8m0':
    case 'hifloat8':
      // Reverse lookup: find the byte that decodes closest to the target value
      dv.setUint8(0, findClosestByte(value, dtype, byteOrder));
      break;
  }

  return new Uint8Array(buf);
}

/** Find the byte (0-255) whose decoded value is closest to the target for a float8 dtype. */
function findClosestByte(target: number, dtype: DType, byteOrder: ByteOrder): number {
  if (Number.isNaN(target)) {
    // Return canonical NaN byte for each format
    switch (dtype) {
      case 'float8_e4m3': return 0x7F;
      case 'float8_e5m2': return 0x7E;
      case 'float8_e8m0': return 0xFF;
      case 'hifloat8': return 0x80;
      default: return 0;
    }
  }

  let bestByte = 0;
  let bestDist = Infinity;

  for (let b = 0; b < 256; b++) {
    const decoded = decodeBinary(new Uint8Array([b]).buffer, dtype, byteOrder).values[0];
    if (Number.isNaN(decoded)) continue;

    if (target === Infinity && decoded === Infinity) return b;
    if (target === -Infinity && decoded === -Infinity) return b;

    const dist = Math.abs(decoded - target);
    if (dist < bestDist) {
      bestDist = dist;
      bestByte = b;
    }
  }
  return bestByte;
}

/** Encode float16 value to uint16 bits. */
function encodeFloat16(value: number): number {
  if (Number.isNaN(value)) return 0x7E00;
  if (!Number.isFinite(value)) return value > 0 ? 0x7C00 : 0xFC00;
  if (value === 0) return Object.is(value, -0) ? 0x8000 : 0;

  // Convert via float32 intermediary
  const f32 = new Float32Array([value]);
  const u32 = new Uint32Array(f32.buffer)[0];
  const sign = (u32 >> 16) & 0x8000;
  const expBits = ((u32 >> 23) & 0xFF) - 127 + 15;
  const frac = (u32 >> 13) & 0x3FF;

  if (expBits <= 0) {
    // Subnormal or zero
    const shift = 1 - expBits;
    if (shift > 10) return sign;
    return sign | ((0x400 | frac) >> shift);
  }
  if (expBits >= 0x1F) return sign | 0x7C00; // Overflow → Inf
  return sign | (expBits << 10) | frac;
}

/** Encode bfloat16 value to uint16 bits. */
function encodeBFloat16(value: number): number {
  const f32 = new Float32Array([value]);
  const u32 = new Uint32Array(f32.buffer)[0];
  return u32 >>> 16; // Truncate lower 16 bits of float32
}

// ─── Bytes → Bit String ─────────────────────────────────────────────────────

/**
 * Convert bytes to a bit string (MSB first for display).
 * For little-endian multi-byte types, reverses byte order so the MSB is on the left.
 */
export function bytesToBits(bytes: Uint8Array, byteOrder: ByteOrder): string {
  // For display: we want MSB on the left. Little-endian stores LSB first,
  // so we reverse the bytes for display.
  const ordered = byteOrder === 'little' && bytes.length > 1
    ? new Uint8Array([...bytes].reverse())
    : bytes;

  let bits = '';
  for (const byte of ordered) {
    bits += byte.toString(2).padStart(8, '0');
  }
  return bits;
}

// ─── Bit Field Annotations ──────────────────────────────────────────────────

/** Return bit field layout for a given dtype (MSB-first indexing). */
export function getBitFields(dtype: DType): BitField[] {
  const totalBits = DTYPE_INFO[dtype].bytes * 8;

  switch (dtype) {
    case 'float8_e4m3':
      return [
        { name: 'S', start: 0, end: 1, color: 'amber' },
        { name: 'Exp', start: 1, end: 5, color: 'sky' },
        { name: 'Mant', start: 5, end: 8, color: 'emerald' },
      ];
    case 'float8_e5m2':
      return [
        { name: 'S', start: 0, end: 1, color: 'amber' },
        { name: 'Exp', start: 1, end: 6, color: 'sky' },
        { name: 'Mant', start: 6, end: 8, color: 'emerald' },
      ];
    case 'float8_e8m0':
      return [
        { name: 'Exp', start: 0, end: 8, color: 'sky' },
      ];
    case 'hifloat8':
      // Variable-width fields — show sign + remaining as "Dot+Exp+Mant"
      return [
        { name: 'S', start: 0, end: 1, color: 'amber' },
        { name: 'Dot+Exp+Mant', start: 1, end: 8, color: 'violet' },
      ];
    case 'float16':
      return [
        { name: 'S', start: 0, end: 1, color: 'amber' },
        { name: 'Exp', start: 1, end: 6, color: 'sky' },
        { name: 'Mant', start: 6, end: 16, color: 'emerald' },
      ];
    case 'bfloat16':
      return [
        { name: 'S', start: 0, end: 1, color: 'amber' },
        { name: 'Exp', start: 1, end: 9, color: 'sky' },
        { name: 'Mant', start: 9, end: 16, color: 'emerald' },
      ];
    case 'float32':
      return [
        { name: 'S', start: 0, end: 1, color: 'amber' },
        { name: 'Exp', start: 1, end: 9, color: 'sky' },
        { name: 'Mant', start: 9, end: 32, color: 'emerald' },
      ];
    case 'float64':
      return [
        { name: 'S', start: 0, end: 1, color: 'amber' },
        { name: 'Exp', start: 1, end: 12, color: 'sky' },
        { name: 'Mant', start: 12, end: 64, color: 'emerald' },
      ];
    default: {
      // Integer/uint/bool types: show byte boundaries
      const fields: BitField[] = [];
      const numBytes = totalBits / 8;
      for (let i = 0; i < numBytes; i++) {
        fields.push({
          name: `Byte ${numBytes - 1 - i}`,
          start: i * 8,
          end: (i + 1) * 8,
          color: i % 2 === 0 ? 'slate' : 'zinc',
        });
      }
      return fields;
    }
  }
}

// ─── Bit Diff ───────────────────────────────────────────────────────────────

/** Compute which bit positions differ across multiple bit strings. */
export function computeBitDiffs(bitStrings: string[]): Set<number> {
  if (bitStrings.length < 2) return new Set();

  const len = bitStrings[0].length;
  const diffs = new Set<number>();

  for (let i = 0; i < len; i++) {
    const ch = bitStrings[0][i];
    for (let j = 1; j < bitStrings.length; j++) {
      if (bitStrings[j][i] !== ch) {
        diffs.add(i);
        break;
      }
    }
  }

  return diffs;
}
