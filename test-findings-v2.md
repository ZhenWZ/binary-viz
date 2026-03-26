# Test Findings v2

## Decode Mode - NumPy .npy auto-detection
- File: test_float32.npy (160 bytes)
- Auto-detected: numpy format, descr: <f4, shape: (8,)
- Shows "numpy" and "auto-detected" badges
- Correctly decoded 8 float32 values: 1.0, 2.5, -3.14, 0.001, 100.0, -0.5, 42.0, 7.77
- Stats panel shows: min=-3.14, max=100, mean=18.7039, std=33.6211, median=2.5
- Distribution histogram renders correctly
- Data table shows all values in a single row

## Status: PASS - Auto-detection working correctly for NumPy .npy files!
