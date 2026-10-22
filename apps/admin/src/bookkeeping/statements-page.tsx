import type { BookkeepingLabels } from "./labels";
import type {
  BalanceSheetResponse,
  ProfitAndLossStatementResponse,
  BalanceSheetRow,
  Money,
} from "@banijjik/contracts/accounting";
import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import { EmptyState, PageLayout, formatMoney, buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { holdsPermission } from "../shell/permissions";
import { bookkeepingAccess, queryText, todayIso, type BookkeepingPageProps } from "./page-access";
import { PrintStatement } from "./print-statement";
import { BookkeepingFilters } from "./page-controls";
const PRINT_LAYOUT_RULES =
  "@media print {aside,header.sticky,nav{display:none !important;} main{max-width:none !important;}}";
export async function StatementsPage(props: BookkeepingPageProps): Promise<ReactElement> {
  const { translator, access, labels } = await bookkeepingAccess(props.orgSlug);
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKKEEPING_STATEMENT_READ))
    return <EmptyState kind="noPermission" message={translator.t("state.permissionDenied")} />;
  const to = queryText(props.searchParams["to"]) || todayIso();
  const from = queryText(props.searchParams["from"]) || to.slice(0, 4) + "-01-01";
  const location = queryText(props.searchParams["location"]);
  const locations = await fetchBusinessResource<LocationResponse[]>(
    `/orgs/${access.organization.organizationId}/locations?limit=100`,
  );
  const path = `/orgs/${access.organization.organizationId}/bookkeeping/statements`;
  const profit = await fetchBusinessResource<ProfitAndLossStatementResponse>(
    `${path}/profit-and-loss?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${location === "" ? "" : "&locationId=" + encodeURIComponent(location)}`,
  );
  const sheet = await fetchBusinessResource<BalanceSheetResponse>(
    `${path}/balance-sheet?asOf=${encodeURIComponent(to)}`,
  );
  return (
    <PageLayout title={labels["statements"]}>
      <BookkeepingFilters
        organizationId={access.organization.organizationId}
        labels={labels}
        query={new URLSearchParams({ from, to, location })}
        locations={locations.data}
      />
      <PrintStatement label={labels.print} />
      <style>{PRINT_LAYOUT_RULES}</style>
      <Link
        className={buttonVariants({ variant: "secondary" }) + " print:hidden"}
        href={`/${props.orgSlug}/money/trial-balance`}
      >
        {labels["trial"]}
      </Link>
      <ProfitStatement profit={profit.data} labels={labels} locale={translator.locale} />
      <BalanceStatement sheet={sheet.data} labels={labels} locale={translator.locale} />
    </PageLayout>
  );
}
function MoneyFact(props: { label: string; money: Money; locale: "bn" | "en" }): ReactElement {
  return (
    <dl className="flex flex-wrap justify-between gap-3 border-b border-default py-2">
      <dt className="min-w-0 break-words">{props.label}</dt>
      <dd>{formatMoney(props.money, { locale: props.locale })}</dd>
    </dl>
  );
}
function StatementGroup(props: {
  title: string;
  rows: readonly BalanceSheetRow[];
  total: Money;
  locale: "bn" | "en";
}): ReactElement {
  return (
    <section>
      <h3 className="font-semibold">{props.title}</h3>
      {props.rows.map((row) => (
        <MoneyFact
          locale={props.locale}
          key={row.accountId}
          label={row.name[props.locale]}
          money={row.balance}
        />
      ))}
      <MoneyFact locale={props.locale} label={props.title} money={props.total} />
    </section>
  );
}

function ProfitStatement(props: {
  profit: ProfitAndLossStatementResponse;
  labels: BookkeepingLabels;
  locale: "bn" | "en";
}): ReactElement {
  const labels = props.labels;
  return (
    <section className="flex flex-col gap-3 print:break-inside-avoid">
      <h2 className="text-title font-semibold">{labels["profit"]}</h2>
      <MoneyFact locale={props.locale} label={labels["income"]} money={props.profit.totalIncome} />
      <MoneyFact
        locale={props.locale}
        label={labels["expense"]}
        money={props.profit.totalExpense}
      />
      <MoneyFact locale={props.locale} label={labels["net"]} money={props.profit.netProfit} />
      {props.profit.accounts.map((row) => (
        <MoneyFact
          locale={props.locale}
          key={row.accountId}
          label={row.name[props.locale]}
          money={row.net}
        />
      ))}
    </section>
  );
}

function BalanceStatement(props: {
  sheet: BalanceSheetResponse;
  labels: BookkeepingLabels;
  locale: "bn" | "en";
}): ReactElement {
  const labels = props.labels;
  return (
    <section className="flex flex-col gap-3 print:break-inside-avoid">
      <h2 className="text-title font-semibold">{labels["sheet"]}</h2>
      <p role="status">{props.sheet.isBalanced ? labels["balanced"] : labels["unbalanced"]}</p>
      <StatementGroup
        title={labels["assets"]}
        rows={props.sheet.assets}
        total={props.sheet.totalAssets}
        locale={props.locale}
      />
      <StatementGroup
        title={labels["liabilities"]}
        rows={props.sheet.liabilities}
        total={props.sheet.totalLiabilities}
        locale={props.locale}
      />
      <StatementGroup
        title={labels["equity"]}
        rows={props.sheet.equity}
        total={props.sheet.totalEquity}
        locale={props.locale}
      />
      <MoneyFact
        locale={props.locale}
        label={labels["retained"]}
        money={props.sheet.retainedEarnings}
      />
    </section>
  );
}
