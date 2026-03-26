# Format Research Notes

## NumPy .npy Format
- Magic: \x93NUMPY (6 bytes)
- Version major (1 byte), minor (1 byte)
- v1.0: next 2 bytes = little-endian uint16 HEADER_LEN
- v2.0: next 4 bytes = little-endian uint32 HEADER_LEN
- Header: ASCII dict with keys: 'descr', 'fortran_order', 'shape'
- descr examples: '<f4' (LE float32), '>f8' (BE float64), '<f2' (LE float16), '|u1' (uint8), '<i4' (LE int32)
- After header: raw contiguous array data

## PyTorch .pt Format
- ZIP archive (PK magic: 0x50, 0x4B)
- Contains pickle files + raw tensor data
- Tensor data stored as raw binary in archive/data/ directory
- Can extract raw tensor bytes from ZIP entries

## PyTorch .ptx Format
- Likely same as .pt (ZIP-based), or could be ExecuTorch .pte format
- ExecuTorch uses flatbuffer format
- For safety, treat .ptx as ZIP-based like .pt, with fallback to raw binary

## Float8 Formats
### E4M3 (FP8 E4M3FN - no infinities)
- 1 sign, 4 exponent, 3 mantissa
- Bias: 7
- Range: ±448, NaN only (no inf)
- Special: all 1s exponent + all 1s mantissa = NaN

### E5M2
- 1 sign, 5 exponent, 2 mantissa  
- Bias: 15
- Range: ±57344
- Supports inf and NaN (like IEEE)

### E8M0 (Microscaling format)
- 0 sign, 8 exponent, 0 mantissa
- Used as shared scale factor in MX formats
- Value = 2^(e - 127) for e in [0, 254], NaN for e=255
- Always positive, no sign bit
- Bias: 127

## NumPy dtype descriptor strings
- Byte order: '<' LE, '>' BE, '=' native, '|' not applicable
- Type: 'b' int8, 'B' uint8, 'i' int, 'u' uint, 'f' float, '?' bool
- Size in bytes follows type char
- Examples: '<f4'=float32 LE, '<f2'=float16, '<f8'=float64, '<i4'=int32, '|b1'=bool
