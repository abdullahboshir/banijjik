"use client";

import type { IndustryTemplateUpdateBody } from "@banijjik/validation";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement } from "react";
import type { IndustryLabels } from "./industry-labels";
import type { TemplateReasonSheetProps } from "./template-reason-sheet";

export type TemplatePatch = Omit<IndustryTemplateUpdateBody, "reason" | "version">;

interface PendingSave {
  title: string;
  submitLabel: string;
  successMessage: string;
  save: (reason: string) => Promise<unknown>;
}

async function loadSheet(): Promise<ComponentType<TemplateReasonSheetProps>> {
  const sheetModule = await import("./template-reason-sheet");
  return sheetModule.TemplateReasonSheet;
}

/** Opens the lazy reason sheet for one section save, publish or retire. */
export function useTemplateSave(
  labels: IndustryLabels,
  saveWithReason: (reason: string, patch: TemplatePatch | undefined) => Promise<unknown>,
): {
  requestSave: (pending: Omit<PendingSave, "save"> & { patch?: TemplatePatch }) => void;
  sheet: ReactElement | null;
} {
  const [pending, setPending] = useState<PendingSave | undefined>();
  const Sheet = useLazyComponent(loadSheet, pending !== undefined);

  function requestSave(
    next: Omit<PendingSave, "save"> & {
      patch?: TemplatePatch;
      save?: (reason: string) => Promise<unknown>;
    },
  ): void {
    const save = next.save ?? ((reason: string) => saveWithReason(reason, next.patch));
    setPending({
      title: next.title,
      submitLabel: next.submitLabel,
      successMessage: next.successMessage,
      save,
    });
  }

  const sheet =
    Sheet && pending ? (
      <Sheet
        title={pending.title}
        submitLabel={pending.submitLabel}
        successMessage={pending.successMessage}
        labels={labels}
        save={pending.save}
        onClose={() => setPending(undefined)}
      />
    ) : null;

  return { requestSave, sheet };
}
