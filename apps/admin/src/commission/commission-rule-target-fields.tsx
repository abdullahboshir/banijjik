"use client";

import type { OfferingKind } from "@banijjik/contracts";
import { COMMISSION_TARGET_TYPE, type CommissionTargetType } from "@banijjik/contracts/commission";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import type { FieldErrors } from "../auth/field-errors";
import type { CommissionNamedOption } from "./commission-lookups";
import { ChoiceField, Options } from "./commission-rule-choice";
import type { CommissionRuleFormState } from "./commission-rule-form";

type Patch = (changes: Partial<CommissionRuleFormState>) => void;

function KindField(props: {
  form: CommissionRuleFormState;
  kinds: readonly OfferingKind[];
  errors: FieldErrors;
  onPatch: Patch;
}): ReactElement {
  const { t } = useTranslator();
  return (
    <ChoiceField
      id="commission-rule-kind"
      label={t("commission.rule.form.kind")}
      value={props.form.offeringKind}
      errorKey={props.errors["offeringKind"]}
      isRequired
      onChange={(offeringKind) =>
        props.onPatch({ offeringKind: offeringKind as OfferingKind | "" })
      }
    >
      <option value="">{t("commission.rule.form.chooseKind")}</option>
      {props.kinds.map((kind) => (
        <option key={kind} value={kind}>
          {t(`catalog.kind.${kind}`)}
        </option>
      ))}
    </ChoiceField>
  );
}

function CategoryField(props: {
  form: CommissionRuleFormState;
  categories: readonly CommissionNamedOption[];
  errors: FieldErrors;
  onPatch: Patch;
}): ReactElement {
  const { t } = useTranslator();
  return (
    <ChoiceField
      id="commission-rule-category"
      label={t("commission.rule.form.category")}
      value={props.form.categoryId}
      errorKey={props.errors["categoryId"]}
      isRequired
      onChange={(categoryId) => props.onPatch({ categoryId })}
    >
      <Options placeholder={t("commission.rule.form.chooseCategory")} options={props.categories} />
    </ChoiceField>
  );
}

function OfferingField(props: {
  form: CommissionRuleFormState;
  offerings: readonly CommissionNamedOption[];
  errors: FieldErrors;
  onPatch: Patch;
}): ReactElement {
  const { t } = useTranslator();
  return (
    <ChoiceField
      id="commission-rule-offering"
      label={t("commission.rule.form.offering")}
      value={props.form.offeringId}
      errorKey={props.errors["offeringId"]}
      isRequired
      onChange={(offeringId) => props.onPatch({ offeringId })}
    >
      <Options placeholder={t("commission.rule.form.chooseOffering")} options={props.offerings} />
    </ChoiceField>
  );
}

function TargetTypeField(props: { form: CommissionRuleFormState; onPatch: Patch }): ReactElement {
  const { t } = useTranslator();
  return (
    <ChoiceField
      id="commission-rule-target-type"
      label={t("commission.rule.form.targetType")}
      value={props.form.targetType}
      errorKey={undefined}
      isRequired
      onChange={(value) =>
        props.onPatch({
          targetType: value as CommissionTargetType,
          offeringKind: "",
          categoryId: "",
          offeringId: "",
        })
      }
    >
      <option value={COMMISSION_TARGET_TYPE.ALL}>{t("commission.rule.form.targetAll")}</option>
      <option value={COMMISSION_TARGET_TYPE.KIND}>{t("commission.rule.form.targetKind")}</option>
      <option value={COMMISSION_TARGET_TYPE.CATEGORY}>
        {t("commission.rule.form.targetCategory")}
      </option>
      <option value={COMMISSION_TARGET_TYPE.OFFERING}>
        {t("commission.rule.form.targetOffering")}
      </option>
    </ChoiceField>
  );
}

export function TargetFields(props: {
  form: CommissionRuleFormState;
  categories: readonly CommissionNamedOption[];
  offerings: readonly CommissionNamedOption[];
  kinds: readonly OfferingKind[];
  errors: FieldErrors;
  onPatch: Patch;
}): ReactElement {
  const { form, errors, onPatch } = props;
  return (
    <>
      <TargetTypeField form={form} onPatch={onPatch} />
      {form.targetType === COMMISSION_TARGET_TYPE.KIND ? (
        <KindField form={form} kinds={props.kinds} errors={errors} onPatch={onPatch} />
      ) : null}
      {form.targetType === COMMISSION_TARGET_TYPE.CATEGORY ? (
        <CategoryField
          form={form}
          categories={props.categories}
          errors={errors}
          onPatch={onPatch}
        />
      ) : null}
      {form.targetType === COMMISSION_TARGET_TYPE.OFFERING ? (
        <OfferingField form={form} offerings={props.offerings} errors={errors} onPatch={onPatch} />
      ) : null}
    </>
  );
}
