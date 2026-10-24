import { MODULE_KEY, PERMISSION_KEY } from "@banijjik/contracts";
import type { CommissionRuleResponse } from "@banijjik/contracts/commission";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageLayout } from "@banijjik/ui";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import type { PageMeta } from "../lib/api/page-meta";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { CommissionPager } from "./commission-pager";
import { CommissionRuleFilterForm } from "./commission-filters";
import type { CommissionNameLookups } from "./commission-labels";
import { loadCommissionRuleLookups, type CommissionRuleLookups } from "./commission-lookups";
import {
  commissionRuleListHref,
  commissionRulesApiPath,
  parseCommissionRuleQuery,
  type CommissionRuleQuery,
} from "./commission-query";
import { CommissionRulesView } from "./commission-rules-view";

interface RulesPageData {
  list: { data: CommissionRuleResponse[]; meta?: PageMeta | undefined };
  lookups: CommissionRuleLookups;
  nameLookups: CommissionNameLookups;
}

async function loadCommissionRulesData(
  access: OrgAccess,
  query: CommissionRuleQuery,
  t: Translator["t"],
): Promise<RulesPageData> {
  const [list, lookups] = await Promise.all([
    fetchBusinessResource<CommissionRuleResponse[], PageMeta>(
      commissionRulesApiPath(access.organization.organizationId, query),
    ),
    loadCommissionRuleLookups(access, t),
  ]);
  const nameLookups: CommissionNameLookups = {
    memberNameById: Object.fromEntries(lookups.members.map((row) => [row.memberId, row.name])),
    roleNameById: Object.fromEntries(lookups.roles.map((row) => [row.id, row.name])),
    categoryNameById: Object.fromEntries(lookups.categories.map((row) => [row.id, row.name])),
    offeringNameById: Object.fromEntries(lookups.offerings.map((row) => [row.id, row.name])),
  };
  return { list, lookups, nameLookups };
}

function CommissionRulesContent(props: {
  orgSlug: string;
  organizationId: string;
  canWrite: boolean;
  query: CommissionRuleQuery;
  data: RulesPageData;
  t: Translator["t"];
}): ReactElement {
  const { query, data, t } = props;
  const { lookups, list } = data;
  const basePath = `/${props.orgSlug}/commission/rules`;
  return (
    <PageLayout
      title={t("commission.rules.title")}
      subtitle={props.canWrite ? t("commission.rules.subtitle") : t("commission.rules.readOnly")}
      filters={
        <CommissionRuleFilterForm
          query={query}
          members={lookups.members}
          roles={lookups.roles}
          t={t}
        />
      }
    >
      <CommissionRulesView
        organizationId={props.organizationId}
        currency={lookups.currency}
        rules={list.data}
        options={{
          members: lookups.members,
          roles: lookups.roles,
          categories: lookups.categories,
          offerings: lookups.offerings,
          kinds: lookups.kinds,
        }}
        lookups={data.nameLookups}
        canWrite={props.canWrite}
      />
      <CommissionPager
        page={query.page}
        previousHref={
          query.page > 1
            ? commissionRuleListHref(basePath, { ...query, page: query.page - 1 })
            : undefined
        }
        nextHref={
          list.meta?.hasNext === true
            ? commissionRuleListHref(basePath, { ...query, page: query.page + 1 })
            : undefined
        }
        t={t}
      />
    </PageLayout>
  );
}

/** `/{orgSlug}/commission/rules`: the rules of who earns what, with add, edit and archive. */
export async function CommissionRulesPage(props: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  if (!access.config.modules.includes(MODULE_KEY.COMMISSION)) notFound();
  const { t } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.COMMISSION_RULE_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseCommissionRuleQuery(props.searchParams);
  const data = await loadCommissionRulesData(access, query, t);
  const canWrite =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.COMMISSION_RULE_UPDATE);
  return (
    <CommissionRulesContent
      orgSlug={props.orgSlug}
      organizationId={access.organization.organizationId}
      canWrite={canWrite}
      query={query}
      data={data}
      t={t}
    />
  );
}
