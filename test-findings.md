Test Results:
1. Decode mode works correctly - loaded test_float32.bin, shows 40 elements with correct values
2. Stats panel shows: Elements=40, dtype=float32 4B LE, File Size=160B, Min=-10.1, Max=1e6, Mean=27033.5, NaN=1, Inf=2
3. Data table renders correctly with offset column and 8 data columns
4. Values match expected: 1.0, 2.5, -3.14, 0.0, 100.0, -0.001, 1e6, NaN, +Inf, -Inf...
5. UI looks good with dark theme, all controls visible

Still need to test: Compare mode, Txt vs Bin mode, and polish some visual details.
