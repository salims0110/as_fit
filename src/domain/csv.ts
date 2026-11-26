export type CsvPrimitive = string | number | boolean | null | undefined;

export const UTF8_BOM = '\uFEFF';

// Leading characters interpreted as executable formulas by Excel, LibreOffice Calc, and Google Sheets.
const FORMULA_TRIGGER_RE = /^[\s]*[=+\-@\t\r]/;

export function sanitizeCsvCell(value: CsvPrimitive): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (typeof value === 'boolean') {
    return value ? 'نعم' : 'لا';
  }

  const guarded = FORMULA_TRIGGER_RE.test(value) ? `'${value}` : value;

  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replaceAll('"', '""')}"`;
  }

  return guarded;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvPrimitive[])[]): string {
  const allRows = [headers, ...rows];
  const body = allRows.map((row) => row.map(sanitizeCsvCell).join(',')).join('\r\n');
  return `${UTF8_BOM}${body}\r\n`;
}
