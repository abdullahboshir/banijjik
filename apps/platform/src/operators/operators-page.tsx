import {
  PLATFORM_PERMISSION_KEY,
  USER_STATUS,
  type PlatformOperatorSummary,
  type PlatformRole,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageLayout, type StatusTone } from "@banijjik/ui";
import type { PageMeta } from "@banijjik/web-client";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { FilterChips, type FilterChipLink } from "../lists/filter-chips";
import { ListPager } from "../lists/list-pager";
import type { RawParams } from "../lists/list-query";
import { pickLabels } from "../lib/labels";
import { formatCount } from "../lib/format";
import { OperatorAddButton } from "./operator-actions";
import {
  OPERATOR_LABEL_KEYS,
  OPERATOR_ROLE_LABEL_KEY,
  operatorActionsFor,
} from "./operator-action-rules";
import { OperatorList, type OperatorRowView } from "./operator-list";
import {
  OPERATOR_FILTER_STATUSES,
  operatorListHref,
  operatorsApiPath,
  parseOperatorQuery,
  type OperatorQuery,
} from "./operator-query";

function operatorTone(status: PlatformOperatorSummary["status"]): StatusTone {
  return status === USER_STATUS.ACTIVE ? "success" : "neutral";
}

function rolesLabel(roles: readonly PlatformRole[], t: Translator["t"]): string {
  return roles.map((role) => t(OPERATOR_ROLE_LABEL_KEY[role])).join(", ");
}

function toRow(
  operator: PlatformOperatorSummary,
  viewer: Parameters<typeof operatorActionsFor>[1],
  t: Translator["t"],
): OperatorRowView {
  return {
    platformOperatorId: operator.platformOperatorId,
    name: operator.name,
    identifierHint: operator.identifierHint,
    rolesLabel: rolesLabel(operator.platformRoles, t),
    statusLabel: t(`platform.status.operator.${operator.status}`),
    statusTone: operatorTone(operator.status),
    isSelf: operator.platformOperatorId === viewer.platformOperatorId,
    status: operator.status,
    version: operator.version,
    platformRoles: operator.platformRoles,
    actions: operatorActionsFor(operator, viewer),
  };
}

function statusChips(query: OperatorQuery, t: Translator["t"]): FilterChipLink[] {
  const all: FilterChipLink = {
    chipKey: "all",
    label: t("platform.filter.all"),
    href: operatorListHref({ ...query, status: undefined, page: 1 }),
    isActive: query.status === undefined,
  };
  const chips = OPERATOR_FILTER_STATUSES.map((status) => ({
    chipKey: status,
    label: t(`platform.status.operator.${status}`),
    href: operatorListHref({ ...query, status, page: 1 }),
    isActive: query.status === status,
  }));
  return [all, ...chips];
}

/** `/operators`: list platform operators and, for a super admin, change them (card 1.10b). */
export async function OperatorsPage({
  searchParams,
}: {
  searchParams: RawParams;
}): Promise<ReactElement> {
  const [viewer, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t } = translator;
  if (!holdsPermission(viewer, PLATFORM_PERMISSION_KEY.OPERATOR_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseOperatorQuery(searchParams);
  const labels = pickLabels(t, OPERATOR_LABEL_KEYS);
  const operators = await fetchPlatformResource<PlatformOperatorSummary[], PageMeta>(
    operatorsApiPath(query),
  );
  const canWrite = holdsPermission(viewer, PLATFORM_PERMISSION_KEY.OPERATOR_WRITE);
  return (
    <PageLayout
      subtitle={t("platform.operators.subtitle")}
      title={labels["platform.operators.title"]}
      actions={canWrite ? <OperatorAddButton labels={labels} /> : undefined}
      filters={<FilterChips chips={statusChips(query, t)} navLabel={t("platform.filter.label")} />}
    >
      <OperatorList
        rows={operators.data.map((operator) => toRow(operator, viewer, t))}
        labels={labels}
      />
      <ListPager
        page={query.page}
        hasNext={operators.meta?.hasNext ?? false}
        previousHref={operatorListHref({ ...query, page: query.page - 1 })}
        nextHref={operatorListHref({ ...query, page: query.page + 1 })}
        labels={{
          previous: t("platform.page.previous"),
          next: t("platform.page.next"),
          current: t("platform.page.current", { page: formatCount(query.page, translator.locale) }),
        }}
      />
    </PageLayout>
  );
}
