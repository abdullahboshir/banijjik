"use client";

import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { switchModule } from "../lib/api/tenant-config-api";
import { SettingsTextField } from "../settings/settings-text-field";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit, type SheetSendResult } from "../settings/use-sheet-submit";
import type { ModuleSheetLabels } from "./module-labels";
import type { ModuleRowView } from "./module-rows";

export interface ModuleSwitchSheetProps {
  organizationId: string;
  module: ModuleRowView;
  labels: ModuleSheetLabels;
  onClose: () => void;
}

const REASON_FIELD = "reason";
const REASON_MAX_LENGTH = 200;
const REQUIRED_KEY = "validation.required";
const TOO_LONG_KEY = "validation.too_big";

/** Turns a module off or on again, with the reason the audit log keeps (1 to 200 characters). */
export function ModuleSwitchSheet(props: ModuleSwitchSheetProps): ReactElement {
  const { organizationId, module, labels } = props;
  const [reason, setReason] = useState("");
  const action = module.action ?? "disable";

  async function send(): Promise<SheetSendResult> {
    const trimmed = reason.trim();
    if (trimmed.length === 0) return { ok: false, fieldErrors: { [REASON_FIELD]: REQUIRED_KEY } };
    if (trimmed.length > REASON_MAX_LENGTH) {
      return { ok: false, fieldErrors: { [REASON_FIELD]: TOO_LONG_KEY } };
    }
    await switchModule({ organizationId, moduleKey: module.moduleKey, action, reason: trimmed });
    return { ok: true };
  }

  const state = useSheetSubmit({ fieldNames: [REASON_FIELD], onClose: props.onClose, send });
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }
  const title = action === "disable" ? labels.turnOffTitle : labels.turnOnTitle;
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={`${title}: ${module.label}`} closeLabel={labels.close}>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <SettingsTextField
            fieldId="module-reason"
            label={labels.reason}
            hint={labels.reasonHint}
            value={reason}
            errorKey={state.errors[REASON_FIELD]}
            isRequired
            onChange={setReason}
          />
          <SheetFeedback state={state} conflict={labels.conflict} reload={labels.reload} />
          <Button
            type="submit"
            variant={action === "disable" ? "danger" : "primary"}
            isLoading={state.isSaving}
          >
            {action === "disable" ? labels.turnOff : labels.turnOn}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
