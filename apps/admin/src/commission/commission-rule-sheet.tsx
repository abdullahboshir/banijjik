"use client";

import { ERROR_CODE, type CurrencyCode, type OfferingKind } from "@banijjik/contracts";
import {
  COMMISSION_API_MESSAGE_KEYS,
  type CommissionRuleResponse,
} from "@banijjik/contracts/commission";
import { Button, Sheet, SheetContent } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { knownMessageKeyOrInternal, type FieldErrors } from "../auth/field-errors";
import { mapApiError, type FormMessage } from "../auth/map-api-error";
import { ApiError } from "../lib/api/api-error";
import { ConflictNotice } from "../settings/conflict-notice";
import { NO_FAILURE, type FormFailure } from "../settings/form-failure";
import { createCommissionRule, updateCommissionRule } from "./commission-api";
import type { CommissionMemberOption, CommissionNamedOption } from "./commission-lookups";
import { CalculationFields } from "./commission-rule-amount-fields";
import {
  buildCommissionRuleCreate,
  buildCommissionRuleUpdate,
  COMMISSION_RULE_FORM_NAMES,
  emptyRuleForm,
  ruleFormFromRule,
  type CommissionRuleFormState,
} from "./commission-rule-form";
import { SubjectFields } from "./commission-rule-subject-fields";
import { TargetFields } from "./commission-rule-target-fields";

export interface CommissionRuleSheetProps {
  organizationId: string;
  currency: CurrencyCode;
  members: readonly CommissionMemberOption[];
  roles: readonly CommissionNamedOption[];
  categories: readonly CommissionNamedOption[];
  offerings: readonly CommissionNamedOption[];
  kinds: readonly OfferingKind[];
  /** Present when editing; then the slot (who and what) is shown but fixed. */
  rule?: CommissionRuleResponse | undefined;
  subjectLabel?: string | undefined;
  targetLabel?: string | undefined;
  onClose: () => void;
}

function refusalOf(error: ApiError): FormFailure {
  if (error.code === ERROR_CODE.CONFLICT) {
    // A duplicate rule is a 409 too, but the person can fix it in the form; only a stale record is a reload.
    if (error.messageKey === COMMISSION_API_MESSAGE_KEYS.ruleDuplicate) {
      return {
        ...NO_FAILURE,
        formMessage: { messageKey: knownMessageKeyOrInternal(error.messageKey) },
      };
    }
    return { ...NO_FAILURE, isConflict: true };
  }
  const mapped = mapApiError(error, COMMISSION_RULE_FORM_NAMES);
  return {
    ...NO_FAILURE,
    fieldErrors: mapped.fieldErrors,
    ...(mapped.formMessage ? { formMessage: mapped.formMessage } : {}),
  };
}

function translatedMessage(
  message: FormMessage | undefined,
  translate: (key: string, values?: Record<string, string | number>) => string,
): string | undefined {
  return message === undefined ? undefined : translate(message.messageKey, message.values);
}

interface RuleFormController {
  form: CommissionRuleFormState;
  errors: FieldErrors;
  failure: FormFailure;
  isSaving: boolean;
  patch: (changes: Partial<CommissionRuleFormState>) => void;
  submit: () => Promise<void>;
}

function useCommissionRuleForm(props: CommissionRuleSheetProps): RuleFormController {
  const router = useRouter();
  const { rule } = props;
  const [form, setForm] = useState<CommissionRuleFormState>(() =>
    rule === undefined ? emptyRuleForm() : ruleFormFromRule(rule),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  const [isSaving, setIsSaving] = useState(false);

  function patch(changes: Partial<CommissionRuleFormState>): void {
    setForm((current) => ({ ...current, ...changes }));
  }

  async function send(write: () => Promise<unknown>): Promise<void> {
    setErrors({});
    setFailure(NO_FAILURE);
    setIsSaving(true);
    try {
      await write();
      props.onClose();
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const refused = refusalOf(error);
      setErrors(refused.fieldErrors);
      setFailure(refused);
      setIsSaving(false);
    }
  }

  async function submit(): Promise<void> {
    if (rule === undefined) {
      const built = buildCommissionRuleCreate(form, props.currency);
      if (!built.ok) {
        setErrors(built.errors);
        return;
      }
      await send(() => createCommissionRule(props.organizationId, built.body));
      return;
    }
    const built = buildCommissionRuleUpdate(form, props.currency, rule.version);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    await send(() => updateCommissionRule(props.organizationId, rule.commissionRuleId, built.body));
  }

  return { form, errors, failure, isSaving, patch, submit };
}

function LockedSlotSummary(props: {
  subjectLabel?: string | undefined;
  targetLabel?: string | undefined;
}): ReactElement {
  const { t } = useTranslator();
  return (
    <section className="flex flex-col gap-1 rounded-md bg-subtle p-3 text-small text-secondary">
      <p>
        {`${t("commission.rule.subject")}: ${props.subjectLabel ?? t("commission.rule.unknown")}`}
      </p>
      <p>
        {`${t("commission.rule.target")}: ${props.targetLabel ?? t("commission.rule.unknown")}`}
      </p>
      <p>{t("commission.rule.form.editLocked")}</p>
    </section>
  );
}

function RuleSlotFields(props: {
  sheet: CommissionRuleSheetProps;
  controller: RuleFormController;
}): ReactElement {
  const { sheet, controller } = props;
  if (sheet.rule !== undefined) {
    return <LockedSlotSummary subjectLabel={sheet.subjectLabel} targetLabel={sheet.targetLabel} />;
  }
  return (
    <>
      <SubjectFields
        form={controller.form}
        members={sheet.members}
        roles={sheet.roles}
        errors={controller.errors}
        onPatch={controller.patch}
      />
      <TargetFields
        form={controller.form}
        categories={sheet.categories}
        offerings={sheet.offerings}
        kinds={sheet.kinds}
        errors={controller.errors}
        onPatch={controller.patch}
      />
    </>
  );
}

/** Creates or edits one commission rule; the percent is typed as a percent and sent as basis points. */
export function CommissionRuleSheet(props: CommissionRuleSheetProps): ReactElement {
  const { t } = useTranslator();
  const router = useRouter();
  const controller = useCommissionRuleForm(props);
  const { form, errors, failure } = controller;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void controller.submit();
  }

  const formMessage = translatedMessage(failure.formMessage, t);
  const titleKey =
    props.rule === undefined
      ? "commission.rule.form.createTitle"
      : "commission.rule.form.editTitle";
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent title={t(titleKey)} closeLabel={t("commission.rule.form.close")}>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <RuleSlotFields sheet={props} controller={controller} />
          <CalculationFields
            form={form}
            currency={props.currency}
            errors={errors}
            onPatch={controller.patch}
          />
          {failure.isConflict ? (
            <ConflictNotice
              message={t("commission.rules.conflict")}
              reloadLabel={t("commission.rules.reload")}
              onReload={() => router.refresh()}
            />
          ) : null}
          {formMessage === undefined ? null : (
            <p role="alert" className="text-small text-danger">
              {formMessage}
            </p>
          )}
          <Button type="submit" isLoading={controller.isSaving}>
            {t("commission.rule.form.submit")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
