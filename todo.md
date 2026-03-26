# Binary Data Visualizer - Modification TODO

## Architecture Changes
- [ ] Merge "Txt vs Bin" mode into Compare mode as a source type option
- [ ] Remove the separate Txt vs Bin tab from the top toolbar
- [ ] In Compare mode, let user choose source type per panel: Binary File or Text/Parsed

## Auto-Detection
- [ ] Auto-detect NumPy .npy file format (magic bytes: \x93NUMPY)
- [ ] Auto-detect PyTorch .pt file format (ZIP archive with pickle)
- [ ] Support PyTorch .ptx data files
- [ ] Auto-detect raw binary format and guess dtype from file size
- [ ] Allow user to override auto-detected format and dtype

## Dtype Expansion
- [ ] Add float8_e8m0 support
- [ ] Add float8_e4m3 (FP8 E4M3) support
- [ ] Add float8_e5m2 (FP8 E5M2) support
- [ ] Keep existing: fp32, bfloat16, float16, int8, uint8, int16, int32, int64, uint16, uint32, uint64, float64, bool

## Format Support
- [ ] NumPy .npy format parser (header + raw data)
- [ ] PyTorch .pt format parser (ZIP + pickle tensor extraction)
- [ ] PyTorch .ptx format parser
- [ ] Raw binary format (existing)
- [ ] Show detected format info in UI

## Testing
- [ ] Test with NumPy .npy files
- [ ] Test with PyTorch .pt files
- [ ] Test auto-detection
- [ ] Test Compare mode with mixed source types (txt + binary)
- [ ] Test float8 dtypes
