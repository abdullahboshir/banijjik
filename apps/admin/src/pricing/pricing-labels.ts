import type { Translator } from "@banijjik/i18n";

/** Texts of the promotions and tax-class screens, read once on the server. */
export const PROMOTION_LABEL_KEYS = [
  "promotions.title",
  "promotions.subtitle",
  "promotions.readOnly",
  "promotions.add",
  "promotions.empty",
  "promotions.name",
  "promotions.priority",
  "promotions.target",
  "promotions.target.ALL",
  "promotions.target.CATEGORY",
  "promotions.category",
  "promotions.benefit",
  "promotions.benefit.PERCENT",
  "promotions.percent",
  "promotions.save",
  "promotions.activate",
  "promotions.archive",
  "promotions.edit",
  "promotions.close",
  "promotions.preview",
  "promotions.preview.offering",
  "promotions.preview.run",
  "promotions.preview.total",
  "promotions.preview.discount",
  "promotions.status.DRAFT",
  "promotions.status.ACTIVE",
  "promotions.status.ARCHIVED",
  "promotions.conflict",
  "promotions.reload",
] as const;

export const TAX_CLASS_LABEL_KEYS = [
  "taxClasses.title",
  "taxClasses.subtitle",
  "taxClasses.readOnly",
  "taxClasses.add",
  "taxClasses.empty",
  "taxClasses.key",
  "taxClasses.keyHint",
  "taxClasses.name",
  "taxClasses.rate",
  "taxClasses.rateHint",
  "taxClasses.save",
  "taxClasses.archive",
  "taxClasses.conflict",
  "taxClasses.reload",
] as const;

export type PromotionLabels = Readonly<Record<(typeof PROMOTION_LABEL_KEYS)[number], string>>;
export type TaxClassLabels = Readonly<Record<(typeof TAX_CLASS_LABEL_KEYS)[number], string>>;

function pick<Key extends string>(
  t: Translator["t"],
  prefix: string,
  keys: readonly Key[],
): Record<Key, string> {
  const entries = keys.map((key) => [key, t(`${prefix}.${key}`)]);
  return Object.fromEntries(entries) as Record<Key, string>;
}

export function promotionLabelsOf(t: Translator["t"]): PromotionLabels {
  return pick(t, "pricing", PROMOTION_LABEL_KEYS);
}

export function taxClassLabelsOf(t: Translator["t"]): TaxClassLabels {
  return pick(t, "pricing", TAX_CLASS_LABEL_KEYS);
}
