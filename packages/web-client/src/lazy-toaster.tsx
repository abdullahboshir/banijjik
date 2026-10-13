"use client";

import type { ComponentType } from "react";
import { useEffect, useState, type ReactElement } from "react";

type ToasterComponent = ComponentType<{ label: string }>;

/**
 * Loads the toast library after first paint so it stays out of the initial JS budget (13-UX section 11).
 * It is a plain dynamic import in an effect, so the server render is unchanged (server rendering stays on, ADR-010).
 */
export function LazyToaster({ label }: { label: string }): ReactElement | null {
  const [Toaster, setToaster] = useState<ToasterComponent | null>(null);

  useEffect(() => {
    async function loadToaster(): Promise<void> {
      const toastModule = await import("@banijjik/ui/toast");
      setToaster(() => toastModule.Toaster);
    }
    void loadToaster();
  }, []);

  return Toaster ? <Toaster label={label} /> : null;
}
