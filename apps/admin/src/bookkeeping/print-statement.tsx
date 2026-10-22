"use client";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
export function PrintStatement({ label }: { label: string }): ReactElement {
  return (
    <Button variant="secondary" className="print:hidden" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
