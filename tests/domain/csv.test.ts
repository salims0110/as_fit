import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { sanitizeCsvCell, toCsv, UTF8_BOM } from '@/domain/csv';

describe('CSV domain serializer (UTF-8 BOM & formula-injection guard)', () => {
  it('prepends UTF-8 BOM and uses CRLF line endings', () => {
    const csv = toCsv(['التاريخ', 'الوزن (كغ)'], [['2026-11-25', 79.4]]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toBe('\uFEFFالتاريخ,الوزن (كغ)\r\n2026-11-25,79.4\r\n');
  });

  it('formats booleans in Arabic, preserves finite negative numbers, and blanks non-finite/nullish values', () => {
    expect(sanitizeCsvCell(true)).toBe('نعم');
    expect(sanitizeCsvCell(false)).toBe('لا');
    expect(sanitizeCsvCell(-500)).toBe('-500');
    expect(sanitizeCsvCell(0)).toBe('0');
    expect(sanitizeCsvCell(Number.NaN)).toBe('');
    expect(sanitizeCsvCell(Number.POSITIVE_INFINITY)).toBe('');
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
  });

  it('neutralizes spreadsheet formula injection on string cells including leading whitespace', () => {
    expect(sanitizeCsvCell('=cmd|\' /C calc\'!A0')).toBe('\'=cmd|\' /C calc\'!A0');
    expect(sanitizeCsvCell('+SUM(A1:A2)')).toBe('\'+SUM(A1:A2)');
    expect(sanitizeCsvCell('-1+1')).toBe('\'-1+1');
    expect(sanitizeCsvCell('@A1')).toBe('\'@A1');
    expect(sanitizeCsvCell('@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
    expect(sanitizeCsvCell('  =HYPERLINK("http://evil")')).toBe('"\'  =HYPERLINK(""http://evil"")"');
    expect(sanitizeCsvCell('\t=1+1')).toBe('\'\t=1+1');
    expect(sanitizeCsvCell('\r=1+1')).toBe('"\'\r=1+1"');
  });

  it('quotes cells containing commas, double quotes, or newlines per RFC 4180', () => {
    expect(sanitizeCsvCell('قهوة، سادة')).toBe('قهوة، سادة');
    expect(sanitizeCsvCell('وجبة, غداء')).toBe('"وجبة, غداء"');
    expect(sanitizeCsvCell('كوب "كبير"')).toBe('"كوب ""كبير"""');
    expect(sanitizeCsvCell('سطر 1\nسطر 2')).toBe('"سطر 1\nسطر 2"');
  });

  it('never emits an unguarded raw formula trigger at the start of any string cell (property)', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const out = sanitizeCsvCell(s);
        const unquoted = out.startsWith('"') && out.endsWith('"') ? out.slice(1, -1).replaceAll('""', '"') : out;
        expect(/^[\s]*[=+\-@\t\r]/.test(unquoted)).toBe(false);
      }),
    );
  });
});
