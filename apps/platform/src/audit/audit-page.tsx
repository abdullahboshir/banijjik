import { PLATFORM_PERMISSION_KEY, type PlatformAuditLogSummary } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { Button, EmptyState, PageHeader, TextInput } from "@banijjik/ui";
import type { PageMeta } from "@banijjik/web-client";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { FilterChips, type FilterChipLink } from "../lists/filter-chips";
import { ListPager } from "../lists/list-pager";
import type { RawParams } from "../lists/list-query";
import { formatCount, formatDateTime, shortId } from "../lib/format";
import {
  AUDIT_TARGET_TYPES,
  auditApiPath,
  auditHref,
  parseAuditQuery,
  type AuditQuery,
} from "./audit-query";
import { AuditList, type AuditRowView } from "./audit-list";

const NO_VALUE = "-";

function toRow(entry: PlatformAuditLogSummary, translator: Translator): AuditRowView {
  const { t, locale } = translator;
  return {
    platformAuditLogId: entry.platformAuditLogId,
    when: formatDateTime(entry.occurredAt, locale),
    operator: shortId(entry.actorPlatformOperatorId),
    action: t(`platform.audit.action.${entry.action}`),
    target: `${t(`platform.audit.target.${entry.targetType}`)} ${shortId(entry.targetId)}`,
    organization: entry.organizationId ? shortId(entry.organizationId) : NO_VALUE,
    reason: entry.reason ?? NO_VALUE,
  };
}

function targetChips(query: AuditQuery, t: Translator["t"]): FilterChipLink[] {
  const all: FilterChipLink = {
    chipKey: "all",
    label: t("platform.filter.all"),
    href: auditHref({ ...query, targetType: undefined, page: 1 }),
    isActive: query.targetType === undefined,
  };
  const chips = AUDIT_TARGET_TYPES.map((targetType) => ({
    chipKey: targetType,
    label: t(`platform.audit.target.${targetType}`),
    href: auditHref({ ...query, targetType, page: 1 }),
    isActive: query.targetType === targetType,
  }));
  return [all, ...chips];
}

function OrganizationFilter({ query, t }: { query: AuditQuery; t: Translator["t"] }): ReactElement {
  return (
    <form method="get" role="search" className="flex gap-2">
      {query.targetType ? <input type="hidden" name="targetType" value={query.targetType} /> : null}
      <TextInput
        name="organizationId"
        defaultValue={query.organizationId ?? ""}
        aria-label={t("platform.audit.organizationFilter")}
        placeholder={t("platform.audit.organizationFilter")}
      />
      <Button type="submit" variant="secondary">
        {t("platform.audit.apply")}
      </Button>
    </form>
  );
}

/** `/audit`: what operators did, newest first, for super admins (permission `platform.audit.read`). */
export async function AuditPage({
  searchParams,
}: {
  searchParams: RawParams;
}): Promise<ReactElement> {
  const [operator, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t } = translator;
  if (!holdsPermission(operator, PLATFORM_PERMISSION_KEY.AUDIT_READ)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const query = parseAuditQuery(searchParams);
  const entries = await fetchPlatformResource<PlatformAuditLogSummary[], PageMeta>(
    auditApiPath(query),
  );
  return (
    <>
      <PageHeader
        title={t("platform.audit.title")}
        filters={
          <>
            <FilterChips chips={targetChips(query, t)} navLabel={t("platform.filter.label")} />
            <OrganizationFilter query={query} t={t} />
          </>
        }
      />
      <AuditList
        rows={entries.data.map((entry) => toRow(entry, translator))}
        labels={{
          when: t("platform.audit.column.when"),
          operator: t("platform.audit.column.operator"),
          action: t("platform.audit.column.action"),
          target: t("platform.audit.column.target"),
          organization: t("platform.audit.column.organization"),
          reason: t("platform.audit.column.reason"),
          empty: t("platform.audit.empty"),
        }}
      />
      <ListPager
        page={query.page}
        hasNext={entries.meta?.hasNext ?? false}
        previousHref={auditHref({ ...query, page: query.page - 1 })}
        nextHref={auditHref({ ...query, page: query.page + 1 })}
        labels={{
          previous: t("platform.page.previous"),
          next: t("platform.page.next"),
          current: t("platform.page.current", { page: formatCount(query.page, translator.locale) }),
        }}
      />
    </>
  );
}
