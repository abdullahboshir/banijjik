"use client";

import { PLATFORM_ROLE, type PlatformRole } from "@banijjik/contracts";
import {
  platformOperatorCreateRequestSchema,
  platformOperatorUpdateRequestSchema,
} from "@banijjik/validation";
import { useTranslator } from "@banijjik/web-client/client";
import { Checkbox, FormField } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { changeOperatorRoles, grantOperator } from "../api/platform-api";
import { FormSheet } from "../forms/form-sheet";
import { ReasonField } from "../forms/reason-field";
import { issuesToFieldErrors, type FieldErrors } from "../forms/schema-errors";
import { TextFieldRow } from "../forms/text-field-row";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import {
  OPERATOR_ROLE_LABEL_KEY,
  OPERATOR_ROLE_ORDER,
  type OperatorLabels,
} from "./operator-action-rules";

export type OperatorFormTarget =
  | { kind: "create" }
  | {
      kind: "roles";
      platformOperatorId: string;
      version: number;
      platformRoles: readonly PlatformRole[];
    };

export interface OperatorFormSheetProps {
  target: OperatorFormTarget;
  labels: OperatorLabels;
  onClose: () => void;
}

type RoleChecks = Record<PlatformRole, boolean>;

function checksFrom(roles: readonly PlatformRole[]): RoleChecks {
  return {
    [PLATFORM_ROLE.SUPER_ADMIN]: roles.includes(PLATFORM_ROLE.SUPER_ADMIN),
    [PLATFORM_ROLE.SUPPORT]: roles.includes(PLATFORM_ROLE.SUPPORT),
    [PLATFORM_ROLE.BILLING]: roles.includes(PLATFORM_ROLE.BILLING),
  };
}

function selectedRoles(checks: RoleChecks): PlatformRole[] {
  return OPERATOR_ROLE_ORDER.filter((role) => checks[role]);
}

function errorsFor(
  success: boolean,
  issues: Parameters<typeof issuesToFieldErrors>[0] | undefined,
  values: Readonly<Record<string, unknown>>,
): FieldErrors {
  return success || issues === undefined ? {} : issuesToFieldErrors(issues, values);
}

function RoleChecksField({
  checks,
  errorKey,
  labels,
  onToggle,
}: {
  checks: RoleChecks;
  errorKey: string | undefined;
  labels: OperatorLabels;
  onToggle: (role: PlatformRole, isChecked: boolean) => void;
}): ReactElement {
  const { t } = useTranslator();
  return (
    <FormField
      label={labels["platform.field.operatorRoles"]}
      htmlFor={`role-${OPERATOR_ROLE_ORDER[0]}`}
      hint={labels["platform.field.operatorRolesHint"]}
      error={errorKey ? t(errorKey) : undefined}
      required
    >
      <div className="flex flex-col">
        {OPERATOR_ROLE_ORDER.map((role) => (
          <Checkbox
            key={role}
            id={`role-${role}`}
            label={labels[OPERATOR_ROLE_LABEL_KEY[role]]}
            checked={checks[role]}
            onChange={(event) => onToggle(role, event.target.checked)}
          />
        ))}
      </div>
    </FormField>
  );
}

async function saveForm(input: {
  target: OperatorFormTarget;
  identifier: string;
  checks: RoleChecks;
  reason: string;
  setFieldErrors: (errors: FieldErrors) => void;
  run: ReturnType<typeof useFormSubmit>["run"];
  finish: (message: string) => Promise<void>;
  labels: OperatorLabels;
}): Promise<void> {
  const roles = selectedRoles(input.checks);
  if (input.target.kind === "create") {
    const parsed = platformOperatorCreateRequestSchema.safeParse({
      identifier: input.identifier,
      platformRoles: roles,
      reason: input.reason,
    });
    input.setFieldErrors(
      errorsFor(parsed.success, parsed.error?.issues, {
        identifier: input.identifier,
        platformRoles: roles,
        reason: input.reason,
      }),
    );
    if (!parsed.success) return;
    // The API applies the same schema, so the identifier stays the text the person typed.
    const request = {
      identifier: input.identifier,
      platformRoles: roles,
      reason: input.reason,
    };
    if (await input.run(() => grantOperator(request))) {
      await input.finish(input.labels["platform.sheet.addOperator.success"]);
    }
    return;
  }
  const parsed = platformOperatorUpdateRequestSchema.safeParse({
    platformRoles: roles,
    version: input.target.version,
    reason: input.reason,
  });
  input.setFieldErrors(
    errorsFor(parsed.success, parsed.error?.issues, {
      platformRoles: roles,
      version: input.target.version,
      reason: input.reason,
    }),
  );
  if (!parsed.success) return;
  const platformOperatorId = input.target.platformOperatorId;
  if (await input.run(() => changeOperatorRoles(platformOperatorId, parsed.data))) {
    await input.finish(input.labels["platform.sheet.changeRoles.success"]);
  }
}

function OperatorFormFields(props: {
  isCreate: boolean;
  identifier: string;
  checks: RoleChecks;
  reason: string;
  fieldErrors: FieldErrors;
  labels: OperatorLabels;
  onIdentifier: (value: string) => void;
  onReason: (value: string) => void;
  onToggle: (role: PlatformRole, isChecked: boolean) => void;
}): ReactElement {
  return (
    <>
      {props.isCreate ? (
        <TextFieldRow
          fieldId="operator-identifier"
          label={props.labels["platform.field.operatorIdentifier"]}
          hint={props.labels["platform.field.operatorIdentifierHint"]}
          value={props.identifier}
          errorKey={props.fieldErrors["identifier"]}
          autoComplete="off"
          onChange={props.onIdentifier}
        />
      ) : null}
      <RoleChecksField
        checks={props.checks}
        errorKey={props.fieldErrors["platformRoles"]}
        labels={props.labels}
        onToggle={props.onToggle}
      />
      <ReasonField
        fieldId="operator-reason"
        label={props.labels["platform.field.reason"]}
        hint={props.labels["platform.field.reasonHint"]}
        value={props.reason}
        errorKey={props.fieldErrors["reason"]}
        onChange={props.onReason}
      />
    </>
  );
}

/** Add an operator, or replace the roles of one who is not the caller. */
export function OperatorFormSheet({
  target,
  labels,
  onClose,
}: OperatorFormSheetProps): ReactElement {
  const initialRoles = target.kind === "roles" ? target.platformRoles : [];
  const [identifier, setIdentifier] = useState("");
  const [reason, setReason] = useState("");
  const [checks, setChecks] = useState<RoleChecks>(() => checksFrom(initialRoles));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const submit = useFormSubmit();
  const finish = useFinishAction(onClose);
  const isCreate = target.kind === "create";
  const sheetKey = isCreate ? "addOperator" : "changeRoles";

  function toggleRole(role: PlatformRole, isChecked: boolean): void {
    setChecks((current) => ({ ...current, [role]: isChecked }));
  }

  return (
    <FormSheet
      title={labels[`platform.sheet.${sheetKey}.title`]}
      description={labels[`platform.sheet.${sheetKey}.description`]}
      submitLabel={labels[isCreate ? "platform.action.addOperator" : "platform.action.changeRoles"]}
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() =>
        void saveForm({
          target,
          identifier,
          checks,
          reason,
          setFieldErrors,
          run: submit.run,
          finish,
          labels,
        })
      }
      onClose={onClose}
    >
      <OperatorFormFields
        isCreate={isCreate}
        identifier={identifier}
        checks={checks}
        reason={reason}
        fieldErrors={fieldErrors}
        labels={labels}
        onIdentifier={setIdentifier}
        onReason={setReason}
        onToggle={toggleRole}
      />
    </FormSheet>
  );
}
