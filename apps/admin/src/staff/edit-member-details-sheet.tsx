"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { CustomFieldsSection } from "../custom-fields/custom-fields-section";
import {
  useCustomFieldsForm,
  type CustomFieldsFormProps,
} from "../custom-fields/use-custom-fields-form";
import { ApiError } from "../lib/api/api-error";
import { updateMember } from "../lib/api/organization-api";

export interface EditMemberDetailsLabels {
  title: string;
  close: string;
  save: string;
  conflict: string;
  reload: string;
}

export interface EditMemberDetailsSheetProps {
  organizationId: string;
  memberId: string;
  /** The version the page was drawn from; a stale one is refused with a 409. */
  version: number;
  customFields: CustomFieldsFormProps;
  labels: EditMemberDetailsLabels;
  onClose: () => void;
}

interface Refusal {
  isConflict: boolean;
  messageKey: string | undefined;
}

const NO_REFUSAL: Refusal = { isConflict: false, messageKey: undefined };

function refusalOf(error: ApiError): Refusal {
  if (error.code === ERROR_CODE.CONFLICT) return { isConflict: true, messageKey: undefined };
  // A refusal that names fields is shown on them; any other one is shown under the form.
  if (error.code === ERROR_CODE.VALIDATION_ERROR) return NO_REFUSAL;
  return { isConflict: false, messageKey: knownMessageKeyOrInternal(error.messageKey) };
}

function Refused({
  refusal,
  labels,
  onReload,
}: {
  refusal: Refusal;
  labels: EditMemberDetailsLabels;
  onReload: () => void;
}): ReactElement | null {
  const { t } = useTranslator();
  if (refusal.isConflict) {
    return (
      <div role="alert" className="flex flex-col gap-2 text-small text-danger">
        <p>{labels.conflict}</p>
        <Button variant="secondary" onClick={onReload}>
          {labels.reload}
        </Button>
      </div>
    );
  }
  if (refusal.messageKey === undefined) return null;
  return (
    <p role="alert" className="text-small text-danger">
      {t(refusal.messageKey)}
    </p>
  );
}

/** The member's extra details (NID, blood group, emergency contact, ...) as a form; loaded on the first tap of "Edit details". */
export function EditMemberDetailsSheet(props: EditMemberDetailsSheetProps): ReactElement {
  const { organizationId, memberId, labels, onClose } = props;
  const router = useRouter();
  const form = useCustomFieldsForm(props.customFields);
  const [refusal, setRefusal] = useState<Refusal>(NO_REFUSAL);
  const [isSaving, setIsSaving] = useState(false);

  async function save(): Promise<void> {
    const request = form.buildRequest();
    setRefusal(NO_REFUSAL);
    if (!request.ok) return;
    if (Object.keys(request.customFields).length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      await updateMember(organizationId, memberId, {
        customFields: request.customFields,
        version: props.version,
      });
      onClose();
      router.refresh();
      return;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      form.showRefusal(error.details);
      setRefusal(refusalOf(error));
    }
    setIsSaving(false);
  }

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent title={labels.title} closeLabel={labels.close}>
        <CustomFieldsSection idPrefix="member-custom" props={props.customFields} form={form} />
        <Refused refusal={refusal} labels={labels} onReload={() => router.refresh()} />
        <Button isLoading={isSaving} onClick={() => void save()}>
          {labels.save}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
