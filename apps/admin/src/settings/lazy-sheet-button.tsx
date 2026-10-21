"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import { Button } from "@banijjik/ui";
import { useEffect, useState, type ComponentType, type ReactElement } from "react";

export interface LazySheetButtonProps<Props extends { onClose: () => void }> {
  label: string;
  variant?: "primary" | "secondary";
  /** Imports the sheet's module on the first tap, so its code stays out of the route's first load. */
  load: () => Promise<ComponentType<Props>>;
  sheetProps: Omit<Props, "onClose">;
  /**
   * Opens the sheet from outside (the booking calendar taps a free slot and expects the seeded
   * sheet to appear, plan 3.6 item 9): every increase of this counter reveals the sheet once.
   */
  revealSignal?: number;
}

/** A button that opens a form sheet; the sheet and its code load on the first tap (13-UX section 11). */
export function LazySheetButton<Props extends { onClose: () => void }>(
  props: LazySheetButtonProps<Props>,
): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const Sheet = useLazyComponent(props.load, isOpen);
  useEffect(() => {
    if (props.revealSignal !== undefined && props.revealSignal > 0) setIsOpen(true);
  }, [props.revealSignal]);
  // Safe: the sheet gets its own props plus the close handler this component owns.
  const sheetProps = { ...props.sheetProps, onClose: () => setIsOpen(false) } as Props;
  return (
    <>
      <Button variant={props.variant ?? "primary"} onClick={() => setIsOpen(true)}>
        {props.label}
      </Button>
      {Sheet && isOpen ? <Sheet {...sheetProps} /> : null}
    </>
  );
}
