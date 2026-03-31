import { describe, it, expect } from 'vitest';
import { getHiFloat8BitFields, getBitFields, type BitField } from './bitUtils';

/** Verify fields cover all 8 bits with no gaps or overlaps */
function assertFieldsCover8Bits(fields: BitField[]) {
  expect(fields[0].start).toBe(0);
  for (let i = 1; i < fields.length; i++) {
    expect(fields[i].start).toBe(fields[i - 1].end);
  }
  expect(fields[fields.length - 1].end).toBe(8);
}

describe('getHiFloat8BitFields', () => {
  it('D=4 region (dot prefix "11"): S(1) + Dot(2) + Exp(4) + Mant(1)', () => {
    // 0b1_11_0101_0 = 0xEA (sign=1, dot=11, exp=0101, mant=0)
    const fields = getHiFloat8BitFields(0xEA);
    assertFieldsCover8Bits(fields);
    expect(fields).toEqual([
      { name: 'S', start: 0, end: 1, color: 'amber' },
      { name: 'Dot', start: 1, end: 3, color: 'violet' },
      { name: 'Exp', start: 3, end: 7, color: 'sky' },
      { name: 'Mant', start: 7, end: 8, color: 'emerald' },
    ]);
  });

  it('D=3 region (dot prefix "10"): S(1) + Dot(2) + Exp(3) + Mant(2)', () => {
    // 0b0_10_101_01 = 0x55 (sign=0, dot=10, exp=101, mant=01)
    const fields = getHiFloat8BitFields(0x55);
    assertFieldsCover8Bits(fields);
    expect(fields).toEqual([
      { name: 'S', start: 0, end: 1, color: 'amber' },
      { name: 'Dot', start: 1, end: 3, color: 'violet' },
      { name: 'Exp', start: 3, end: 6, color: 'sky' },
      { name: 'Mant', start: 6, end: 8, color: 'emerald' },
    ]);
  });

  it('D=2 region (dot prefix "01"): S(1) + Dot(2) + Exp(2) + Mant(3)', () => {
    // 0b0_01_10_111 = 0x37 (sign=0, dot=01, exp=10, mant=111)
    const fields = getHiFloat8BitFields(0x37);
    assertFieldsCover8Bits(fields);
    expect(fields).toEqual([
      { name: 'S', start: 0, end: 1, color: 'amber' },
      { name: 'Dot', start: 1, end: 3, color: 'violet' },
      { name: 'Exp', start: 3, end: 5, color: 'sky' },
      { name: 'Mant', start: 5, end: 8, color: 'emerald' },
    ]);
  });

  it('D=1 region (dot prefix "001"): S(1) + Dot(3) + Exp(1) + Mant(3)', () => {
    // 0b0_001_1_101 = 0x1D (sign=0, dot=001, exp=1, mant=101)
    const fields = getHiFloat8BitFields(0x1D);
    assertFieldsCover8Bits(fields);
    expect(fields).toEqual([
      { name: 'S', start: 0, end: 1, color: 'amber' },
      { name: 'Dot', start: 1, end: 4, color: 'violet' },
      { name: 'Exp', start: 4, end: 5, color: 'sky' },
      { name: 'Mant', start: 5, end: 8, color: 'emerald' },
    ]);
  });

  it('D=0 positive denormal (dot prefix "0001"): S(1) + Dot(4) + Mant(3)', () => {
    // 0b0_0001_101 = 0x0D (sign=0, dot=0001, mant=101)
    const fields = getHiFloat8BitFields(0x0D);
    assertFieldsCover8Bits(fields);
    expect(fields).toEqual([
      { name: 'S', start: 0, end: 1, color: 'amber' },
      { name: 'Dot', start: 1, end: 5, color: 'violet' },
      { name: 'Mant', start: 5, end: 8, color: 'emerald' },
    ]);
    // No Exp field for D=0
    expect(fields.find(f => f.name === 'Exp')).toBeUndefined();
  });

  it('D=0 negative denormal (dot prefix "0000"): S(1) + Dot(4) + Mant(3)', () => {
    // 0b0_0000_110 = 0x06 (sign=0, dot=0000, mant=110)
    const fields = getHiFloat8BitFields(0x06);
    assertFieldsCover8Bits(fields);
    expect(fields).toEqual([
      { name: 'S', start: 0, end: 1, color: 'amber' },
      { name: 'Dot', start: 1, end: 5, color: 'violet' },
      { name: 'Mant', start: 5, end: 8, color: 'emerald' },
    ]);
  });

  it('zero (0x00) is D=0 negative denormal region', () => {
    const fields = getHiFloat8BitFields(0x00);
    assertFieldsCover8Bits(fields);
    expect(fields[1]).toEqual({ name: 'Dot', start: 1, end: 5, color: 'violet' });
  });

  it('NaN (0x80) has sign=1, D=0 negative denormal', () => {
    const fields = getHiFloat8BitFields(0x80);
    assertFieldsCover8Bits(fields);
    expect(fields[0]).toEqual({ name: 'S', start: 0, end: 1, color: 'amber' });
    expect(fields[1]).toEqual({ name: 'Dot', start: 1, end: 5, color: 'violet' });
  });

  it('0xFF is in D=4 region (sign=1, dot=11)', () => {
    const fields = getHiFloat8BitFields(0xFF);
    expect(fields[1]).toEqual({ name: 'Dot', start: 1, end: 3, color: 'violet' });
    expect(fields[2]).toEqual({ name: 'Exp', start: 3, end: 7, color: 'sky' });
  });

  it('fields from different D-regions have different structures', () => {
    const d4 = getHiFloat8BitFields(0xC0); // 11... → D=4
    const d0 = getHiFloat8BitFields(0x08); // 0001... → D=0
    // D=4 has 4 fields (S, Dot, Exp, Mant), D=0 has 3 (S, Dot, Mant)
    expect(d4.length).toBe(4);
    expect(d0.length).toBe(3);
  });
});

describe('getBitFields with hifloat8 byteValue', () => {
  it('returns dynamic fields when byteValue provided', () => {
    const fields = getBitFields('hifloat8', 0xC0);
    expect(fields[1].name).toBe('Dot');
    expect(fields.length).toBe(4); // S, Dot, Exp, Mant
  });

  it('returns static fallback when byteValue omitted', () => {
    const fields = getBitFields('hifloat8');
    expect(fields.length).toBe(2); // S, Dot+Exp+Mant
    expect(fields[1].name).toBe('Dot+Exp+Mant');
  });

  it('non-hifloat8 dtypes ignore byteValue', () => {
    const fields = getBitFields('float32', 0xFF);
    expect(fields.length).toBe(3); // S, Exp, Mant
    expect(fields[0].name).toBe('S');
  });
});
