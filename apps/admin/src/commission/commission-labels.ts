import type {
  CommissionEntryKind,
  CommissionPayoutMethod,
  CommissionRuleResponse,
  CommissionRuleStatus,
} from "@banijjik/contracts/commission";
import type { Locale, Translator } from "@banijjik/i18n";
import { formatMoney } from "@banijjik/ui";
import { percentTextOf } from "./commission-percent";

/** Names the rule list needs to turn the API's IDs into what a person reads. */
export interface CommissionNameLookups {
  memberNameById: Readonly<Record<string, string>>;
  roleNameById: Readonly<Record<string, string>>;
  categoryNameById: Readonly<Record<string, string>>;
  offeringNameById: Readonly<Record<string, string>>;
}

function nameOf(names: Readonly<Record<string, string>>, id: string | null): string | undefined {
  return id === null ? undefined : names[id];
}

export function subjectTextOf(
  rule: CommissionRuleResponse,
  lookups: CommissionNameLookups,
  t: Translator["t"],
): string {
  const name =
    rule.subjectType === "MEMBER"
      ? nameOf(lookups.memberNameById, rule.memberId)
      : nameOf(lookups.roleNameById, rule.roleId);
  return name ?? t("commission.rule.unknown");
}

export function targetTextOf(
  rule: CommissionRuleResponse,
  lookups: CommissionNameLookups,
  t: Translator["t"],
): string {
  if (rule.targetType === "ALL") return t("commission.rule.target.all");
  if (rule.targetType === "KIND") {
    return rule.offeringKind === null
      ? t("commission.rule.unknown")
      : t(`catalog.kind.${rule.offeringKind}`);
  }
  const name =
    rule.targetType === "CATEGORY"
      ? nameOf(lookups.categoryNameById, rule.categoryId)
      : nameOf(lookups.offeringNameById, rule.offeringId);
  return name ?? t("commission.rule.unknown");
}

/** A percent rule reads "12.5%"; a fixed rule reads its money amount (ADR-013: integer minor units). */
export function rateTextOf(rule: CommissionRuleResponse, locale: Locale): string {
  if (rule.calculation === "PERCENT" && rule.percentBasisPoints !== null) {
    return `${percentTextOf(rule.percentBasisPoints)}%`;
  }
  if (rule.calculation === "FIXED" && rule.fixedAmount !== null) {
    return formatMoney(rule.fixedAmount, { locale });
  }
  return "—";
}

export function ruleStatusLabelOf(status: CommissionRuleStatus, t: Translator["t"]): string {
  return status === "ACTIVE" ? t("commission.status.ACTIVE") : t("commission.status.ARCHIVED");
}

export function entryKindLabelOf(kind: CommissionEntryKind, t: Translator["t"]): string {
  return t(`commission.entries.kind.${kind}`);
}

export function entryStatusLabelOf(payoutId: string | null, t: Translator["t"]): string {
  return payoutId === null
    ? t("commission.entries.status.open")
    : t("commission.entries.status.paid");
}

export function payoutMethodLabelOf(method: CommissionPayoutMethod, t: Translator["t"]): string {
  return t(`commission.method.${method}`);
}
