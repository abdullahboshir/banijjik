/** Spreadsheets read a leading byte-order mark as UTF-8, so Bengali text opens correctly. */
const UTF8_BYTE_ORDER_MARK = "\uFEFF";
const FORMULA_START_PATTERN = /^[=+\-@\t\r]/u;
const NEEDS_QUOTES_PATTERN = /[",\r\n]/u;

/**
 * One CSV cell. A text that a spreadsheet would run as a formula (starting with = + - @) gets a leading
 * apostrophe, so a location name cannot become a formula when the file is opened.
 */
export function csvCell(value: string | number): string {
  const text = typeof value === "number" ? String(value) : value;
  const safeText =
    typeof value === "string" && FORMULA_START_PATTERN.test(text) ? `'${text}` : text;
  if (!NEEDS_QUOTES_PATTERN.test(safeText)) return safeText;
  return `"${safeText.replace(/"/gu, '""')}"`;
}

/** The whole file: a header line and one line per row, CRLF-separated as RFC 4180 asks. */
export function buildCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const lines = [header, ...rows].map((cells) => cells.map(csvCell).join(","));
  return `${UTF8_BYTE_ORDER_MARK}${lines.join("\r\n")}\r\n`;
}
