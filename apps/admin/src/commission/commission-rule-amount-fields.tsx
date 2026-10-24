"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import { COMMISSION_CALCULATION, type CommissionCalculation } from "@banijjik/contracts/commission";
import { currencySymbolOf } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import type { ReactElement } from "react";
import type { FieldErrors } from "../auth/field-errors";
import { SettingsTextField } from "../settings/settings-text-field";
import { ChoiceField } from "./commission-rule-choice";
import type { CommissionRuleFormState } from "./commission-rule-form";

const PERCENT = COMMISSION_CALCULATION.PERCENT;

export function CalculationFields(props: {
  form: CommissionRuleFormState;
  currency: CurrencyCode;
  errors: FieldErrors;
  onPatch: (changes: Partial<CommissionRuleFormState>) => void;
}): ReactElement {
  const { t } = useTranslator();
  const { form, currency, errors, onPatch } = props;
  const isPercent = form.calculation === PERCENT;
  return (
    <>
      <ChoiceField
        id="commission-rule-calculation"
        label={t("commission.rule.form.calculation")}
        value={form.calculation}
        errorKey={undefined}
        isRequired
        onChange={(value) =>
          onPatch({ calculation: value as CommissionCalculation, percentText: "", fixedText: "" })
        }
      >
        <option value={COMMISSION_CALCULATION.PERCENT}>
          {t("commission.calculation.PERCENT")}
        </option>
        <option value={COMMISSION_CALCULATION.FIXED}>{t("commission.calculation.FIXED")}</option>
      </ChoiceField>
      {isPercent ? (
        <SettingsTextField
          fieldId="commission-rule-percent"
          label={t("commission.rule.form.percent")}
          hint={t("commission.rule.form.percentHint")}
          value={form.percentText}
          errorKey={errors["percentBasisPoints"]}
          inputMode="decimal"
          autoComplete="off"
          isRequired
          onChange={(percentText) => onPatch({ percentText })}
        />
      ) : (
        <SettingsTextField
          fieldId="commission-rule-fixed"
          label={`${t("commission.rule.form.fixed")} (${currencySymbolOf(currency)})`}
          value={form.fixedText}
          errorKey={errors["fixedAmount"]}
          inputMode="decimal"
          autoComplete="off"
          isRequired
          onChange={(fixedText) => onPatch({ fixedText })}
        />
      )}
    </>
  );
}
