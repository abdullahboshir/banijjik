import { MODULE_KEY, PERMISSION_KEY } from "@banijjik/contracts";
import type { TrialBalanceResponse } from "@banijjik/contracts/accounting";
import type { Translator } from "@banijjik/i18n";
import { Button, EmptyState, FormField, formatMoney, PageLayout, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { localizedNameOf } from "../expenses/expense-labels";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function asOfOf(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value !== undefined && /^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  return todayIso();
}

function Summary(props: {
  result: TrialBalanceResponse;
  t: Translator["t"];
  locale: Translator["locale"];
}): ReactElement {
  const { result, t, locale } = props;
  return (
    <div className="flex flex-col gap-3">
      <p
        role="status"
        className={`text-title font-semibold ${result.balances ? "text-success" : "text-danger"}`}
      >
        {result.balances ? t("trialBalance.balancesYes") : t("trialBalance.balancesNo")}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-small text-secondary">{t("trialBalance.debitTotal")}</dt>
          <dd className="text-body text-primary">{formatMoney(result.debitTotal, { locale })}</dd>
        </div>
        <div>
          <dt className="text-small text-secondary">{t("trialBalance.creditTotal")}</dt>
          <dd className="text-body text-primary">{formatMoney(result.creditTotal, { locale })}</dd>
        </div>
      </dl>
    </div>
  );
}

function AccountRows(props: {
  result: TrialBalanceResponse;
  t: Translator["t"];
  locale: Translator["locale"];
}): ReactElement {
  const { result, t, locale } = props;
  if (result.accounts.length === 0)
    return <p className="text-body text-secondary">{t("trialBalance.empty")}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {result.accounts.map((row) => (
        <article key={row.accountId} className="rounded-lg border border-default p-4">
          <h2 className="font-semibold">{localizedNameOf(row.name, locale)}</h2>
          <p className="text-small text-secondary">{row.accountCode}</p>
          <dl className="grid grid-cols-2 gap-2">
            {(["debit", "credit", "balance"] as const).map((side) => (
              <div key={side}>
                <dt>{t("trialBalance.column." + side)}</dt>
                <dd>
                  {formatMoney(
                    side === "balance"
                      ? row.balance
                      : row[side === "debit" ? "debitTotal" : "creditTotal"],
                    { locale },
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

/** Settings › Advanced › Trial balance: books balance yes/no for owners and managers. */
export async function TrialBalancePage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  const bookkeeping = access.config.modules.includes(MODULE_KEY.BOOKKEEPING);
  const permission = bookkeeping
    ? PERMISSION_KEY.BOOKKEEPING_STATEMENT_READ
    : PERMISSION_KEY.ACCOUNTING_LEDGER_READ;
  if (!holdsPermission(access.config.permissions, permission)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const asOf = asOfOf(props.searchParams["asOf"]);
  const { organizationId } = access.organization;
  const result = await fetchBusinessResource<TrialBalanceResponse>(
    `/orgs/${organizationId}/${bookkeeping ? "bookkeeping" : "accounting"}/trial-balance?asOf=${asOf}`,
  );
  return (
    <PageLayout title={t("trialBalance.title")} subtitle={t("trialBalance.subtitle")}>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <FormField label={t("trialBalance.asOf")} htmlFor="trial-balance-as-of">
          <TextInput id="trial-balance-as-of" name="asOf" type="date" defaultValue={asOf} />
        </FormField>
        <Button type="submit" variant="secondary">
          {t("trialBalance.check")}
        </Button>
      </form>
      <Summary result={result.data} t={t} locale={locale} />
      <AccountRows result={result.data} t={t} locale={locale} />
    </PageLayout>
  );
}
