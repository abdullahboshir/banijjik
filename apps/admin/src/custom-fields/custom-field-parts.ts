import type { EffectiveCustomField } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import type { CustomFieldDetailListProps } from "./custom-field-detail-list";
import { detailRowsOf } from "./custom-field-display";
import type { CustomFieldsFormProps } from "./use-custom-fields-form";

export interface CustomFieldPartsInput {
  /** The effective fields of the entity, from `/me/config.fields`. */
  fields: readonly EffectiveCustomField[];
  /** The values the API returned; redacted ones are absent. */
  values: Record<string, unknown>;
  /** Whether the API showed this person sensitive values (ADR-107). */
  canSeeSensitive: boolean;
  translator: Translator;
  timeZone: string;
  currencyCode: string;
}

export interface CustomFieldParts {
  list: CustomFieldDetailListProps;
  form: CustomFieldsFormProps;
}

/** The read-only list and the edit sheet's props for the "Additional details" of one entity, built on the server. */
export function customFieldPartsOf(input: CustomFieldPartsInput): CustomFieldParts {
  const { translator, fields, values, canSeeSensitive } = input;
  const { t, locale } = translator;
  return {
    list: {
      title: t("customFields.title"),
      help: t("customFields.detail.help"),
      rows: detailRowsOf({
        fields,
        values,
        canSeeSensitive,
        locale,
        timeZone: input.timeZone,
        currencyCode: input.currencyCode,
        t,
      }),
      notSetLabel: t("profile.notSet"),
      hiddenLabel: t("customFields.hidden"),
    },
    form: {
      fields: [...fields],
      stored: values,
      canSeeSensitive,
      currencyCode: input.currencyCode,
      title: t("customFields.title"),
      hiddenHint: t("customFields.hiddenHint"),
    },
  };
}
