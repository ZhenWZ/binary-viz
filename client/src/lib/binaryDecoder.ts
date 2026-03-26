/**
 * Binary Decoder Utility
 * Decodes raw binary data from PyTorch/NumPy dumps into typed arrays
 * with support for all common numeric dtypes, auto-detection of file formats,
 * and float8 variants (E4M3, E5M2, E8M0).
 */

// ─── DType Definitions ───────────────────────────────────────────────────────

export type DType =
  | 'float8_e4m3'
  | 'float8_e5m2'
  | 'float8_e8m0'
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

export type FileFormat = 'raw' | 'numpy' | 'pytorch' | 'safetensors';

export interface DTypeInfo {
  name: string;
  bytes: number;
  description: string;
  category: 'float' | 'int' | 'uint' | 'bool';
}

export const DTYPE_INFO: Record<DType, DTypeInfo> = {
  float8_e4m3: { name: 'float8_e4m3', bytes: 1, description: 'FP8 E4M3 (OCP)', category: 'float' },
  float8_e5m2: { name: 'float8_e5m2', bytes: 1, description: 'FP8 E5M2 (OCP)', category: 'float' },
  float8_e8m0: { name: 'float8_e8m0', bytes: 1, description: 'FP8 E8M0 (MX scale)', category: 'float' },
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

export const DTYPE_GROUPS: Record<string, DType[]> = {
  'FP8': ['float8_e4m3', 'float8_e5m2', 'float8_e8m0'],
  'Floating Point': ['float16', 'bfloat16', 'float32', 'float64'],
  'Signed Integer': ['int8', 'int16', 'int32', 'int64'],
  'Unsigned Integer': ['uint8', 'uint16', 'uint32', 'uint64'],
  'Other': ['bool'],
};

// ─── Float8 Decoders ─────────────────────────────────────────────────────────

/**
 * Decode FP8 E4M3FN (1 sign, 4 exponent, 3 mantissa, no infinities)
 * Bias = 7, max value = 448, NaN = 0x7F and 0xFF (S111.1111)
 */
function decodeFloat8E4M3(byte: number): number {
  const sign = (byte >> 7) & 1;
  const exp = (byte >> 3) & 0xf;
  const mant = byte & 0x7;

  // NaN: exponent all 1s AND mantissa all 1s
  if (exp === 0xf && mant === 0x7) return NaN;

  if (exp === 0) {
    // Subnormal: value = (-1)^s * 2^(1-bias) * (0.mantissa)
    if (mant === 0) return sign ? -0 : 0;
    return (sign ? -1 : 1) * Math.pow(2, -6) * (mant / 8);
  }

  // Normal: value = (-1)^s * 2^(exp-bias) * (1 + mantissa/8)
  return (sign ? -1 : 1) * Math.pow(2, exp - 7) * (1 + mant / 8);
}

/**
 * Decode FP8 E5M2 (1 sign, 5 exponent, 2 mantissa, IEEE-like)
 * Bias = 15, supports inf and NaN
 */
function decodeFloat8E5M2(byte: number): number {
  const sign = (byte >> 7) & 1;
  const exp = (byte >> 2) & 0x1f;
  const mant = byte & 0x3;

  if (exp === 0x1f) {
    // Inf or NaN
    return mant ? NaN : (sign ? -Infinity : Infinity);
  }

  if (exp === 0) {
    if (mant === 0) return sign ? -0 : 0;
    // Subnormal
    return (sign ? -1 : 1) * Math.pow(2, -14) * (mant / 4);
  }

  return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + mant / 4);
}

/**
 * Decode FP8 E8M0 (0 sign, 8 exponent, 0 mantissa — MX scaling format)
 * Value = 2^(e - 127) for e in [0,254], NaN for e=255
 */
function decodeFloat8E8M0(byte: number): number {
  if (byte === 255) return NaN;
  return Math.pow(2, byte - 127);
}

// ─── Float16/BFloat16 Decoders ───────────────────────────────────────────────

function decodeFloat16(b0: number, b1: number, littleEndian: boolean): number {
  const val = littleEndian ? (b1 << 8) | b0 : (b0 << 8) | b1;
  const sign = (val >> 15) & 1;
  const exp = (val >> 10) & 0x1f;
  const frac = val & 0x3ff;

  if (exp === 0) {
    if (frac === 0) return sign ? -0 : 0;
    return (sign ? -1 : 1) * Math.pow(2, -14) * (frac / 1024);
  }
  if (exp === 0x1f) {
    return frac ? NaN : (sign ? -Infinity : Infinity);
  }
  return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + frac / 1024);
}

function decodeBFloat16(b0: number, b1: number, littleEndian: boolean): number {
  const val = littleEndian ? (b1 << 8) | b0 : (b0 << 8) | b1;
  const asFloat32Bits = val << 16;
  const buf = new ArrayBuffer(4);
  new DataView(buf).setUint32(0, asFloat32Bits, false);
  return new DataView(buf).getFloat32(0, false);
}

// ─── File Format Detection ───────────────────────────────────────────────────

export interface FormatDetectionResult {
  format: FileFormat;
  dtype?: DType;
  byteOrder?: ByteOrder;
  shape?: number[];
  dataOffset?: number;
  dataLength?: number;
  tensorName?: string;
  tensorEntries?: TensorEntry[];
  confidence: 'high' | 'medium' | 'low';
  description: string;
}

export interface TensorEntry {
  name: string;
  dtype?: DType;
  shape?: number[];
  dataOffset: number;
  dataLength: number;
}

/**
 * Map NumPy dtype descriptor string to our DType
 */
function npyDescrToDType(descr: string): { dtype: DType; byteOrder: ByteOrder } | null {
  // Remove quotes if present
  const d = descr.replace(/['"]/g, '').trim();

  // Parse byte order
  let byteOrder: ByteOrder = 'little';
  let typeStr = d;
  if (d.startsWith('<')) { byteOrder = 'little'; typeStr = d.slice(1); }
  else if (d.startsWith('>')) { byteOrder = 'big'; typeStr = d.slice(1); }
  else if (d.startsWith('=') || d.startsWith('|')) { typeStr = d.slice(1); }

  const map: Record<string, DType> = {
    'f2': 'float16', 'f4': 'float32', 'f8': 'float64',
    'e': 'float16', // numpy float16 shorthand
    'i1': 'int8', 'i2': 'int16', 'i4': 'int32', 'i8': 'int64',
    'u1': 'uint8', 'u2': 'uint16', 'u4': 'uint32', 'u8': 'uint64',
    'b1': 'bool', '?': 'bool',
    'B1': 'uint8',
  };

  const dtype = map[typeStr];
  if (dtype) return { dtype, byteOrder };
  return null;
}

/**
 * Parse NumPy .npy file header and extract metadata
 */
function parseNpyHeader(buffer: ArrayBuffer): FormatDetectionResult | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10) return null;

  // Check magic: \x93NUMPY
  if (bytes[0] !== 0x93 || bytes[1] !== 0x4e || bytes[2] !== 0x55 ||
      bytes[3] !== 0x4d || bytes[4] !== 0x50 || bytes[5] !== 0x59) {
    return null;
  }

  const major = bytes[6];
  const minor = bytes[7];

  let headerLen: number;
  let headerStart: number;

  if (major === 1) {
    // v1.0: 2-byte little-endian header length
    headerLen = bytes[8] | (bytes[9] << 8);
    headerStart = 10;
  } else if (major >= 2) {
    // v2.0+: 4-byte little-endian header length
    headerLen = bytes[8] | (bytes[9] << 8) | (bytes[10] << 16) | (bytes[11] << 24);
    headerStart = 12;
  } else {
    return null;
  }

  const dataOffset = headerStart + headerLen;

  // Parse header string (Python dict literal)
  const headerBytes = bytes.slice(headerStart, headerStart + headerLen);
  const headerStr = new TextDecoder().decode(headerBytes).trim();

  // Extract 'descr' field
  const descrMatch = headerStr.match(/'descr'\s*:\s*'([^']+)'/);
  // Extract 'shape' field
  const shapeMatch = headerStr.match(/'shape'\s*:\s*\(([^)]*)\)/);
  // Extract 'fortran_order'
  const fortranMatch = headerStr.match(/'fortran_order'\s*:\s*(True|False)/);

  let dtype: DType | undefined;
  let byteOrder: ByteOrder | undefined;
  let shape: number[] | undefined;

  if (descrMatch) {
    const parsed = npyDescrToDType(descrMatch[1]);
    if (parsed) {
      dtype = parsed.dtype;
      byteOrder = parsed.byteOrder;
    }
  }

  if (shapeMatch) {
    const shapeStr = shapeMatch[1].trim();
    if (shapeStr) {
      shape = shapeStr.split(',').map(s => s.trim()).filter(s => s).map(Number);
    } else {
      shape = []; // scalar
    }
  }

  return {
    format: 'numpy',
    dtype,
    byteOrder,
    shape,
    dataOffset,
    dataLength: buffer.byteLength - dataOffset,
    confidence: 'high',
    description: `NumPy v${major}.${minor} — descr: ${descrMatch?.[1] ?? 'unknown'}, shape: (${shape?.join(', ') ?? '?'})${fortranMatch?.[1] === 'True' ? ', Fortran order' : ''}`,
  };
}

/**
 * Attempt to read a ZIP archive and find PyTorch tensor data.
 * PyTorch .pt files are ZIP archives containing pickle + raw data.
 */
function parsePytorchZip(buffer: ArrayBuffer): FormatDetectionResult | null {
  const bytes = new Uint8Array(buffer);
  // Check ZIP magic: PK\x03\x04
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return null;
  }

  // Find all local file headers and catalog entries
  const entries: { name: string; offset: number; compressedSize: number; uncompressedSize: number; compressionMethod: number }[] = [];

  // Find End of Central Directory record (EOCD)
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    // Try to parse local file headers directly
    return parsePytorchLocalHeaders(buffer, bytes);
  }

  const view = new DataView(buffer);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const cdEntries = view.getUint16(eocdOffset + 10, true);

  let pos = cdOffset;
  for (let i = 0; i < cdEntries && pos < bytes.length - 46; i++) {
    // Central directory header: PK\x01\x02
    if (bytes[pos] !== 0x50 || bytes[pos + 1] !== 0x4b || bytes[pos + 2] !== 0x01 || bytes[pos + 3] !== 0x02) break;

    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const compressionMethod = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);

    const nameBytes = bytes.slice(pos + 46, pos + 46 + nameLen);
    const name = new TextDecoder().decode(nameBytes);

    // Calculate actual data offset from local header
    let dataOffset = localHeaderOffset;
    if (localHeaderOffset + 30 < bytes.length) {
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;
    }

    entries.push({ name, offset: dataOffset, compressedSize, uncompressedSize, compressionMethod });
    pos += 46 + nameLen + extraLen + commentLen;
  }

  return buildPytorchResult(entries, buffer);
}

function parsePytorchLocalHeaders(buffer: ArrayBuffer, bytes: Uint8Array): FormatDetectionResult | null {
  const view = new DataView(buffer);
  const entries: { name: string; offset: number; compressedSize: number; uncompressedSize: number; compressionMethod: number }[] = [];
  let pos = 0;

  while (pos < bytes.length - 30) {
    if (bytes[pos] !== 0x50 || bytes[pos + 1] !== 0x4b || bytes[pos + 2] !== 0x03 || bytes[pos + 3] !== 0x04) break;

    const compressionMethod = view.getUint16(pos + 8, true);
    const compressedSize = view.getUint32(pos + 18, true);
    const uncompressedSize = view.getUint32(pos + 22, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);

    const nameBytes = bytes.slice(pos + 30, pos + 30 + nameLen);
    const name = new TextDecoder().decode(nameBytes);
    const dataOffset = pos + 30 + nameLen + extraLen;

    entries.push({ name, offset: dataOffset, compressedSize, uncompressedSize, compressionMethod });
    pos = dataOffset + compressedSize;
  }

  return buildPytorchResult(entries, buffer);
}

/**
 * Decompress DEFLATE data using the browser's DecompressionStream API.
 * Returns the decompressed bytes, or null if decompression fails.
 */
async function decompressDeflateRaw(compressedData: Uint8Array): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();
    writer.write(compressedData);
    writer.close();
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalLen += value.byteLength;
    }
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  } catch {
    return null;
  }
}

function buildPytorchResult(
  entries: { name: string; offset: number; compressedSize: number; uncompressedSize: number; compressionMethod: number }[],
  buffer: ArrayBuffer
): FormatDetectionResult | null {
  if (entries.length === 0) return null;

  // Find data files (archive/data/*)
  const dataEntries = entries.filter(e =>
    e.name.includes('/data/') && !e.name.endsWith('/') && e.compressedSize > 0
  );

  // Check if any data entry uses compression
  const hasCompressed = dataEntries.some(e => e.compressionMethod !== 0);

  // Also check for .pkl files to confirm this is PyTorch
  const hasPkl = entries.some(e => e.name.endsWith('.pkl'));

  const tensorEntries: TensorEntry[] = dataEntries.map(e => {
    const parts = e.name.split('/');
    const tensorName = parts[parts.length - 1] || e.name;
    return {
      name: tensorName,
      dataOffset: e.offset,
      // Use uncompressedSize for the logical data length, compressedSize for reading from buffer
      dataLength: e.compressionMethod === 0 ? e.compressedSize : e.uncompressedSize,
      _compressedSize: e.compressedSize,
      _compressionMethod: e.compressionMethod,
    } as TensorEntry;
  });

  // If no data entries found, treat the largest entry as potential data
  if (tensorEntries.length === 0) {
    const largest = entries.reduce((a, b) => a.compressedSize > b.compressedSize ? a : b);
    if (largest.compressedSize > 0) {
      tensorEntries.push({
        name: largest.name,
        dataOffset: largest.offset,
        dataLength: largest.compressionMethod === 0 ? largest.compressedSize : largest.uncompressedSize,
      });
    }
  }

  const totalDataBytes = tensorEntries.reduce((sum, t) => sum + t.dataLength, 0);
  const compressedNote = hasCompressed ? ' (contains compressed entries)' : '';

  return {
    format: 'pytorch',
    confidence: hasPkl ? 'high' : 'medium',
    description: `PyTorch ZIP archive — ${entries.length} entries, ${tensorEntries.length} tensor(s), ${formatBytes(totalDataBytes)} data${compressedNote}`,
    tensorEntries,
    dataOffset: tensorEntries.length > 0 ? tensorEntries[0].dataOffset : 0,
    dataLength: tensorEntries.length > 0 ? tensorEntries[0].dataLength : 0,
    _hasCompressed: hasCompressed,
    _buffer: hasCompressed ? buffer : undefined,
  } as FormatDetectionResult;
}

/**
 * Parse safetensors format header
 */
function parseSafetensors(buffer: ArrayBuffer): FormatDetectionResult | null {
  if (buffer.byteLength < 8) return null;
  const view = new DataView(buffer);

  // First 8 bytes: little-endian uint64 header size
  const headerSize = Number(view.getBigUint64(0, true));
  if (headerSize <= 0 || headerSize > buffer.byteLength - 8 || headerSize > 100_000_000) return null;

  try {
    const headerBytes = new Uint8Array(buffer, 8, headerSize);
    const headerStr = new TextDecoder().decode(headerBytes);
    const header = JSON.parse(headerStr);

    const tensorEntries: TensorEntry[] = [];
    const dataStart = 8 + headerSize;

    for (const [key, meta] of Object.entries(header)) {
      if (key === '__metadata__') continue;
      const m = meta as { dtype: string; shape: number[]; data_offsets: [number, number] };
      if (!m.data_offsets || !m.dtype) continue;

      const dtypeMap: Record<string, DType> = {
        'F16': 'float16', 'BF16': 'bfloat16', 'F32': 'float32', 'F64': 'float64',
        'I8': 'int8', 'I16': 'int16', 'I32': 'int32', 'I64': 'int64',
        'U8': 'uint8', 'U16': 'uint16', 'U32': 'uint32', 'U64': 'uint64',
        'BOOL': 'bool', 'F8_E4M3': 'float8_e4m3', 'F8_E5M2': 'float8_e5m2',
      };

      tensorEntries.push({
        name: key,
        dtype: dtypeMap[m.dtype],
        shape: m.shape,
        dataOffset: dataStart + m.data_offsets[0],
        dataLength: m.data_offsets[1] - m.data_offsets[0],
      });
    }

    if (tensorEntries.length === 0) return null;

    return {
      format: 'safetensors',
      confidence: 'high',
      description: `Safetensors — ${tensorEntries.length} tensor(s)`,
      tensorEntries,
      dtype: tensorEntries[0].dtype,
      shape: tensorEntries[0].shape,
      dataOffset: tensorEntries[0].dataOffset,
      dataLength: tensorEntries[0].dataLength,
    };
  } catch {
    return null;
  }
}

/**
 * Auto-detect file format from buffer contents
 */
export function detectFormat(buffer: ArrayBuffer, fileName?: string): FormatDetectionResult {
  // 1. Try NumPy .npy
  const npyResult = parseNpyHeader(buffer);
  if (npyResult) return npyResult;

  // 2. Try Safetensors
  const stResult = parseSafetensors(buffer);
  if (stResult) return stResult;

  // 3. Try PyTorch ZIP (.pt, .ptx, .pth, .bin)
  const ptResult = parsePytorchZip(buffer);
  if (ptResult) return ptResult;

  // 4. Raw binary — guess dtype from file extension and size
  const ext = fileName?.split('.').pop()?.toLowerCase() ?? '';
  let guessedDtype: DType = 'float32';
  let description = 'Raw binary data';

  const size = buffer.byteLength;

  // Heuristic: check extension hints
  if (ext === 'f16' || ext === 'fp16') { guessedDtype = 'float16'; }
  else if (ext === 'bf16') { guessedDtype = 'bfloat16'; }
  else if (ext === 'f32' || ext === 'fp32') { guessedDtype = 'float32'; }
  else if (ext === 'f64' || ext === 'fp64') { guessedDtype = 'float64'; }
  else if (ext === 'i8') { guessedDtype = 'int8'; }
  else if (ext === 'u8') { guessedDtype = 'uint8'; }
  else {
    // Try to guess: if divisible by 4, likely float32; by 2, float16; else uint8
    if (size % 4 === 0) guessedDtype = 'float32';
    else if (size % 2 === 0) guessedDtype = 'float16';
    else guessedDtype = 'uint8';
  }

  description = `Raw binary — ${formatBytes(size)}, guessed ${guessedDtype}`;

  return {
    format: 'raw',
    dtype: guessedDtype,
    byteOrder: 'little',
    dataOffset: 0,
    dataLength: size,
    confidence: 'low',
    description,
  };
}

// ─── Core Decoder ────────────────────────────────────────────────────────────

export interface DecodedData {
  values: number[];
  rawBytes: Uint8Array;
  dtype: DType;
  byteOrder: ByteOrder;
  elementCount: number;
  totalBytes: number;
  bytesPerElement: number;
  shape?: number[];
  formatInfo?: FormatDetectionResult;
  /** Offset into rawBytes where the decoded data starts (for hex display) */
  dataOffset?: number;
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

  const values: number[] = new Array(elementCount);

  for (let i = 0; i < elementCount; i++) {
    const pos = offset + i * info.bytes;
    let value: number;

    switch (dtype) {
      case 'float8_e4m3':
        value = decodeFloat8E4M3(bytes[pos]);
        break;
      case 'float8_e5m2':
        value = decodeFloat8E5M2(bytes[pos]);
        break;
      case 'float8_e8m0':
        value = decodeFloat8E8M0(bytes[pos]);
        break;
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

    values[i] = value;
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
 * Auto-decode: detect format, then decode with detected or overridden settings
 */
export function autoDecodeBinary(
  buffer: ArrayBuffer,
  fileName?: string,
  overrideDtype?: DType,
  overrideByteOrder?: ByteOrder,
  overrideOffset?: number,
  selectedTensorIndex?: number,
): DecodedData & { formatInfo: FormatDetectionResult } {
  const formatInfo = detectFormat(buffer, fileName);

  let dtype = overrideDtype ?? formatInfo.dtype ?? 'float32';
  let byteOrder = overrideByteOrder ?? formatInfo.byteOrder ?? 'little';
  let offset = overrideOffset ?? formatInfo.dataOffset ?? 0;
  let count: number | undefined;
  let shape = formatInfo.shape;
  let dataOffset = offset; // Track the data offset for hex display

  // For formats with multiple tensors, use selected tensor
  if (formatInfo.tensorEntries && formatInfo.tensorEntries.length > 0) {
    const idx = selectedTensorIndex ?? 0;
    const entry = formatInfo.tensorEntries[Math.min(idx, formatInfo.tensorEntries.length - 1)];
    if (overrideOffset === undefined) offset = entry.dataOffset;
    dataOffset = offset;
    count = Math.floor(entry.dataLength / DTYPE_INFO[dtype].bytes);
    if (entry.dtype && !overrideDtype) dtype = entry.dtype;
    if (entry.shape) shape = entry.shape;
  }

  const decoded = decodeBinary(buffer, dtype, byteOrder, offset, count);
  return { ...decoded, shape, formatInfo, dataOffset };
}

/**
 * Async version of autoDecodeBinary that handles compressed PyTorch entries.
 * Falls back to sync autoDecodeBinary for non-compressed formats.
 */
export async function autoDecodeBinaryAsync(
  buffer: ArrayBuffer,
  fileName?: string,
  overrideDtype?: DType,
  overrideByteOrder?: ByteOrder,
  overrideOffset?: number,
  selectedTensorIndex?: number,
): Promise<DecodedData & { formatInfo: FormatDetectionResult }> {
  const formatInfo = detectFormat(buffer, fileName);

  // Check if this is a PyTorch file with compressed entries
  const fi = formatInfo as any;
  if (fi._hasCompressed && fi._buffer && formatInfo.tensorEntries) {
    const idx = selectedTensorIndex ?? 0;
    const entry = formatInfo.tensorEntries[Math.min(idx, formatInfo.tensorEntries.length - 1)] as any;
    const compressionMethod = entry._compressionMethod ?? 0;

    if (compressionMethod !== 0) {
      // Need to decompress
      const compressedBytes = new Uint8Array(buffer, entry.dataOffset, entry._compressedSize);
      const decompressed = await decompressDeflateRaw(compressedBytes);

      if (!decompressed) {
        throw new Error(
          'Failed to decompress PyTorch tensor data. The file uses DEFLATE compression. ' +
          'Try re-saving with: torch.save(tensor, path, _use_new_zipfile_serialization=True)'
        );
      }

      // Decode from the decompressed buffer
      let dtype = overrideDtype ?? entry.dtype ?? formatInfo.dtype ?? 'float32';
      let byteOrder = overrideByteOrder ?? formatInfo.byteOrder ?? 'little';
      const shape = entry.shape ?? formatInfo.shape;
      const decoded = decodeBinary(decompressed.buffer, dtype, byteOrder, 0);
      return { ...decoded, shape, formatInfo, dataOffset: 0 };
    }
  }

  // Non-compressed: use sync path
  return autoDecodeBinary(buffer, fileName, overrideDtype, overrideByteOrder, overrideOffset, selectedTensorIndex);
}

// ─── Formatting Utilities ────────────────────────────────────────────────────

export function formatValue(value: number, dtype: DType, precision: number = 6): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '+Inf' : '-Inf';

  const info = DTYPE_INFO[dtype];
  if (info.category === 'bool') return value ? 'true' : 'false';
  if (info.category === 'int' || info.category === 'uint') return value.toString();

  if (Math.abs(value) < 0.0001 && value !== 0) {
    return value.toExponential(precision - 1);
  }
  if (Math.abs(value) >= 1e6) {
    return value.toExponential(precision - 1);
  }
  return value.toPrecision(precision);
}

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

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// ─── Comparison Functions ────────────────────────────────────────────────────

export function compareValues(
  values1: number[],
  values2: number[],
  tolerance: number = 0
): { diffIndices: Set<number>; matchCount: number; diffCount: number; totalCompared: number } {
  const len = Math.min(values1.length, values2.length);
  const diffIndices = new Set<number>();
  let matchCount = 0;

  for (let i = 0; i < len; i++) {
    const v1 = values1[i];
    const v2 = values2[i];

    if (Number.isNaN(v1) && Number.isNaN(v2)) { matchCount++; continue; }
    if (Number.isNaN(v1) || Number.isNaN(v2)) { diffIndices.add(i); continue; }
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) {
      if (v1 === v2) matchCount++; else diffIndices.add(i);
      continue;
    }

    if (tolerance === 0) {
      if (v1 === v2) matchCount++; else diffIndices.add(i);
    } else {
      if (Math.abs(v1 - v2) <= tolerance) matchCount++; else diffIndices.add(i);
    }
  }

  return { diffIndices, matchCount, diffCount: diffIndices.size, totalCompared: len };
}

/** Legacy wrapper */
export function compareData(
  data1: DecodedData,
  data2: DecodedData,
  tolerance: number = 0
) {
  return compareValues(data1.values, data2.values, tolerance);
}

// ─── Text Parsing ────────────────────────────────────────────────────────────

export function parseTxtData(text: string): number[] {
  // Step 1: Strip known wrapper functions (tensor(...), array(...), etc.)
  let cleaned = text.trim();

  // Remove outer tensor/array wrappers (handles nested parens correctly)
  cleaned = cleaned.replace(/^tensor\s*\(/i, '').replace(/^array\s*\(/i, '');

  // Step 2: Strip known keyword arguments (dtype=..., device=..., requires_grad=..., etc.)
  // Handle both quoted and unquoted values
  cleaned = cleaned.replace(/,?\s*(dtype|device|requires_grad|grad_fn|layout|pin_memory|memory_format)\s*=\s*('[^']*'|"[^"]*"|[\w.:]+)/gi, '');

  // Step 3: Remove all structural characters: brackets, parens
  cleaned = cleaned.replace(/[\[\]()]/g, '');

  // Step 4: Tokenize on whitespace, commas, semicolons, and newlines
  const tokens = cleaned.split(/[\s,;\n]+/).filter(t => t.length > 0);
  const values: number[] = [];

  for (const token of tokens) {
    const trimmed = token.trim();
    if (trimmed === '' || trimmed === '...' || trimmed === '\u2026') continue;

    const lower = trimmed.toLowerCase();
    if (lower === 'nan') { values.push(NaN); }
    else if (lower === 'inf' || lower === '+inf') { values.push(Infinity); }
    else if (lower === '-inf') { values.push(-Infinity); }
    else if (lower === 'true') { values.push(1); }
    else if (lower === 'false') { values.push(0); }
    else {
      const num = Number(trimmed);
      if (!isNaN(num)) { values.push(num); }
      // Skip non-numeric tokens silently (e.g. leftover keyword fragments)
    }
  }

  return values;
}
