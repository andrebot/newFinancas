// CSV utility: RFC 4180 text from rows, for the audit-log export (FR-7.2) and
// the transactions export later (FR-6.4). Pure; no knowledge of any domain.

/** One CSV column: its header and how to read it from a row. */
export interface CsvColumn<Row> {
  readonly header: string;
  readonly value: (row: Row) => string | number | null | undefined;
}

const LINE_BREAK = '\r\n';
const NEEDS_QUOTES = /[",\r\n]/;
// A cell starting with one of these runs as a formula in spreadsheet apps (OWASP).
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Makes one cell safe: neutralises spreadsheet formulas, then quotes it if needed.
 *
 * @param raw - The value; null/undefined become an empty cell.
 * @returns The encoded cell.
 */
export const encodeCell = (raw: string | number | null | undefined): string => {
  const text = raw === null || raw === undefined ? '' : String(raw);
  const safe = typeof raw === 'string' && FORMULA_START.test(text) ? `'${text}` : text;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

/**
 * Builds a CSV document: a header line, then one line per row, CRLF-separated.
 *
 * @param columns - Columns in order.
 * @param rows - The rows.
 * @returns The CSV text, ending with a line break.
 */
export const toCsv = <Row>(columns: readonly CsvColumn<Row>[], rows: readonly Row[]): string => [
  columns.map((column) => encodeCell(column.header)),
  ...rows.map((row) => columns.map((column) => encodeCell(column.value(row)))),
].map((cells) => cells.join(',')).join(LINE_BREAK) + LINE_BREAK;
