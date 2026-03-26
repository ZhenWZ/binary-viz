/**
 * Binary Decoder Utility
 * Decodes raw binary data from PyTorch/NumPy dumps into typed arrays
 * with support for all common numeric dtypes.
 */

export type DType =
  | 'float16'
  | 'bfloat16'
  | 'float32'
  | 'float64'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'uint64'
  | 'bool';

export type ByteOrder = 'little' | 'big';

export interface DTypeInfo {
  name: string;
  bytes: number;
  description: string;
  category: 'float' | 'int' | 'uint' | 'bool';
}

export const DTYPE_INFO: Record<DType, DTypeInfo> = {
  float16: { name: 'float16', bytes: 2, description: 'IEEE 754 half-precision', category: 'float' },
  bfloat16: { name: 'bfloat16', bytes: 2, description: 'Brain floating point', category: 'float' },
  float32: { name: 'float32', bytes: 4, description: 'IEEE 754 single-precision', category: 'float' },
  float64: { name: 'float64', bytes: 8, description: 'IEEE 754 double-precision', category: 'float' },
  int8: { name: 'int8', bytes: 1, description: '8-bit signed integer', category: 'int' },
  int16: { name: 'int16', bytes: 2, description: '16-bit signed integer', category: 'int' },
  int32: { name: 'int32', bytes: 4, description: '32-bit signed integer', category: 'int' },
  int64: { name: 'int64', bytes: 8, description: '64-bit signed integer', category: 'int' },
  uint8: { name: 'uint8', bytes: 1, description: '8-bit unsigned integer', category: 'uint' },
  uint16: { name: 'uint16', bytes: 2, description: '16-bit unsigned integer', category: 'uint' },
  uint32: { name: 'uint32', bytes: 4, description: '32-bit unsigned integer', category: 'uint' },
  uint64: { name: 'uint64', bytes: 8, description: '64-bit unsigned integer', category: 'uint' },
  bool: { name: 'bool', bytes: 1, description: 'Boolean (0 or 1)', category: 'bool' },
};

/**
 * Decode float16 (IEEE 754 half-precision) from two bytes
 */
function decodeFloat16(b0: number, b1: number, littleEndian: boolean): number {
  const val = littleEndian ? (b1 << 8) | b0 : (b0 << 8) | b1;
  const sign = (val >> 15) & 1;
  const exp = (val >> 10) & 0x1f;
  const frac = val & 0x3ff;

  if (exp === 0) {
    if (frac === 0) return sign ? -0 : 0;
    // subnormal
    return (sign ? -1 : 1) * Math.pow(2, -14) * (frac / 1024);
  }
  if (exp === 0x1f) {
    return frac ? NaN : (sign ? -Infinity : Infinity);
  }
  return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + frac / 1024);
}

/**
 * Decode bfloat16 (Brain floating point) from two bytes
 */
function decodeBFloat16(b0: number, b1: number, littleEndian: boolean): number {
  const val = littleEndian ? (b1 << 8) | b0 : (b0 << 8) | b1;
  // bfloat16 is the upper 16 bits of float32
  const asFloat32Bits = val << 16;
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, asFloat32Bits, false);
  return new DataView(buf).getFloat32(0, false);
}

export interface DecodedData {
  values: number[];
  rawBytes: Uint8Array;
  dtype: DType;
  byteOrder: ByteOrder;
  elementCount: number;
  totalBytes: number;
  bytesPerElement: number;
}

/**
 * Decode a binary buffer into an array of numbers based on dtype
 */
export function decodeBinary(
  buffer: ArrayBuffer,
  dtype: DType,
  byteOrder: ByteOrder = 'little',
  offset: number = 0,
  count?: number
): DecodedData {
  const info = DTYPE_INFO[dtype];
  const bytes = new Uint8Array(buffer);
  const dataView = new DataView(buffer);
  const littleEndian = byteOrder === 'little';

  const availableBytes = buffer.byteLength - offset;
  const maxElements = Math.floor(availableBytes / info.bytes);
  const elementCount = count !== undefined ? Math.min(count, maxElements) : maxElements;

  const values: number[] = [];

  for (let i = 0; i < elementCount; i++) {
    const pos = offset + i * info.bytes;
    let value: number;

    switch (dtype) {
      case 'float16':
        value = decodeFloat16(bytes[pos], bytes[pos + 1], littleEndian);
        break;
      case 'bfloat16':
        value = decodeBFloat16(bytes[pos], bytes[pos + 1], littleEndian);
        break;
      case 'float32':
        value = dataView.getFloat32(pos, littleEndian);
        break;
      case 'float64':
        value = dataView.getFloat64(pos, littleEndian);
        break;
      case 'int8':
        value = dataView.getInt8(pos);
        break;
      case 'int16':
        value = dataView.getInt16(pos, littleEndian);
        break;
      case 'int32':
        value = dataView.getInt32(pos, littleEndian);
        break;
      case 'int64': {
        // Read as BigInt then convert (may lose precision for very large values)
        const bigVal = dataView.getBigInt64(pos, littleEndian);
        value = Number(bigVal);
        break;
      }
      case 'uint8':
        value = dataView.getUint8(pos);
        break;
      case 'uint16':
        value = dataView.getUint16(pos, littleEndian);
        break;
      case 'uint32':
        value = dataView.getUint32(pos, littleEndian);
        break;
      case 'uint64': {
        const bigUVal = dataView.getBigUint64(pos, littleEndian);
        value = Number(bigUVal);
        break;
      }
      case 'bool':
        value = bytes[pos] ? 1 : 0;
        break;
      default:
        value = 0;
    }

    values.push(value);
  }

  return {
    values,
    rawBytes: bytes,
    dtype,
    byteOrder,
    elementCount,
    totalBytes: buffer.byteLength,
    bytesPerElement: info.bytes,
  };
}

/**
 * Format a number for display based on dtype
 */
export function formatValue(value: number, dtype: DType, precision: number = 6): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '+Inf' : '-Inf';

  const info = DTYPE_INFO[dtype];
  if (info.category === 'bool') return value ? 'true' : 'false';
  if (info.category === 'int' || info.category === 'uint') return value.toString();

  // Float formatting
  if (Math.abs(value) < 0.0001 && value !== 0) {
    return value.toExponential(precision - 1);
  }
  if (Math.abs(value) >= 1e6) {
    return value.toExponential(precision - 1);
  }
  return value.toPrecision(precision);
}

/**
 * Get hex representation of bytes at a given element index
 */
export function getHexBytes(rawBytes: Uint8Array, index: number, bytesPerElement: number, offset: number = 0): string {
  const start = offset + index * bytesPerElement;
  const hexParts: string[] = [];
  for (let i = 0; i < bytesPerElement; i++) {
    if (start + i < rawBytes.length) {
      hexParts.push(rawBytes[start + i].toString(16).padStart(2, '0').toUpperCase());
    }
  }
  return hexParts.join(' ');
}

/**
 * Compare two decoded data arrays and return diff indices
 */
export function compareData(
  data1: DecodedData,
  data2: DecodedData,
  tolerance: number = 0
): { diffIndices: Set<number>; matchCount: number; diffCount: number; totalCompared: number } {
  const len = Math.min(data1.elementCount, data2.elementCount);
  const diffIndices = new Set<number>();
  let matchCount = 0;

  for (let i = 0; i < len; i++) {
    const v1 = data1.values[i];
    const v2 = data2.values[i];

    // Handle NaN comparison
    if (Number.isNaN(v1) && Number.isNaN(v2)) {
      matchCount++;
      continue;
    }
    if (Number.isNaN(v1) || Number.isNaN(v2)) {
      diffIndices.add(i);
      continue;
    }

    // Handle infinity
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) {
      if (v1 === v2) {
        matchCount++;
      } else {
        diffIndices.add(i);
      }
      continue;
    }

    if (tolerance === 0) {
      if (v1 === v2) {
        matchCount++;
      } else {
        diffIndices.add(i);
      }
    } else {
      if (Math.abs(v1 - v2) <= tolerance) {
        matchCount++;
      } else {
        diffIndices.add(i);
      }
    }
  }

  return {
    diffIndices,
    matchCount,
    diffCount: diffIndices.size,
    totalCompared: len,
  };
}

/**
 * Parse text data (from txt file) into number array
 * Supports various formats: space-separated, comma-separated, newline-separated, bracket-enclosed
 */
export function parseTxtData(text: string): number[] {
  // Remove common tensor/array wrappers
  let cleaned = text
    .replace(/^tensor\s*\(\s*/i, '')
    .replace(/\)\s*$/i, '')
    .replace(/^array\s*\(\s*/i, '')
    .replace(/\)\s*$/i, '')
    .replace(/dtype\s*=\s*[\w.]+/gi, '')
    .replace(/\[\s*/g, '')
    .replace(/\s*\]/g, '')
    .replace(/\(\s*/g, '')
    .replace(/\s*\)/g, '');

  // Split by common delimiters
  const tokens = cleaned.split(/[\s,;]+/).filter(t => t.length > 0);

  const values: number[] = [];
  for (const token of tokens) {
    const trimmed = token.trim();
    if (trimmed === '') continue;

    // Handle special float values
    if (trimmed.toLowerCase() === 'nan') {
      values.push(NaN);
    } else if (trimmed.toLowerCase() === 'inf' || trimmed.toLowerCase() === '+inf') {
      values.push(Infinity);
    } else if (trimmed.toLowerCase() === '-inf') {
      values.push(-Infinity);
    } else if (trimmed.toLowerCase() === 'true') {
      values.push(1);
    } else if (trimmed.toLowerCase() === 'false') {
      values.push(0);
    } else {
      const num = Number(trimmed);
      if (!isNaN(num) || trimmed === 'NaN') {
        values.push(num);
      }
    }
  }

  return values;
}

/**
 * Compare parsed text values with decoded binary data
 */
export function compareTxtWithBinary(
  txtValues: number[],
  binaryData: DecodedData,
  tolerance: number = 0
): {
  diffIndices: Set<number>;
  matchCount: number;
  diffCount: number;
  totalCompared: number;
  txtLength: number;
  binLength: number;
} {
  const len = Math.min(txtValues.length, binaryData.elementCount);
  const diffIndices = new Set<number>();
  let matchCount = 0;

  for (let i = 0; i < len; i++) {
    const v1 = txtValues[i];
    const v2 = binaryData.values[i];

    if (Number.isNaN(v1) && Number.isNaN(v2)) {
      matchCount++;
      continue;
    }
    if (Number.isNaN(v1) || Number.isNaN(v2)) {
      diffIndices.add(i);
      continue;
    }
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) {
      if (v1 === v2) matchCount++;
      else diffIndices.add(i);
      continue;
    }

    if (tolerance === 0) {
      if (v1 === v2) matchCount++;
      else diffIndices.add(i);
    } else {
      if (Math.abs(v1 - v2) <= tolerance) matchCount++;
      else diffIndices.add(i);
    }
  }

  return {
    diffIndices,
    matchCount,
    diffCount: diffIndices.size,
    totalCompared: len,
    txtLength: txtValues.length,
    binLength: binaryData.elementCount,
  };
}
