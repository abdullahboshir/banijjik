import {
  LIMIT_KEY_VALUES,
  PLATFORM_PERMISSION_KEY,
  type PlatformPackageResponse,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageLayout, PageSection, buttonVariants } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { formatCount } from "../lib/format";
import { packageTone } from "../lib/status-tones";
import { packageDisplayName } from "./package-name";
import { PackageTable, type PackageRowView } from "./package-table";

const ALL_PACKAGES_PATH = "/platform/packages?limit=100";

/** Base packages show their limits; an add-on shows what it adds on top. */
function limitsSummary(pkg: PlatformPackageResponse, translator: Translator): string {
  const { t, locale } = translator;
  const parts = LIMIT_KEY_VALUES.flatMap((limitKey) => {
    const name = t(`platform.limit.${limitKey}`);
    if (!pkg.isAddOn) {
      const limit = pkg.limits[limitKey];
      return [
        `${name} ${limit === null ? t("platform.package.unlimitedShort") : formatCount(limit, locale)}`,
      ];
    }
    const increment = pkg.limitIncrements[limitKey];
    return increment === undefined ? [] : [`${name} +${formatCount(increment, locale)}`];
  });
  return parts.join(" · ");
}

function toRow(pkg: PlatformPackageResponse, translator: Translator): PackageRowView {
  return {
    packageId: pkg.packageId,
    name: packageDisplayName(pkg, translator),
    moduleCountLabel: formatCount(pkg.moduleKeys.length, translator.locale),
    limitsSummary: limitsSummary(pkg, translator),
    statusLabel: translator.t(`platform.status.package.${pkg.status}`),
    statusTone: packageTone(pkg.status),
  };
}

function Group({
  title,
  help,
  packages,
  translator,
}: {
  title: string;
  help: string;
  packages: PlatformPackageResponse[];
  translator: Translator;
}): ReactElement {
  const { t } = translator;
  return (
    <PageSection title={title} help={help}>
      <PackageTable
        rows={packages.map((pkg) => toRow(pkg, translator))}
        labels={{
          name: t("platform.packages.column.name"),
          modules: t("platform.packages.column.modules"),
          limits: t("platform.packages.column.limits"),
          status: t("platform.packages.column.status"),
          empty: t("platform.packages.empty"),
        }}
      />
    </PageSection>
  );
}

/** `/packages`: base packages and add-ons in two groups, with a way to create one (card 1.8b). */
export async function PackagesPage(): Promise<ReactElement> {
  const [operator, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t } = translator;
  if (!holdsPermission(operator, PLATFORM_PERMISSION_KEY.PACKAGE_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const packages = (await fetchPlatformResource<PlatformPackageResponse[]>(ALL_PACKAGES_PATH)).data;
  const canWrite = holdsPermission(operator, PLATFORM_PERMISSION_KEY.PACKAGE_WRITE);
  return (
    <PageLayout
      subtitle={t("platform.packages.subtitle")}
      title={t("platform.packages.title")}
      actions={
        canWrite ? (
          <Link href="/packages/new" className={buttonVariants({ variant: "primary" })}>
            {t("platform.packages.new")}
          </Link>
        ) : null
      }
    >
      <Group
        title={t("platform.packages.base")}
        help={t("platform.packages.base.help")}
        packages={packages.filter((pkg) => !pkg.isAddOn)}
        translator={translator}
      />
      <Group
        title={t("platform.packages.addOns")}
        help={t("platform.packages.addOns.help")}
        packages={packages.filter((pkg) => pkg.isAddOn)}
        translator={translator}
      />
    </PageLayout>
  );
}
