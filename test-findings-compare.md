Compare mode test results:
1. Both files loaded correctly (compare_a.bin and compare_b.bin, 200B each, 50 float32 elements)
2. Stats show: 10 differences (20%), 40 matches (80%) - correct!
3. Side-by-side tables display with diff highlighting in rose/red color
4. Diff cells are clearly highlighted in both panels
5. Navigation buttons (prev/next diff) are visible
6. Tolerance input is available
7. All controls work: dtype, byte order, columns, precision, show hex

The comparison is working correctly - differences at indices 3, 7, 12, 18, 25, 31, 36, 40, 44, 48 are highlighted.
