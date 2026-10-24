import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import { ORDER_STATUS, type OrderListItem } from "@banijjik/contracts/sales";
import {
  Button,
  EmptyState,
  FormField,
  PageLayout,
  Select,
  TextInput,
  buttonVariants,
  formatNumber,
} from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { orderLabelsOf, type OrderLabels } from "./order-labels";
import {
  ordersApiQuery,
  ordersHref,
  parseOrdersQuery,
  statusHref,
  type OrdersQuery,
} from "./order-query";
import { OrdersList } from "./orders-list";

interface OrderListMeta {
  readonly hasNext?: boolean;
}

function StatusChips(props: {
  readonly basePath: string;
  readonly query: OrdersQuery;
  readonly labels: OrderLabels;
}): ReactElement {
  const { basePath, query, labels } = props;
  return (
    <nav className="flex flex-wrap gap-2" aria-label={labels.list.statusFilter}>
      <Link
        href={statusHref(basePath, query, undefined)}
        className={buttonVariants({
          variant: query.status === undefined ? "primary" : "secondary",
        })}
      >
        {labels.list.statusAll}
      </Link>
      {Object.values(ORDER_STATUS).map((status) => (
        <Link
          key={status}
          href={statusHref(basePath, query, status)}
          className={buttonVariants({ variant: query.status === status ? "primary" : "secondary" })}
        >
          {labels.status[status]}
        </Link>
      ))}
    </nav>
  );
}

function OrdersFilters(props: {
  readonly basePath: string;
  readonly query: OrdersQuery;
  readonly locations: readonly LocationResponse[];
  readonly labels: OrderLabels;
}): ReactElement {
  const { basePath, query, locations, labels } = props;
  return (
    <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {query.status === undefined ? null : (
        <input type="hidden" name="status" value={query.status} />
      )}
      <FormField label={labels.list.search} htmlFor="orders-search">
        <TextInput
          id="orders-search"
          name="q"
          type="search"
          defaultValue={query.q ?? ""}
          placeholder={labels.list.searchPlaceholder}
        />
      </FormField>
      <FormField label={labels.list.locationFilter} htmlFor="orders-location">
        <Select id="orders-location" name="location" defaultValue={query.locationId ?? ""}>
          <option value="">{labels.list.locationAll}</option>
          {locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.name}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="flex items-end gap-2">
        <Button type="submit" variant="secondary">
          {labels.list.apply}
        </Button>
        <Link href={basePath} className={buttonVariants({ variant: "ghost" })}>
          {labels.list.reset}
        </Link>
      </div>
    </form>
  );
}

function OrdersPager(props: {
  readonly basePath: string;
  readonly query: OrdersQuery;
  readonly page: number;
  readonly hasNext: boolean;
  readonly labels: OrderLabels;
  readonly locale: "bn" | "en";
}): ReactElement {
  const { basePath, query, page, hasNext, labels } = props;
  return (
    <nav className="flex flex-wrap items-center gap-3" aria-label={labels.list.page}>
      {page > 1 ? (
        <Link
          href={ordersHref(basePath, { ...query, page: page - 1 })}
          className={buttonVariants({ variant: "secondary" })}
        >
          {labels.list.previous}
        </Link>
      ) : null}
      <span className="text-small text-secondary">
        {labels.list.page} {formatNumber(page, { locale: props.locale })}
      </span>
      {hasNext ? (
        <Link
          href={ordersHref(basePath, { ...query, page: page + 1 })}
          className={buttonVariants({ variant: "secondary" })}
        >
          {labels.list.next}
        </Link>
      ) : null}
    </nav>
  );
}

type OrgAccess = Awaited<ReturnType<typeof requireOrgAccess>>;

async function loadOrdersListReads(access: OrgAccess, query: OrdersQuery) {
  const organizationId = access.organization.organizationId;
  const [result, locations] = await Promise.all([
    fetchBusinessResource<OrderListItem[], OrderListMeta>(
      `/orgs/${organizationId}/orders?${ordersApiQuery(query)}`,
    ),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=100`,
    ),
  ]);
  return { result, locations };
}

/** The orders list: status chips, search, a location filter and one page of rows (decision 9). */
export async function OrdersListPage(props: {
  readonly orgSlug: string;
  readonly searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.SALES_ORDER_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseOrdersQuery(props.searchParams);
  const basePath = `/${props.orgSlug}/orders`;
  const canCreate =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.SALES_ORDER_CREATE);
  const { result, locations } = await loadOrdersListReads(access, query);
  const labels = orderLabelsOf(t);
  // The API echoes `page` as the text it was sent (a string on the wire), so the screen keeps its own number.
  const page = query.page;
  const hasNext = result.meta?.hasNext ?? false;

  return (
    <PageLayout
      title={labels.list.title}
      subtitle={labels.list.subtitle}
      actions={
        canCreate ? (
          <Link href={`${basePath}/new`} className={buttonVariants({ variant: "primary" })}>
            {labels.list.newOrder}
          </Link>
        ) : null
      }
      filters={
        <div className="flex flex-col gap-3">
          <StatusChips basePath={basePath} query={query} labels={labels} />
          <OrdersFilters
            basePath={basePath}
            query={query}
            locations={locations ?? []}
            labels={labels}
          />
        </div>
      }
    >
      <OrdersList orgSlug={props.orgSlug} items={result.data} locale={locale} labels={labels} />
      <OrdersPager
        basePath={basePath}
        query={query}
        page={page}
        hasNext={hasNext}
        labels={labels}
        locale={locale}
      />
    </PageLayout>
  );
}
