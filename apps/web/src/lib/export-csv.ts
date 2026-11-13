/** Quotes a cell and defuses spreadsheet formulas (=, +, -, @ at the start). */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Byte order mark, so spreadsheet apps read the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/** Downloads rows as a CSV file built in the browser. */
export function downloadCsv(filename: string, header: readonly string[], rows: readonly (readonly unknown[])[]): void {
  const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Downloads text the server made (e.g. a chat export) as a file. */
export function downloadText(filename: string, content: string, contentType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${contentType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
