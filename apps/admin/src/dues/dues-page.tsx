import type { ReactElement } from "react";
import { PERMISSION_KEY } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import { listDuesQuerySchema } from "@banijjik/validation/payment";
import Link from "next/link";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import {
  DUES_PAGE_LIMIT,
  duesSearch,
  fetchDues,
  fetchDuesContacts,
  type DuesQuery,
} from "./dues-api";
import { DuesFilters } from "./dues-filters";
import { DuesList } from "./dues-list";

export async function DuesPage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [access, { t, locale }] = await Promise.all([
    requireOrgAccess(props.orgSlug),
    getTranslator(),
  ]);
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.PAYMENT_DUE_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const parsed = listDuesQuerySchema.safeParse(
    Object.fromEntries(Object.entries(props.searchParams).filter(([, value]) => value !== "")),
  );
  if (!parsed.success) return <EmptyState kind="noResults" message={t("dues.invalid")} />;
  const query: DuesQuery = parsed.data;
  const organizationId = access.organization.organizationId;
  const contactSearch = contactSearchOf(props.searchParams);
  const [dues, contacts] = await Promise.all([
    fetchDues(organizationId, query),
    holdsPermission(access.config.permissions, PERMISSION_KEY.CONTACT_CONTACT_READ)
      ? fetchDuesContacts(organizationId, contactSearch, query.contactId)
      : undefined,
  ]);
  const basePath = `/${props.orgSlug}/payments/dues`;
  return (
    <PageLayout title={t("dues.title")} subtitle={t("dues.help")}>
      <DuesFilters query={query} contacts={contacts ?? []} contactSearch={contactSearch} t={t} />
      <DuesList items={dues.data} orgSlug={props.orgSlug} locale={locale} t={t} />
      <nav aria-label={t("dues.pages")} className="flex gap-4">
        {query.page > 1 ? (
          <Link
            className="inline-flex min-h-11 items-center text-brand underline"
            href={`${basePath}?${duesSearch({ ...query, page: query.page - 1 })}`}
          >
            {t("dues.previous")}
          </Link>
        ) : null}
        {query.page * DUES_PAGE_LIMIT < (dues.meta?.total ?? 0) ? (
          <Link
            className="inline-flex min-h-11 items-center text-brand underline"
            href={`${basePath}?${duesSearch({ ...query, page: query.page + 1 })}`}
          >
            {t("dues.next")}
          </Link>
        ) : null}
      </nav>
    </PageLayout>
  );
}

function contactSearchOf(params: Record<string, string | string[] | undefined>): string {
  return typeof params["contactSearch"] === "string" ? params["contactSearch"] : "";
}
