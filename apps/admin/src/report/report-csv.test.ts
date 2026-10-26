import { describe, expect, it } from "vitest";
import { buildCsv, csvCell } from "./report-csv";

describe("report CSV", () => {
  it("quotes a cell that holds a comma, a quote or a line break", () => {
    expect(csvCell("Gulshan, branch")).toBe('"Gulshan, branch"');
    expect(csvCell('the "main" shop')).toBe('"the ""main"" shop"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it("writes a number as it is, without quotes", () => {
    expect(csvCell(12_500)).toBe("12500");
  });

  it("starts a text that a spreadsheet would run as a formula with an apostrophe", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+880")).toBe("'+880");
  });

  it("builds a UTF-8 file with a byte-order mark, a header and one CRLF line per row", () => {
    const file = buildCsv(["date", "net"], [["2026-10-25", 500]]);
    expect(file.startsWith("﻿")).toBe(true);
    expect(file.slice(1)).toBe("date,net\r\n2026-10-25,500\r\n");
  });

  it("keeps Bengali text as it is", () => {
    expect(csvCell("গুলশান শাখা")).toBe("গুলশান শাখা");
  });
});
