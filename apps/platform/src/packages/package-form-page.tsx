import { PLATFORM_PERMISSION_KEY, type PlatformPackageResponse } from "@banijjik/contracts";
import { DetailHeader, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import { packageFormTexts } from "./package-form-labels";
import { PackageForm } from "./package-form";
import { packageDisplayName } from "./package-name";

/** `/packages/new` (no id) and `/packages/{packageId}`: the form of one package, read-only without write access. */
export async function PackageFormPage({
  packageId,
}: {
  packageId: string | undefined;
}): Promise<ReactElement> {
  const [operator, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t } = translator;
  const canRead = holdsPermission(operator, PLATFORM_PERMISSION_KEY.PACKAGE_READ);
  const canWrite = holdsPermission(operator, PLATFORM_PERMISSION_KEY.PACKAGE_WRITE);
  if (!canRead || (packageId === undefined && !canWrite)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const existing =
    packageId === undefined
      ? undefined
      : (await fetchPlatformResource<PlatformPackageResponse>(`/platform/packages/${packageId}`))
          .data;
  const isSeed = existing !== undefined && existing.nameKey !== null;
  return (
    <>
      <DetailHeader
        title={existing ? packageDisplayName(existing, translator) : t("platform.packages.new")}
        backHref="/packages"
        backLabel={t("platform.packages.title")}
      />
      <PackageForm
        existing={existing}
        seedName={isSeed ? packageDisplayName(existing, translator) : undefined}
        canWrite={canWrite}
        texts={packageFormTexts(t)}
      />
    </>
  );
}
