"use client";

import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { updateSettings } from "../lib/api/tenant-config-api";
import { SettingsSelect } from "../settings/settings-select";
import { SettingsTextField } from "../settings/settings-text-field";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit, type SheetSendResult } from "../settings/use-sheet-submit";
import type { SettingSheetLabels } from "./setting-labels";
import type { SettingRowView } from "./setting-rows";
import { parseSettingText } from "@banijjik/web-client";

export interface SettingEditSheetProps {
  organizationId: string;
  setting: SettingRowView;
  labels: SettingSheetLabels;
  onClose: () => void;
}

const VALUE_FIELD = "value";
const RESET_ACTION = "reset";
const INVALID_VALUE_KEY = "validation.invalid_value";

function ValueInput({
  setting,
  labels,
  text,
  errorKey,
  onChange,
}: {
  setting: SettingRowView;
  labels: SettingSheetLabels;
  text: string;
  errorKey: string | undefined;
  onChange: (text: string) => void;
}): ReactElement {
  if (setting.options.length > 0) {
    return (
      <SettingsSelect
        fieldId="setting-value"
        label={setting.label}
        value={text}
        options={setting.options}
        onChange={onChange}
      />
    );
  }
  return (
    <SettingsTextField
      fieldId="setting-value"
      label={`${setting.label} · ${labels.valueField}`}
      value={text}
      hint={setting.description}
      errorKey={errorKey}
      onChange={onChange}
    />
  );
}

/**
 * Changes or resets one setting at one level (the business, or one location). The version of the stored
 * row goes with the request; a stale one is a 409 with a reload hint. Loaded on the first tap of "Change".
 */
export function SettingEditSheet(props: SettingEditSheetProps): ReactElement {
  const { organizationId, setting, labels } = props;
  const [text, setText] = useState(setting.initialText);

  async function send(action: string): Promise<SheetSendResult> {
    const value = action === RESET_ACTION ? null : parseSettingText(setting.spec, text);
    if (value === undefined)
      return { ok: false, fieldErrors: { [VALUE_FIELD]: INVALID_VALUE_KEY } };
    await updateSettings(organizationId, [
      {
        settingKey: setting.settingKey,
        value,
        ...(setting.locationId === undefined ? {} : { locationId: setting.locationId }),
        ...(setting.version === undefined ? {} : { version: setting.version }),
      },
    ]);
    return { ok: true };
  }

  const state = useSheetSubmit({ fieldNames: [VALUE_FIELD], onClose: props.onClose, send });
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={setting.label} closeLabel={labels.close}>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <ValueInput
            setting={setting}
            labels={labels}
            text={text}
            errorKey={state.errors[VALUE_FIELD]}
            onChange={setText}
          />
          <SheetFeedback state={state} conflict={labels.conflict} reload={labels.reload} />
          <Button type="submit" isLoading={state.isSaving}>
            {labels.save}
          </Button>
          {setting.canReset ? (
            <Button variant="secondary" onClick={() => void state.submit(RESET_ACTION)}>
              {labels.reset}
            </Button>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}
