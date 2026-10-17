import { PLATFORM_PERMISSION_KEY, type PlatformIndustryTemplateSummary } from "@banijjik/contracts";
import type { Locale, Translator } from "@banijjik/i18n";
import { EmptyState, PageLayout, buttonVariants, type StatusTone } from "@banijjik/ui";
import type { PageMeta } from "@banijjik/web-client";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { FilterChips } from "../lists/filter-chips";
import { ListPager } from "../lists/list-pager";
import type { RawParams } from "../lists/list-query";
import { formatCount } from "../lib/format";
import { IndustryTemplateList, type IndustryTemplateRowView } from "./industry-template-list";
import {
  INDUSTRY_TEMPLATE_FILTERS,
  industryTemplateListHref,
  industryTemplatesApiPath,
  parseIndustryTemplateQuery,
  type IndustryTemplateQuery,
} from "./template-query";

function templateTone(status: PlatformIndustryTemplateSummary["status"]): StatusTone {
  if (status === "PUBLISHED") return "success";
  if (status === "RETIRED") return "neutral";
  return "info";
}

function toRow(
  template: PlatformIndustryTemplateSummary,
  locale: Locale,
  t: Translator["t"],
): IndustryTemplateRowView {
  return {
    industryTemplateId: template.industryTemplateId,
    name: template.name[locale],
    industryTemplateKey: template.industryTemplateKey,
    kinds: template.enabledKinds.map((kind) => t(`platform.kind.${kind}`)).join(", "),
    moduleCountLabel: formatCount(template.allowedModuleKeys.length, locale),
    versionLabel: formatCount(template.version, locale),
    statusLabel: t(`platform.status.industryTemplate.${template.status}`),
    statusTone: templateTone(template.status),
  };
}

function statusChips(query: IndustryTemplateQuery, t: Translator["t"]) {
  const all = {
    chipKey: "all",
    label: t("platform.filter.all"),
    href: industryTemplateListHref({ ...query, status: undefined, page: 1 }),
    isActive: query.status === undefined,
  };
  const chips = INDUSTRY_TEMPLATE_FILTERS.map((status) => ({
    chipKey: status,
    label: t(`platform.status.industryTemplate.${status}`),
    href: industryTemplateListHref({ ...query, status, page: 1 }),
    isActive: query.status === status,
  }));
  return [all, ...chips];
}

/** `/industry-templates`: every industry, with a way to create one (card 2.6). */
export async function IndustryTemplatesPage({
  searchParams,
}: {
  searchParams: RawParams;
}): Promise<ReactElement> {
  const [operator, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t, locale } = translator;
  if (!holdsPermission(operator, PLATFORM_PERMISSION_KEY.INDUSTRY_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseIndustryTemplateQuery(searchParams);
  const page = await fetchPlatformResource<PlatformIndustryTemplateSummary[], PageMeta>(
    industryTemplatesApiPath(query),
  );
  const canWrite = holdsPermission(operator, PLATFORM_PERMISSION_KEY.INDUSTRY_WRITE);
  return (
    <PageLayout
      subtitle={t("platform.industries.subtitle")}
      title={t("platform.industries.title")}
      actions={
        canWrite ? (
          <Link href="/industry-templates/new" className={buttonVariants({ variant: "primary" })}>
            {t("platform.industries.new")}
          </Link>
        ) : null
      }
      filters={<FilterChips chips={statusChips(query, t)} navLabel={t("platform.filter.label")} />}
    >
      <IndustryTemplateList
        rows={page.data.map((template) => toRow(template, locale, t))}
        labels={{
          name: t("platform.industries.column.name"),
          key: t("platform.industries.column.key"),
          kinds: t("platform.industries.column.kinds"),
          modules: t("platform.industries.column.modules"),
          version: t("platform.industries.column.version"),
          status: t("platform.industries.column.status"),
          empty: t("platform.industries.empty"),
        }}
      />
      <ListPager
        page={query.page}
        hasNext={page.meta?.hasNext ?? false}
        previousHref={industryTemplateListHref({ ...query, page: query.page - 1 })}
        nextHref={industryTemplateListHref({ ...query, page: query.page + 1 })}
        labels={{
          previous: t("platform.page.previous"),
          next: t("platform.page.next"),
          current: t("platform.page.current", { page: formatCount(query.page, locale) }),
        }}
      />
    </PageLayout>
  );
}
