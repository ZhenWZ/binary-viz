import { describe, it, expect } from 'vitest';
import {
  decodeBinary,
  detectFormat,
  formatValue,
  getHexBytes,
  formatBytes,
  compareValues,
  compareData,
  parseTxtData,
  autoDecodeBinary,
  autoDecodeBinaryAsync,
  DTYPE_INFO,
  type DType,
  type DecodedData,
} from './binaryDecoder';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create an ArrayBuffer from a Float32Array (little-endian) */
function float32Buffer(values: number[]): ArrayBuffer {
  return new Float32Array(values).buffer;
}

/** Create an ArrayBuffer from a Float64Array (little-endian) */
function float64Buffer(values: number[]): ArrayBuffer {
  return new Float64Array(values).buffer;
}

/** Create an ArrayBuffer from typed values using DataView */
function makeBuffer(
  setter: (dv: DataView, offset: number, value: number, le: boolean) => void,
  values: number[],
  bytesPerElement: number,
  littleEndian = true
): ArrayBuffer {
  const buf = new ArrayBuffer(values.length * bytesPerElement);
  const dv = new DataView(buf);
  values.forEach((v, i) => setter(dv, i * bytesPerElement, v, littleEndian));
  return buf;
}

/** Create a BigInt64 buffer */
function bigInt64Buffer(values: bigint[], littleEndian = true): ArrayBuffer {
  const buf = new ArrayBuffer(values.length * 8);
  const dv = new DataView(buf);
  values.forEach((v, i) => dv.setBigInt64(i * 8, v, littleEndian));
  return buf;
}

/** Create a BigUint64 buffer */
function bigUint64Buffer(values: bigint[], littleEndian = true): ArrayBuffer {
  const buf = new ArrayBuffer(values.length * 8);
  const dv = new DataView(buf);
  values.forEach((v, i) => dv.setBigUint64(i * 8, v, littleEndian));
  return buf;
}

/** Build a minimal NumPy .npy buffer */
function buildNpyBuffer(dtype: string, shape: number[], data: ArrayBuffer): ArrayBuffer {
  const header = `{'descr': '${dtype}', 'fortran_order': False, 'shape': (${shape.join(', ')}${shape.length === 1 ? ',' : ''}), }`;
  // Pad header to align to 64 bytes
  const headerLen = header.length;
  const padded = headerLen + 10; // magic(6) + version(2) + headerLen(2)
  const totalHeader = Math.ceil(padded / 64) * 64;
  const paddingNeeded = totalHeader - padded;
  const paddedHeader = header + ' '.repeat(paddingNeeded - 1) + '\n';

  const magic = new Uint8Array([0x93, 0x4E, 0x55, 0x4D, 0x50, 0x59]); // \x93NUMPY
  const version = new Uint8Array([1, 0]);
  const headerLenBytes = new Uint8Array(2);
  new DataView(headerLenBytes.buffer).setUint16(0, paddedHeader.length, true);

  const result = new Uint8Array(magic.length + version.length + headerLenBytes.length + paddedHeader.length + data.byteLength);
  let offset = 0;
  result.set(magic, offset); offset += magic.length;
  result.set(version, offset); offset += version.length;
  result.set(headerLenBytes, offset); offset += headerLenBytes.length;
  for (let i = 0; i < paddedHeader.length; i++) {
    result[offset + i] = paddedHeader.charCodeAt(i);
  }
  offset += paddedHeader.length;
  result.set(new Uint8Array(data), offset);

  return result.buffer;
}

// ─── decodeBinary ────────────────────────────────────────────────────────────

describe('decodeBinary', () => {
  it('decodes float32 little-endian', () => {
    const buf = float32Buffer([1.0, 2.5, -3.14]);
    const result = decodeBinary(buf, 'float32', 'little');
    expect(result.elementCount).toBe(3);
    expect(result.dtype).toBe('float32');
    expect(result.byteOrder).toBe('little');
    expect(result.values[0]).toBeCloseTo(1.0);
    expect(result.values[1]).toBeCloseTo(2.5);
    expect(result.values[2]).toBeCloseTo(-3.14, 2);
  });

  it('decodes float64', () => {
    const buf = float64Buffer([Math.PI, Math.E, 0]);
    const result = decodeBinary(buf, 'float64', 'little');
    expect(result.elementCount).toBe(3);
    expect(result.values[0]).toBeCloseTo(Math.PI, 10);
    expect(result.values[1]).toBeCloseTo(Math.E, 10);
    expect(result.values[2]).toBe(0);
  });

  it('decodes float32 big-endian', () => {
    const buf = makeBuffer(
      (dv, off, val, le) => dv.setFloat32(off, val, le),
      [1.0, -2.0],
      4,
      false // big-endian
    );
    const result = decodeBinary(buf, 'float32', 'big');
    expect(result.values[0]).toBeCloseTo(1.0);
    expect(result.values[1]).toBeCloseTo(-2.0);
  });

  it('decodes int8', () => {
    const buf = new Int8Array([0, 1, -1, 127, -128]).buffer;
    const result = decodeBinary(buf, 'int8');
    expect(result.values).toEqual([0, 1, -1, 127, -128]);
  });

  it('decodes uint8', () => {
    const buf = new Uint8Array([0, 1, 128, 255]).buffer;
    const result = decodeBinary(buf, 'uint8');
    expect(result.values).toEqual([0, 1, 128, 255]);
  });

  it('decodes int16 little-endian', () => {
    const buf = makeBuffer(
      (dv, off, val, le) => dv.setInt16(off, val, le),
      [0, 256, -1, 32767, -32768],
      2
    );
    const result = decodeBinary(buf, 'int16', 'little');
    expect(result.values).toEqual([0, 256, -1, 32767, -32768]);
  });

  it('decodes uint16', () => {
    const buf = makeBuffer(
      (dv, off, val, le) => dv.setUint16(off, val, le),
      [0, 1, 65535],
      2
    );
    const result = decodeBinary(buf, 'uint16', 'little');
    expect(result.values).toEqual([0, 1, 65535]);
  });

  it('decodes int32', () => {
    const buf = makeBuffer(
      (dv, off, val, le) => dv.setInt32(off, val, le),
      [0, 1, -1, 2147483647, -2147483648],
      4
    );
    const result = decodeBinary(buf, 'int32', 'little');
    expect(result.values).toEqual([0, 1, -1, 2147483647, -2147483648]);
  });

  it('decodes uint32', () => {
    const buf = makeBuffer(
      (dv, off, val, le) => dv.setUint32(off, val, le),
      [0, 1, 4294967295],
      4
    );
    const result = decodeBinary(buf, 'uint32', 'little');
    expect(result.values).toEqual([0, 1, 4294967295]);
  });

  it('decodes int64 with safe values', () => {
    const buf = bigInt64Buffer([0n, 1n, -1n, 42n]);
    const result = decodeBinary(buf, 'int64', 'little');
    expect(result.values).toEqual([0, 1, -1, 42]);
    expect(result.hasPrecisionLoss).toBeUndefined();
  });

  it('decodes int64 and flags precision loss for large values', () => {
    const big = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    const buf = bigInt64Buffer([big, -big]);
    const result = decodeBinary(buf, 'int64', 'little');
    expect(result.hasPrecisionLoss).toBe(true);
    expect(result.elementCount).toBe(2);
  });

  it('decodes uint64 with safe values', () => {
    const buf = bigUint64Buffer([0n, 1n, 100n]);
    const result = decodeBinary(buf, 'uint64', 'little');
    expect(result.values).toEqual([0, 1, 100]);
    expect(result.hasPrecisionLoss).toBeUndefined();
  });

  it('decodes uint64 and flags precision loss for large values', () => {
    const big = BigInt(Number.MAX_SAFE_INTEGER) + 10n;
    const buf = bigUint64Buffer([big]);
    const result = decodeBinary(buf, 'uint64', 'little');
    expect(result.hasPrecisionLoss).toBe(true);
  });

  it('decodes bool', () => {
    const buf = new Uint8Array([0, 1, 0, 255, 1]).buffer;
    const result = decodeBinary(buf, 'bool');
    expect(result.values).toEqual([0, 1, 0, 1, 1]);
  });

  it('handles empty buffer', () => {
    const buf = new ArrayBuffer(0);
    const result = decodeBinary(buf, 'float32');
    expect(result.elementCount).toBe(0);
    expect(result.values).toEqual([]);
  });

  it('respects offset parameter', () => {
    // 4 bytes padding + 2 float32 values
    const padding = new Uint8Array(4);
    const data = new Float32Array([7.0, 8.0]);
    const combined = new Uint8Array(padding.byteLength + data.byteLength);
    combined.set(padding, 0);
    combined.set(new Uint8Array(data.buffer), 4);
    const result = decodeBinary(combined.buffer, 'float32', 'little', 4);
    expect(result.elementCount).toBe(2);
    expect(result.values[0]).toBeCloseTo(7.0);
    expect(result.values[1]).toBeCloseTo(8.0);
  });

  it('respects count parameter', () => {
    const buf = float32Buffer([1, 2, 3, 4, 5]);
    const result = decodeBinary(buf, 'float32', 'little', 0, 3);
    expect(result.elementCount).toBe(3);
  });

  it('handles NaN and Infinity in float32', () => {
    const buf = float32Buffer([NaN, Infinity, -Infinity]);
    const result = decodeBinary(buf, 'float32');
    expect(Number.isNaN(result.values[0])).toBe(true);
    expect(result.values[1]).toBe(Infinity);
    expect(result.values[2]).toBe(-Infinity);
  });

  // Float8 E4M3
  it('decodes float8_e4m3 zero', () => {
    const buf = new Uint8Array([0x00]).buffer;
    const result = decodeBinary(buf, 'float8_e4m3');
    expect(result.values[0]).toBe(0);
  });

  it('decodes float8_e4m3 NaN (0x7F)', () => {
    // E4M3: exponent=0b1111, mantissa=0b111 → NaN
    const buf = new Uint8Array([0x7F]).buffer;
    const result = decodeBinary(buf, 'float8_e4m3');
    expect(Number.isNaN(result.values[0])).toBe(true);
  });

  it('decodes float8_e4m3 normal value (1.0 = 0x38)', () => {
    // E4M3: sign=0, exp=0111 (bias 7, so exp=0), mantissa=000 → 1.0
    const buf = new Uint8Array([0x38]).buffer;
    const result = decodeBinary(buf, 'float8_e4m3');
    expect(result.values[0]).toBeCloseTo(1.0, 2);
  });

  // Float8 E5M2
  it('decodes float8_e5m2 zero', () => {
    const buf = new Uint8Array([0x00]).buffer;
    const result = decodeBinary(buf, 'float8_e5m2');
    expect(result.values[0]).toBe(0);
  });

  it('decodes float8_e5m2 +Inf (0x7C)', () => {
    // E5M2: exp=0b11111, mantissa=0b00 → Inf
    const buf = new Uint8Array([0x7C]).buffer;
    const result = decodeBinary(buf, 'float8_e5m2');
    expect(result.values[0]).toBe(Infinity);
  });

  it('decodes float8_e5m2 NaN', () => {
    // E5M2: exp=0b11111, mantissa != 0 → NaN
    const buf = new Uint8Array([0x7F]).buffer;
    const result = decodeBinary(buf, 'float8_e5m2');
    expect(Number.isNaN(result.values[0])).toBe(true);
  });

  // Float8 E8M0
  it('decodes float8_e8m0 values as powers of 2', () => {
    // E8M0: value = 2^(byte - 127)
    const buf = new Uint8Array([127, 128, 126]).buffer;
    const result = decodeBinary(buf, 'float8_e8m0');
    expect(result.values[0]).toBeCloseTo(1.0); // 2^0
    expect(result.values[1]).toBeCloseTo(2.0); // 2^1
    expect(result.values[2]).toBeCloseTo(0.5); // 2^-1
  });

  // HiFloat8 (Ascend HiF8)
  it('decodes hifloat8 zero (0x00)', () => {
    const buf = new Uint8Array([0x00]).buffer;
    const result = decodeBinary(buf, 'hifloat8');
    expect(result.values[0]).toBe(0);
  });

  it('decodes hifloat8 NaN (0x80)', () => {
    const buf = new Uint8Array([0x80]).buffer;
    const result = decodeBinary(buf, 'hifloat8');
    expect(Number.isNaN(result.values[0])).toBe(true);
  });

  it('decodes hifloat8 normal 1.0 (0x08)', () => {
    // D=0 positive DML, exp=0, mant=0 → 2^0 × 1.0 = 1.0
    const buf = new Uint8Array([0x08]).buffer;
    const result = decodeBinary(buf, 'hifloat8');
    expect(result.values[0]).toBe(1.0);
  });

  it('decodes hifloat8 negative value -1.0 (0x88)', () => {
    const buf = new Uint8Array([0x88]).buffer;
    const result = decodeBinary(buf, 'hifloat8');
    expect(result.values[0]).toBe(-1.0);
  });

  it('decodes hifloat8 +Inf (0x6F)', () => {
    // D=4, exp=+15, mant=1 → ±Inf
    const buf = new Uint8Array([0x6F]).buffer;
    const result = decodeBinary(buf, 'hifloat8');
    expect(result.values[0]).toBe(Infinity);
  });

  it('decodes hifloat8 -Inf (0xEF)', () => {
    const buf = new Uint8Array([0xEF]).buffer;
    const result = decodeBinary(buf, 'hifloat8');
    expect(result.values[0]).toBe(-Infinity);
  });

  it('decodes hifloat8 denormal 2^-16 (0x01)', () => {
    // D=0 negative DML, mant=1 → 2^-(1+15) = 2^-16
    const buf = new Uint8Array([0x01]).buffer;
    const result = decodeBinary(buf, 'hifloat8');
    expect(result.values[0]).toBeCloseTo(Math.pow(2, -16), 10);
  });

  it('decodes hifloat8 various normal values', () => {
    // 0x10=2.0 (D=1, exp=+1, mant=0), 0x18=0.5 (D=1, exp=-1, mant=0)
    const buf = new Uint8Array([0x10, 0x18, 0x40, 0x60]).buffer;
    const result = decodeBinary(buf, 'hifloat8');
    expect(result.values[0]).toBe(2.0);
    expect(result.values[1]).toBe(0.5);
    expect(result.values[2]).toBe(16.0);  // D=3, exp=+4, mant=0
    expect(result.values[3]).toBe(256.0); // D=4, exp=+8, mant=0
  });

  // HiFloat8 — sign symmetry
  it('hifloat8 sign symmetry: LUT[b] == -LUT[b|0x80] for all non-special bytes', () => {
    // For bytes 1-127 (skip 0x00=zero and 0x80=NaN), the negative half should mirror
    for (let b = 1; b < 128; b++) {
      const pos = decodeBinary(new Uint8Array([b]).buffer, 'hifloat8').values[0];
      const neg = decodeBinary(new Uint8Array([b | 0x80]).buffer, 'hifloat8').values[0];
      if (Number.isNaN(pos)) {
        expect(Number.isNaN(neg)).toBe(true);
      } else {
        expect(neg).toBe(-pos);
      }
    }
  });

  // HiFloat8 — all 7 denormal values (D=0 negative DML)
  it('hifloat8 decodes all denormal values (bytes 0x01-0x07)', () => {
    const expected = [
      Math.pow(2, -16), // 0x01: mant=1, 2^-(1+15)
      Math.pow(2, -17), // 0x02: mant=2, 2^-(2+15)
      Math.pow(2, -18), // 0x03: mant=3
      Math.pow(2, -19), // 0x04: mant=4
      Math.pow(2, -20), // 0x05: mant=5
      Math.pow(2, -21), // 0x06: mant=6
      Math.pow(2, -22), // 0x07: mant=7, smallest positive value
    ];
    for (let i = 0; i < 7; i++) {
      const result = decodeBinary(new Uint8Array([i + 1]).buffer, 'hifloat8');
      expect(result.values[0]).toBeCloseTo(expected[i], 15);
    }
  });

  // HiFloat8 — D=0 positive DML (exp=0, bytes 0x08-0x0F)
  it('hifloat8 decodes all D=0 positive DML values (bytes 0x08-0x0F)', () => {
    // exp=0 → 2^0 = 1, mantissa 3-bit: value = 1 + mant/8
    const expected = [1.0, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875];
    const buf = new Uint8Array([0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F]).buffer;
    const result = decodeBinary(buf, 'hifloat8');
    for (let i = 0; i < 8; i++) {
      expect(result.values[i]).toBe(expected[i]);
    }
  });

  // HiFloat8 — D=1 region (exp=±1, 3-bit mantissa, bytes 0x10-0x1F)
  it('hifloat8 decodes D=1 boundary values', () => {
    // 0x10: D=1, exp_sign=0, exp=+1, mant=0 → 2^1 × 1.0 = 2.0
    expect(decodeBinary(new Uint8Array([0x10]).buffer, 'hifloat8').values[0]).toBe(2.0);
    // 0x17: D=1, exp_sign=0, exp=+1, mant=7 → 2^1 × (1+7/8) = 3.75
    expect(decodeBinary(new Uint8Array([0x17]).buffer, 'hifloat8').values[0]).toBe(3.75);
    // 0x18: D=1, exp_sign=1, exp=-1, mant=0 → 2^-1 × 1.0 = 0.5
    expect(decodeBinary(new Uint8Array([0x18]).buffer, 'hifloat8').values[0]).toBe(0.5);
    // 0x1F: D=1, exp_sign=1, exp=-1, mant=7 → 2^-1 × (1+7/8) = 0.9375
    expect(decodeBinary(new Uint8Array([0x1F]).buffer, 'hifloat8').values[0]).toBe(0.9375);
  });

  // HiFloat8 — D=2 region (exp=±2,±3, 3-bit mantissa, bytes 0x20-0x3F)
  it('hifloat8 decodes D=2 boundary values', () => {
    // 0x20: D=2, exp_sign=0, exp_stored=0 → exp_mag=(1<<1)|0=2, exp=+2, mant=0 → 4.0
    expect(decodeBinary(new Uint8Array([0x20]).buffer, 'hifloat8').values[0]).toBe(4.0);
    // 0x2F: D=2, exp_sign=0, exp_stored=1 → exp=+3, mant=7 → 8×(1+7/8)=15.0
    expect(decodeBinary(new Uint8Array([0x2F]).buffer, 'hifloat8').values[0]).toBe(15.0);
    // 0x30: D=2, exp_sign=1, exp_stored=0 → exp=-2, mant=0 → 0.25
    expect(decodeBinary(new Uint8Array([0x30]).buffer, 'hifloat8').values[0]).toBe(0.25);
    // 0x3F: D=2, exp_sign=1, exp_stored=1 → exp=-3, mant=7 → (1/8)×(1+7/8)=0.234375
    expect(decodeBinary(new Uint8Array([0x3F]).buffer, 'hifloat8').values[0]).toBe(0.234375);
  });

  // HiFloat8 — D=3 region (exp=±4..±7, 2-bit mantissa, bytes 0x40-0x5F)
  it('hifloat8 decodes D=3 boundary values', () => {
    // 0x40: D=3, exp_sign=0, exp_stored=00 → exp_mag=(1<<2)|0=4, exp=+4, mant=0 → 16.0
    expect(decodeBinary(new Uint8Array([0x40]).buffer, 'hifloat8').values[0]).toBe(16.0);
    // 0x4F: D=3, exp_sign=0, exp_stored=11 → exp=+7, mant=3 → 128×(1+3/4)=224.0
    expect(decodeBinary(new Uint8Array([0x4F]).buffer, 'hifloat8').values[0]).toBe(224.0);
    // 0x50: D=3, exp_sign=1, exp_stored=00 → exp=-4, mant=0 → 0.0625
    expect(decodeBinary(new Uint8Array([0x50]).buffer, 'hifloat8').values[0]).toBe(0.0625);
    // 0x5F: D=3, exp_sign=1, exp_stored=11 → exp=-7, mant=3 → (1/128)×(1+3/4)=0.013671875
    expect(decodeBinary(new Uint8Array([0x5F]).buffer, 'hifloat8').values[0]).toBe(0.013671875);
  });

  // HiFloat8 — D=4 region (exp=±8..±15, 1-bit mantissa, bytes 0x60-0x7F)
  it('hifloat8 decodes D=4 boundary values', () => {
    // 0x60: D=4, exp_sign=0, exp_stored=000 → exp_mag=(1<<3)|0=8, exp=+8, mant=0 → 256.0
    expect(decodeBinary(new Uint8Array([0x60]).buffer, 'hifloat8').values[0]).toBe(256.0);
    // 0x61: D=4, exp_sign=0, exp=+8, mant=1 → 256×1.5=384.0
    expect(decodeBinary(new Uint8Array([0x61]).buffer, 'hifloat8').values[0]).toBe(384.0);
    // 0x6E: D=4, exp_sign=0, exp=+15, mant=0 → 32768.0 (max finite positive)
    expect(decodeBinary(new Uint8Array([0x6E]).buffer, 'hifloat8').values[0]).toBe(32768.0);
    // 0x6F: D=4, exp=+15, mant=1 → +Inf
    expect(decodeBinary(new Uint8Array([0x6F]).buffer, 'hifloat8').values[0]).toBe(Infinity);
    // 0x70: D=4, exp_sign=1, exp_stored=000 → exp=-8, mant=0 → 1/256=0.00390625
    expect(decodeBinary(new Uint8Array([0x70]).buffer, 'hifloat8').values[0]).toBe(0.00390625);
    // 0x7F: D=4, exp_sign=1, exp=-15, mant=1 → 2^-15 × 1.5 = 4.57763671875e-05
    expect(decodeBinary(new Uint8Array([0x7F]).buffer, 'hifloat8').values[0]).toBeCloseTo(4.57763671875e-05, 15);
  });

  // HiFloat8 — dynamic range
  it('hifloat8 dynamic range: max finite, min positive', () => {
    // Max finite positive: 0x6E = 32768 (2^15)
    const maxFinite = decodeBinary(new Uint8Array([0x6E]).buffer, 'hifloat8').values[0];
    expect(maxFinite).toBe(32768);
    expect(Number.isFinite(maxFinite)).toBe(true);

    // Second largest: 0x6D = 24576 (2^14 × 1.5)
    expect(decodeBinary(new Uint8Array([0x6D]).buffer, 'hifloat8').values[0]).toBe(24576);

    // Min positive denormal: 0x07 = 2^-22
    const minDenormal = decodeBinary(new Uint8Array([0x07]).buffer, 'hifloat8').values[0];
    expect(minDenormal).toBeCloseTo(Math.pow(2, -22), 15);

    // Min positive normal: 0x08 = 1.0
    expect(decodeBinary(new Uint8Array([0x08]).buffer, 'hifloat8').values[0]).toBe(1.0);
  });

  // HiFloat8 — total representable values count
  it('hifloat8 has expected number of unique finite positive values', () => {
    // Decode all 128 positive bytes (0x00-0x7F), count unique finite non-zero values
    const positiveValues = new Set<number>();
    for (let b = 0; b < 128; b++) {
      const v = decodeBinary(new Uint8Array([b]).buffer, 'hifloat8').values[0];
      if (v !== 0 && Number.isFinite(v) && !Number.isNaN(v)) {
        positiveValues.add(v);
      }
    }
    // 127 non-zero bytes: 7 denormal + 8 D0+ + 16 D1 + 32 D2 + 32 D3 + 32 D4 = 127
    // But 0x6F = Inf (not finite), so 126 unique finite positive values
    expect(positiveValues.size).toBe(126);
  });

  // Float16
  it('decodes float16 values', () => {
    // float16 1.0 = 0x3C00 (LE: 0x00, 0x3C)
    const buf = new Uint8Array([0x00, 0x3C]).buffer;
    const result = decodeBinary(buf, 'float16', 'little');
    expect(result.values[0]).toBeCloseTo(1.0, 2);
  });

  it('decodes float16 zero', () => {
    const buf = new Uint8Array([0x00, 0x00]).buffer;
    const result = decodeBinary(buf, 'float16', 'little');
    expect(result.values[0]).toBe(0);
  });

  // BFloat16
  it('decodes bfloat16 values', () => {
    // bfloat16 1.0 = upper 16 bits of float32 1.0 = 0x3F80 (LE: 0x80, 0x3F)
    const buf = new Uint8Array([0x80, 0x3F]).buffer;
    const result = decodeBinary(buf, 'bfloat16', 'little');
    expect(result.values[0]).toBeCloseTo(1.0, 2);
  });
});

// ─── detectFormat ────────────────────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects NumPy .npy format', () => {
    const data = float32Buffer([1.0, 2.0, 3.0]);
    const npyBuf = buildNpyBuffer('<f4', [3], data);
    const result = detectFormat(npyBuf, 'test.npy');
    expect(result.format).toBe('numpy');
    expect(result.dtype).toBe('float32');
    expect(result.byteOrder).toBe('little');
    expect(result.confidence).toBe('high');
    expect(result.shape).toEqual([3]);
  });

  it('detects NumPy big-endian float64', () => {
    const data = new ArrayBuffer(8 * 2);
    const dv = new DataView(data);
    dv.setFloat64(0, 1.0, false);
    dv.setFloat64(8, 2.0, false);
    const npyBuf = buildNpyBuffer('>f8', [2], data);
    const result = detectFormat(npyBuf);
    expect(result.format).toBe('numpy');
    expect(result.dtype).toBe('float64');
    expect(result.byteOrder).toBe('big');
  });

  it('detects NumPy int32', () => {
    const data = makeBuffer(
      (dv, off, val, le) => dv.setInt32(off, val, le),
      [10, 20],
      4,
      true
    );
    const npyBuf = buildNpyBuffer('<i4', [2], data);
    const result = detectFormat(npyBuf);
    expect(result.dtype).toBe('int32');
  });

  it('detects PyTorch ZIP format by magic bytes', () => {
    // PK\x03\x04 is ZIP local file header
    const buf = new Uint8Array(100);
    buf[0] = 0x50; // P
    buf[1] = 0x4B; // K
    buf[2] = 0x03;
    buf[3] = 0x04;
    const result = detectFormat(buf.buffer, 'model.pt');
    expect(result.format).toBe('pytorch');
  });

  it('detects safetensors format', () => {
    // Safetensors: 8-byte LE header length + JSON
    const metadata = JSON.stringify({
      'weight': {
        dtype: 'F32',
        shape: [4],
        data_offsets: [0, 16],
      },
    });
    const headerLen = metadata.length;
    const buf = new Uint8Array(8 + headerLen + 16);
    const dv = new DataView(buf.buffer);
    dv.setBigUint64(0, BigInt(headerLen), true);
    for (let i = 0; i < metadata.length; i++) {
      buf[8 + i] = metadata.charCodeAt(i);
    }
    const result = detectFormat(buf.buffer, 'model.safetensors');
    expect(result.format).toBe('safetensors');
    expect(result.confidence).toBe('high');
  });

  it('falls back to raw for unknown format', () => {
    const buf = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
    const result = detectFormat(buf, 'data.bin');
    expect(result.format).toBe('raw');
    expect(result.confidence).toBe('low');
  });

  it('guesses float16 from .f16 extension', () => {
    const buf = new Uint8Array(10).buffer;
    const result = detectFormat(buf, 'data.f16');
    expect(result.dtype).toBe('float16');
  });

  it('guesses bfloat16 from .bf16 extension', () => {
    const buf = new Uint8Array(10).buffer;
    const result = detectFormat(buf, 'data.bf16');
    expect(result.dtype).toBe('bfloat16');
  });

  it('guesses float32 for buffer divisible by 4', () => {
    const buf = new Uint8Array(16).buffer;
    const result = detectFormat(buf, 'data.bin');
    expect(result.dtype).toBe('float32');
  });

  it('guesses float16 for buffer divisible by 2 but not 4', () => {
    const buf = new Uint8Array(6).buffer;
    const result = detectFormat(buf, 'data.bin');
    expect(result.dtype).toBe('float16');
  });

  it('guesses uint8 for odd-sized buffer', () => {
    const buf = new Uint8Array(7).buffer;
    const result = detectFormat(buf, 'data.bin');
    expect(result.dtype).toBe('uint8');
  });
});

// ─── autoDecodeBinary / autoDecodeBinaryAsync ────────────────────────────────

describe('autoDecodeBinary', () => {
  it('auto-detects and decodes a NumPy file', () => {
    const data = float32Buffer([1.0, 2.0, 3.0]);
    const npyBuf = buildNpyBuffer('<f4', [3], data);
    const result = autoDecodeBinary(npyBuf, 'test.npy');
    expect(result.formatInfo.format).toBe('numpy');
    expect(result.elementCount).toBe(3);
    expect(result.values[0]).toBeCloseTo(1.0);
  });

  it('decodes raw binary with override dtype', () => {
    const buf = new Uint8Array([0, 1, 2, 3]).buffer;
    const result = autoDecodeBinary(buf, 'data.bin', 'uint8');
    expect(result.values).toEqual([0, 1, 2, 3]);
  });

  it('respects override byte order', () => {
    const buf = makeBuffer(
      (dv, off, val, le) => dv.setFloat32(off, val, le),
      [1.0],
      4,
      false // stored as big-endian
    );
    const result = autoDecodeBinary(buf, 'data.bin', 'float32', 'big');
    expect(result.values[0]).toBeCloseTo(1.0);
  });
});

describe('autoDecodeBinaryAsync', () => {
  it('returns same result as sync for non-compressed data', async () => {
    const data = float32Buffer([5.0, 10.0]);
    const npyBuf = buildNpyBuffer('<f4', [2], data);
    const result = await autoDecodeBinaryAsync(npyBuf, 'test.npy');
    expect(result.formatInfo.format).toBe('numpy');
    expect(result.elementCount).toBe(2);
    expect(result.values[0]).toBeCloseTo(5.0);
  });
});

// ─── formatValue ─────────────────────────────────────────────────────────────

describe('formatValue', () => {
  it('formats NaN', () => {
    expect(formatValue(NaN, 'float32')).toBe('NaN');
  });

  it('formats +Infinity', () => {
    expect(formatValue(Infinity, 'float32')).toBe('+Inf');
  });

  it('formats -Infinity', () => {
    expect(formatValue(-Infinity, 'float32')).toBe('-Inf');
  });

  it('formats bool true', () => {
    expect(formatValue(1, 'bool')).toBe('true');
  });

  it('formats bool false', () => {
    expect(formatValue(0, 'bool')).toBe('false');
  });

  it('formats integers as plain numbers', () => {
    expect(formatValue(42, 'int32')).toBe('42');
    expect(formatValue(-100, 'int16')).toBe('-100');
  });

  it('formats uint values', () => {
    expect(formatValue(255, 'uint8')).toBe('255');
  });

  it('formats small floats in exponential notation', () => {
    const result = formatValue(0.00001, 'float32', 6);
    expect(result).toContain('e');
  });

  it('formats large floats in exponential notation', () => {
    const result = formatValue(1e7, 'float32', 6);
    expect(result).toContain('e');
  });

  it('formats normal floats with precision', () => {
    const result = formatValue(1.23456, 'float32', 4);
    expect(result).toBe('1.235');
  });

  it('formats zero', () => {
    const result = formatValue(0, 'float32');
    expect(result).toBe('0.00000');
  });
});

// ─── getHexBytes ─────────────────────────────────────────────────────────────

describe('getHexBytes', () => {
  it('returns hex representation of bytes', () => {
    const bytes = new Uint8Array([0x00, 0x3C, 0x80, 0x3F]);
    const hex = getHexBytes(bytes, 0, 4, 0);
    expect(hex).toBe('00 3C 80 3F');
  });

  it('respects offset', () => {
    const bytes = new Uint8Array([0xFF, 0xFF, 0xAB, 0xCD]);
    const hex = getHexBytes(bytes, 0, 2, 2);
    expect(hex).toBe('AB CD');
  });

  it('respects index', () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const hex = getHexBytes(bytes, 1, 2, 0);
    expect(hex).toBe('03 04');
  });

  it('handles single byte elements', () => {
    const bytes = new Uint8Array([0xDE, 0xAD, 0xBE]);
    expect(getHexBytes(bytes, 0, 1, 0)).toBe('DE');
    expect(getHexBytes(bytes, 1, 1, 0)).toBe('AD');
    expect(getHexBytes(bytes, 2, 1, 0)).toBe('BE');
  });
});

// ─── formatBytes ─────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats small byte values', () => {
    expect(formatBytes(100)).toBe('100 B');
  });

  it('formats KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats MB', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });

  it('formats GB', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('formats TB', () => {
    expect(formatBytes(1099511627776)).toBe('1.0 TB');
  });

  it('handles negative values', () => {
    expect(formatBytes(-1)).toBe('0 B');
  });

  it('handles NaN', () => {
    expect(formatBytes(NaN)).toBe('0 B');
  });

  it('handles Infinity', () => {
    expect(formatBytes(Infinity)).toBe('0 B');
  });
});

// ─── compareValues ───────────────────────────────────────────────────────────

describe('compareValues', () => {
  it('finds no diffs for identical arrays', () => {
    const result = compareValues([1, 2, 3], [1, 2, 3]);
    expect(result.diffCount).toBe(0);
    expect(result.matchCount).toBe(3);
    expect(result.totalCompared).toBe(3);
  });

  it('detects all different elements', () => {
    const result = compareValues([1, 2, 3], [4, 5, 6]);
    expect(result.diffCount).toBe(3);
    expect(result.matchCount).toBe(0);
  });

  it('detects partial differences', () => {
    const result = compareValues([1, 2, 3], [1, 99, 3]);
    expect(result.diffCount).toBe(1);
    expect(result.diffIndices.has(1)).toBe(true);
    expect(result.matchCount).toBe(2);
  });

  it('treats both NaN as matching', () => {
    const result = compareValues([NaN], [NaN]);
    expect(result.matchCount).toBe(1);
    expect(result.diffCount).toBe(0);
  });

  it('treats NaN vs number as diff', () => {
    const result = compareValues([NaN], [1.0]);
    expect(result.diffCount).toBe(1);
  });

  it('compares with tolerance', () => {
    const result = compareValues([1.0, 2.0], [1.001, 2.1], 0.01);
    expect(result.matchCount).toBe(1); // 1.0 vs 1.001 within tolerance
    expect(result.diffCount).toBe(1); // 2.0 vs 2.1 outside tolerance
  });

  it('handles arrays of different lengths', () => {
    const result = compareValues([1, 2, 3, 4], [1, 2]);
    expect(result.totalCompared).toBe(2);
    expect(result.matchCount).toBe(2);
  });

  it('matches identical Infinities', () => {
    const result = compareValues([Infinity], [Infinity]);
    expect(result.matchCount).toBe(1);
  });

  it('diffs different Infinities', () => {
    const result = compareValues([Infinity], [-Infinity]);
    expect(result.diffCount).toBe(1);
  });
});

// ─── compareData ─────────────────────────────────────────────────────────────

describe('compareData', () => {
  it('compares two DecodedData objects', () => {
    const data1: DecodedData = {
      values: [1, 2, 3],
      rawBytes: new Uint8Array(12),
      dtype: 'float32',
      byteOrder: 'little',
      elementCount: 3,
      totalBytes: 12,
      bytesPerElement: 4,
    };
    const data2: DecodedData = {
      values: [1, 99, 3],
      rawBytes: new Uint8Array(12),
      dtype: 'float32',
      byteOrder: 'little',
      elementCount: 3,
      totalBytes: 12,
      bytesPerElement: 4,
    };
    const result = compareData(data1, data2);
    expect(result.diffCount).toBe(1);
    expect(result.matchCount).toBe(2);
  });
});

// ─── parseTxtData ────────────────────────────────────────────────────────────

describe('parseTxtData', () => {
  it('parses comma-separated values', () => {
    expect(parseTxtData('1, 2, 3')).toEqual([1, 2, 3]);
  });

  it('parses space-separated values', () => {
    expect(parseTxtData('1 2 3')).toEqual([1, 2, 3]);
  });

  it('parses newline-separated values', () => {
    expect(parseTxtData('1\n2\n3')).toEqual([1, 2, 3]);
  });

  it('parses mixed separators', () => {
    expect(parseTxtData('1, 2\n3; 4')).toEqual([1, 2, 3, 4]);
  });

  it('handles empty string', () => {
    expect(parseTxtData('')).toEqual([]);
  });

  it('handles single value', () => {
    expect(parseTxtData('42')).toEqual([42]);
  });

  it('parses negative numbers', () => {
    expect(parseTxtData('-1, -2.5, -0.001')).toEqual([-1, -2.5, -0.001]);
  });

  it('parses scientific notation', () => {
    expect(parseTxtData('1e-5, 2.5e3')).toEqual([1e-5, 2.5e3]);
  });

  it('parses NaN, Inf, -Inf', () => {
    const result = parseTxtData('nan, inf, -inf');
    expect(Number.isNaN(result[0])).toBe(true);
    expect(result[1]).toBe(Infinity);
    expect(result[2]).toBe(-Infinity);
  });

  it('parses true/false as 1/0', () => {
    expect(parseTxtData('true, false')).toEqual([1, 0]);
  });

  it('strips tensor() wrapper', () => {
    expect(parseTxtData('tensor([1.0, 2.0, 3.0])')).toEqual([1.0, 2.0, 3.0]);
  });

  it('strips array() wrapper', () => {
    expect(parseTxtData('array([4, 5, 6])')).toEqual([4, 5, 6]);
  });

  it('strips tensor with dtype kwarg', () => {
    const result = parseTxtData('tensor([1.0, 2.0], dtype=torch.float32)');
    expect(result).toEqual([1.0, 2.0]);
  });

  it('skips ellipsis tokens', () => {
    expect(parseTxtData('1, 2, ..., 10')).toEqual([1, 2, 10]);
  });

  it('handles brackets and parens', () => {
    expect(parseTxtData('[[1, 2], [3, 4]]')).toEqual([1, 2, 3, 4]);
  });
});

// ─── HiFloat8 Comparison Tests ──────────────────────────────────────────────

describe('hifloat8 comparison', () => {
  function hif8Decode(bytes: number[]): DecodedData {
    const buf = new Uint8Array(bytes).buffer;
    return decodeBinary(buf, 'hifloat8');
  }

  it('compareValues: identical hifloat8 arrays yield zero diffs', () => {
    const d1 = hif8Decode([0x08, 0x10, 0x40, 0x60]); // 1.0, 2.0, 16.0, 256.0
    const d2 = hif8Decode([0x08, 0x10, 0x40, 0x60]);
    const result = compareValues(d1.values, d2.values);
    expect(result.diffCount).toBe(0);
    expect(result.matchCount).toBe(4);
  });

  it('compareValues: differing hifloat8 arrays report correct diffs', () => {
    const d1 = hif8Decode([0x08, 0x10, 0x40, 0x60]); // 1.0, 2.0, 16.0, 256.0
    const d2 = hif8Decode([0x08, 0x18, 0x40, 0x61]); // 1.0, 0.5, 16.0, 384.0
    const result = compareValues(d1.values, d2.values);
    expect(result.diffCount).toBe(2);
    expect(result.diffIndices.has(1)).toBe(true);
    expect(result.diffIndices.has(3)).toBe(true);
    expect(result.matchCount).toBe(2);
  });

  it('compareValues: NaN-vs-NaN treated as equal in hifloat8', () => {
    const d1 = hif8Decode([0x80, 0x08]); // NaN, 1.0
    const d2 = hif8Decode([0x80, 0x08]); // NaN, 1.0
    const result = compareValues(d1.values, d2.values);
    expect(result.diffCount).toBe(0);
    expect(result.matchCount).toBe(2);
  });

  it('compareValues: NaN-vs-number is a diff in hifloat8', () => {
    const d1 = hif8Decode([0x80, 0x08]); // NaN, 1.0
    const d2 = hif8Decode([0x08, 0x80]); // 1.0, NaN
    const result = compareValues(d1.values, d2.values);
    expect(result.diffCount).toBe(2);
    expect(result.diffIndices.has(0)).toBe(true);
    expect(result.diffIndices.has(1)).toBe(true);
  });

  it('compareValues: Inf-vs-Inf treated as equal', () => {
    const d1 = hif8Decode([0x6F, 0xEF]); // +Inf, -Inf
    const d2 = hif8Decode([0x6F, 0xEF]); // +Inf, -Inf
    const result = compareValues(d1.values, d2.values);
    expect(result.diffCount).toBe(0);
    expect(result.matchCount).toBe(2);
  });

  it('compareValues: +Inf vs -Inf is a diff', () => {
    const d1 = hif8Decode([0x6F]); // +Inf
    const d2 = hif8Decode([0xEF]); // -Inf
    const result = compareValues(d1.values, d2.values);
    expect(result.diffCount).toBe(1);
  });

  it('compareValues: tolerance applied to hifloat8 values', () => {
    const d1 = hif8Decode([0x08, 0x09]); // 1.0, 1.125
    const d2 = hif8Decode([0x09, 0x0A]); // 1.125, 1.25
    // Without tolerance: 2 diffs
    expect(compareValues(d1.values, d2.values, 0).diffCount).toBe(2);
    // With tolerance 0.125: differences are 0.125 each, exactly at boundary → match
    expect(compareValues(d1.values, d2.values, 0.125).diffCount).toBe(0);
    // With tolerance 0.1: differences 0.125 > 0.1, still diffs
    expect(compareValues(d1.values, d2.values, 0.1).diffCount).toBe(2);
  });

  it('compareData: wrapper works with hifloat8 DecodedData', () => {
    const d1 = hif8Decode([0x10, 0x20, 0x40]);
    const d2 = hif8Decode([0x10, 0x30, 0x40]);
    const result = compareData(d1, d2);
    expect(result.diffCount).toBe(1);
    expect(result.diffIndices.has(1)).toBe(true);
    expect(result.totalCompared).toBe(3);
  });
});

// ─── HiFloat8 formatValue Tests ─────────────────────────────────────────────

describe('hifloat8 formatValue', () => {
  it('formats normal hifloat8 values', () => {
    // formatValue uses toPrecision-style for floats, so expect fixed-precision output
    const v1 = formatValue(1.0, 'hifloat8', 6);
    expect(parseFloat(v1)).toBe(1.0);
    const v256 = formatValue(256.0, 'hifloat8', 6);
    expect(parseFloat(v256)).toBe(256.0);
    const v023 = formatValue(0.234375, 'hifloat8', 6);
    expect(parseFloat(v023)).toBeCloseTo(0.234375, 6);
  });

  it('formats hifloat8 special values', () => {
    expect(formatValue(Infinity, 'hifloat8', 6)).toContain('Inf');
    expect(formatValue(-Infinity, 'hifloat8', 6)).toContain('-Inf');
    expect(formatValue(NaN, 'hifloat8', 6)).toBe('NaN');
    const v0 = formatValue(0, 'hifloat8', 6);
    expect(parseFloat(v0)).toBe(0);
  });

  it('formats hifloat8 denormal values with sufficient precision', () => {
    const val = Math.pow(2, -22);
    const formatted = formatValue(val, 'hifloat8', 10);
    const parsed = parseFloat(formatted);
    expect(parsed).toBeCloseTo(val, 15);
  });
});

// ─── DTYPE_INFO ──────────────────────────────────────────────────────────────

describe('DTYPE_INFO', () => {
  it('has entries for all 17 dtypes', () => {
    const dtypes: DType[] = [
      'float8_e4m3', 'float8_e5m2', 'float8_e8m0', 'hifloat8',
      'float16', 'bfloat16', 'float32', 'float64',
      'int8', 'int16', 'int32', 'int64',
      'uint8', 'uint16', 'uint32', 'uint64',
      'bool',
    ];
    for (const dtype of dtypes) {
      expect(DTYPE_INFO[dtype]).toBeDefined();
      expect(DTYPE_INFO[dtype].bytes).toBeGreaterThan(0);
      expect(DTYPE_INFO[dtype].category).toBeDefined();
    }
  });

  it('has correct byte sizes', () => {
    expect(DTYPE_INFO['float32'].bytes).toBe(4);
    expect(DTYPE_INFO['float64'].bytes).toBe(8);
    expect(DTYPE_INFO['int8'].bytes).toBe(1);
    expect(DTYPE_INFO['int16'].bytes).toBe(2);
    expect(DTYPE_INFO['int64'].bytes).toBe(8);
    expect(DTYPE_INFO['bool'].bytes).toBe(1);
    expect(DTYPE_INFO['float16'].bytes).toBe(2);
    expect(DTYPE_INFO['bfloat16'].bytes).toBe(2);
    expect(DTYPE_INFO['float8_e4m3'].bytes).toBe(1);
  });
});
