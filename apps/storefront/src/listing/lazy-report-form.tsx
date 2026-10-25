"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import type { ReportFormProps } from "./report-form";

/** The report form loads when a signed-in visitor opens it on a listing page (M.6 C8). */
const ReportFormLazy = dynamic(async () => (await import("./report-form")).ReportForm, {
  loading: () => <p className="text-body text-secondary">…</p>,
});

export function LazyReportForm(props: ReportFormProps): ReactElement {
  return <ReportFormLazy {...props} />;
}
