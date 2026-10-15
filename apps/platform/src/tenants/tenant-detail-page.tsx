import {
  INDUSTRY_TEMPLATE_STATUS,
  PLATFORM_PERMISSION_KEY,
  type PlatformIndustryTemplateSummary,
  type PlatformOrganizationDetail,
  type PlatformPackageResponse,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { DetailHeader, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { formatCount } from "../lib/format";
import { pickLabels } from "../lib/labels";
import { organizationTone } from "../lib/status-tones";
import { StatusPill } from "../shell/status-pill";
import { grantableModules, moduleLabelKey } from "../packages/module-catalog";
import { packageDisplayName } from "../packages/package-name";
import { ModulesSection } from "./modules-section";
import { SubscriptionSection } from "./subscription-section";
import {
  TENANT_ACTION_LABEL_KEYS,
  availableTenantActions,
  type IndustryTemplateOption,
  type PackageOption,
  type TenantActionContext,
} from "./tenant-action-labels";
import { TenantActions } from "./tenant-actions";

const PACKAGE_OPTIONS_PATH = "/platform/packages?status=ACTIVE&limit=100";

function packageOptions(
  packages: PlatformPackageResponse[],
  isAddOn: boolean,
  translator: Translator,
): PackageOption[] {
  return packages
    .filter((pkg) => pkg.isAddOn === isAddOn)
    .map((pkg) => ({ packageId: pkg.packageId, label: packageDisplayName(pkg, translator) }));
}

async function loadIndustryTemplates(
  canRead: boolean,
  translator: Translator,
): Promise<IndustryTemplateOption[]> {
  if (!canRead) return [];
  const templates = await fetchPlatformResource<PlatformIndustryTemplateSummary[]>(
    "/platform/industry-templates?limit=100",
  );
  return templates.data
    .filter((template) => template.status !== INDUSTRY_TEMPLATE_STATUS.RETIRED)
    .map((template) => ({
      industryTemplateKey: template.industryTemplateKey,
      label: template.name[translator.locale],
    }));
}

async function loadActivePackages(canRead: boolean): Promise<PlatformPackageResponse[]> {
  if (!canRead) return [];
  return (await fetchPlatformResource<PlatformPackageResponse[]>(PACKAGE_OPTIONS_PATH)).data;
}

function buildContext(input: {
  tenant: PlatformOrganizationDetail;
  packages: PlatformPackageResponse[];
  industryTemplates: IndustryTemplateOption[];
  translator: Translator;
}): TenantActionContext {
  const { tenant, packages, translator } = input;
  const { t } = translator;
  return {
    organizationId: tenant.organizationId,
    currentBasePackageId: tenant.subscription?.basePackageId,
    currentAddOnPackageIds: tenant.subscription?.addOnPackageIds ?? [],
    basePackages: packageOptions(packages, false, translator),
    addOnPackages: packageOptions(packages, true, translator),
    modules: grantableModules().map((moduleKey) => ({
      moduleKey,
      label: t(moduleLabelKey(moduleKey)),
    })),
    industryTemplates: input.industryTemplates,
    labels: pickLabels(t, TENANT_ACTION_LABEL_KEYS, { name: tenant.name }),
  };
}

function TenantHeading(props: {
  detail: PlatformOrganizationDetail;
  locale: Translator["locale"];
  t: Translator["t"];
}): ReactElement {
  const { detail, t, locale } = props;
  return (
    <DetailHeader
      title={detail.name}
      backHref="/tenants"
      backLabel={t("platform.tenants.title")}
      status={
        <StatusPill
          tone={organizationTone(detail.status)}
          label={t(`platform.status.organization.${detail.status}`)}
        />
      }
      facts={
        <span>
          {t("platform.tenant.facts", {
            slug: detail.slug,
            template: detail.templateKey,
            members: formatCount(detail.memberCount, locale),
            locations: formatCount(detail.locationCount, locale),
            owner: `${detail.owner.displayName} (${detail.owner.maskedIdentifier})`,
          })}
        </span>
      }
    />
  );
}

/** `/tenants/{organizationId}`: status, subscription and module overrides, with the actions an operator may take. */
export async function TenantDetailPage({
  organizationId,
}: {
  organizationId: string;
}): Promise<ReactElement> {
  const [operator, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t, locale } = translator;
  if (!holdsPermission(operator, PLATFORM_PERMISSION_KEY.TENANT_READ)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const canReadPackages = holdsPermission(operator, PLATFORM_PERMISSION_KEY.PACKAGE_READ);
  const canChangeIndustry = holdsPermission(operator, PLATFORM_PERMISSION_KEY.INDUSTRY_WRITE);
  const [tenant, packages, industryTemplates] = await Promise.all([
    fetchPlatformResource<PlatformOrganizationDetail>(`/platform/organizations/${organizationId}`),
    loadActivePackages(canReadPackages),
    loadIndustryTemplates(canChangeIndustry, translator),
  ]);
  const detail = tenant.data;
  const actions = availableTenantActions(operator, detail).filter(
    (kind) => kind !== "changePackage" || canReadPackages,
  );
  return (
    <>
      <TenantHeading detail={detail} locale={locale} t={t} />
      <TenantActions
        actions={actions}
        context={buildContext({ tenant: detail, packages, industryTemplates, translator })}
      />
      <div className="flex flex-col gap-4">
        <SubscriptionSection
          subscription={detail.subscription}
          packages={packages}
          translator={translator}
        />
        <ModulesSection
          organizationId={detail.organizationId}
          overrides={detail.moduleOverrides}
          canWrite={holdsPermission(operator, PLATFORM_PERMISSION_KEY.ENTITLEMENT_WRITE)}
          translator={translator}
        />
      </div>
    </>
  );
}
