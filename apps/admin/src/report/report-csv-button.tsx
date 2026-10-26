"use client";

import { buttonVariants } from "@banijjik/ui";
import type { ReactElement } from "react";
import { buildCsv } from "./report-csv";

export interface ReportCsvButtonProps {
  label: string;
  fileName: string;
  header: readonly string[];
  /** The rows the page shows, as text or numbers; the file holds exactly these. */
  rows: readonly (readonly (string | number)[])[];
}

/** Builds the CSV in the browser from the shown rows and starts the download (no server round trip). */
export function ReportCsvButton(props: ReportCsvButtonProps): ReactElement {
  const { label, fileName, header, rows } = props;
  function download(): void {
    const file = new Blob([buildCsv(header, rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={download}
      className={`${buttonVariants({ variant: "secondary" })} min-h-11`}
    >
      {label}
    </button>
  );
}
