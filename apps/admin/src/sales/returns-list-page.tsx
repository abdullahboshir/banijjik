import { PERMISSION_KEY } from "@banijjik/contracts";
import type { SalesReturnListItem } from "@banijjik/contracts/sales";
import {
  Button,
  EmptyState,
  FormField,
  MoneyText,
  PageLayout,
  TextInput,
  buttonVariants,
  formatNumber,
  type DisplayLocale,
} from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { returnLabelsOf, type ReturnLabels } from "./return-labels";
import { returnsApiQuery, returnsHref, parseReturnsQuery, type ReturnsQuery } from "./return-query";

interface ReturnListMeta {
  readonly hasNext?: boolean;
}

function ReturnRow(props: {
  readonly orgSlug: string;
  readonly item: SalesReturnListItem;
  readonly labels: ReturnLabels;
  readonly locale: DisplayLocale;
}): ReactElement {
  const { item, labels } = props;
  return (
    <li>
      <Link
        href={`/${props.orgSlug}/returns/${item.salesReturnId}`}
        className="flex min-h-11 flex-col gap-2 rounded-lg border border-border p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-money text-body font-medium text-primary">
            {item.salesReturnNumber}
          </span>
          <span className="text-caption text-muted">{labels.statuses[item.status]}</span>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-caption text-secondary">
          <div>
            <dt className="inline">{labels.list.date} </dt>
            <dd className="inline">{item.businessDate}</dd>
          </div>
          <div>
            <dt className="inline">{labels.list.reason} </dt>
            <dd className="inline">{labels.reasons[item.reasonKey]}</dd>
          </div>
          <div>
            <dt className="inline">{labels.list.value} </dt>
            <dd className="inline">
              <MoneyText money={item.value} locale={props.locale} />
            </dd>
          </div>
          <div>
            <dt className="inline">{labels.list.refund} </dt>
            <dd className="inline">
              <MoneyText money={item.refundAmount} locale={props.locale} />
            </dd>
          </div>
        </dl>
      </Link>
    </li>
  );
}

function ReturnsFilters(props: {
  readonly basePath: string;
  readonly query: ReturnsQuery;
  readonly labels: ReturnLabels;
}): ReactElement {
  const { query, labels } = props;
  return (
    <div className="flex flex-col gap-3">
      {query.orderId === undefined ? null : (
        <p className="flex flex-wrap items-center gap-3 text-body text-secondary">
          <span>{labels.list.orderFilter}</span>
          <Link
            href={returnsHref(props.basePath, {
              page: 1,
              ...(query.from === undefined ? {} : { from: query.from }),
              ...(query.to === undefined ? {} : { to: query.to }),
            })}
            className="inline-flex min-h-11 items-center text-brand underline"
          >
            {labels.list.clearOrder}
          </Link>
        </p>
      )}
      <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {query.orderId === undefined ? null : (
          <input type="hidden" name="orderId" value={query.orderId} />
        )}
        <FormField label={labels.list.from} htmlFor="returns-from">
          <TextInput id="returns-from" name="from" type="date" defaultValue={query.from ?? ""} />
        </FormField>
        <FormField label={labels.list.to} htmlFor="returns-to">
          <TextInput id="returns-to" name="to" type="date" defaultValue={query.to ?? ""} />
        </FormField>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" variant="secondary">
            {labels.list.apply}
          </Button>
          <Link href={props.basePath} className={buttonVariants({ variant: "ghost" })}>
            {labels.list.reset}
          </Link>
        </div>
      </form>
    </div>
  );
}

function ReturnsPager(props: {
  readonly basePath: string;
  readonly query: ReturnsQuery;
  readonly hasNext: boolean;
  readonly labels: ReturnLabels;
  readonly locale: DisplayLocale;
}): ReactElement {
  const { query, labels } = props;
  return (
    <nav className="flex flex-wrap items-center gap-3" aria-label={labels.list.title}>
      {query.page > 1 ? (
        <Link
          href={returnsHref(props.basePath, { ...query, page: query.page - 1 })}
          className={buttonVariants({ variant: "secondary" })}
        >
          {labels.list.previous}
        </Link>
      ) : null}
      <span className="text-small text-secondary">
        {formatNumber(query.page, { locale: props.locale })}
      </span>
      {props.hasNext ? (
        <Link
          href={returnsHref(props.basePath, { ...query, page: query.page + 1 })}
          className={buttonVariants({ variant: "secondary" })}
        >
          {labels.list.next}
        </Link>
      ) : null}
    </nav>
  );
}

/** The returns of one location: filters by order and date, one page of cards (plan 3.5b card B). */
export async function ReturnsListPage(props: {
  readonly orgSlug: string;
  readonly searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.SALES_RETURN_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseReturnsQuery(props.searchParams);
  const basePath = `/${props.orgSlug}/returns`;
  const labels = returnLabelsOf(t);
  const result = await fetchBusinessResource<SalesReturnListItem[], ReturnListMeta>(
    `/orgs/${access.organization.organizationId}/sales/returns?${returnsApiQuery(query)}`,
  );
  const hasNext = result.meta?.hasNext ?? false;
  return (
    <PageLayout
      title={labels.list.title}
      subtitle={labels.list.subtitle}
      filters={<ReturnsFilters basePath={basePath} query={query} labels={labels} />}
    >
      {result.data.length === 0 ? (
        <EmptyState kind="none" message={labels.list.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((item) => (
            <ReturnRow
              key={item.salesReturnId}
              orgSlug={props.orgSlug}
              item={item}
              labels={labels}
              locale={locale}
            />
          ))}
        </ul>
      )}
      <ReturnsPager
        basePath={basePath}
        query={query}
        hasNext={hasNext}
        labels={labels}
        locale={locale}
      />
    </PageLayout>
  );
}
