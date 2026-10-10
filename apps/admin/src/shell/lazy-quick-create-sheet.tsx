"use client";

import type { QuickCreateSheetProps } from "@banijjik/ui";
import { useEffect, useState, type ComponentType, type ReactElement } from "react";

type SheetComponent = ComponentType<QuickCreateSheetProps>;

/**
 * The sheet (Radix dialog, focus trap, scroll lock) is only needed after a tap, so its code is fetched
 * on the first open and stays out of the initial JS budget (13-UX section 11). Server rendering stays on (ADR-010):
 * a closed sheet renders nothing on the server anyway.
 */
export function LazyQuickCreateSheet(props: QuickCreateSheetProps): ReactElement | null {
  const [Sheet, setSheet] = useState<SheetComponent | null>(null);
  const { open } = props;

  useEffect(() => {
    if (!open || Sheet) return;
    async function loadSheet(): Promise<void> {
      const uiModule = await import("@banijjik/ui");
      setSheet(() => uiModule.QuickCreateSheet);
    }
    void loadSheet();
  }, [open, Sheet]);

  return Sheet ? <Sheet {...props} /> : null;
}
