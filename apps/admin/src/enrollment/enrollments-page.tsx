import { PERMISSION_KEY } from "@banijjik/contracts";
import type { EnrollmentResponse } from "@banijjik/contracts/enrollment";
import { Button, EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";

export async function EnrollmentsPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [{ t }, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ))
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  const { data } = await fetchBusinessResource<EnrollmentResponse[]>(
    `/orgs/${access.organization.organizationId}/enrollments?limit=100`,
  );
  return (
    <PageLayout
      title={t("enrollment.title")}
      actions={
        <Link href={`/${orgSlug}/enrollments/new`}>
          <Button>{t("enrollment.new")}</Button>
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        {data.map((item) => (
          <Link
            key={item.enrollmentId}
            href={`/${orgSlug}/enrollments/${item.enrollmentId}`}
            className="rounded-lg border border-default bg-surface p-4"
          >
            <div className="flex justify-between">
              <span className="font-semibold">{item.enrollmentNumber}</span>
              <span>{t(`enrollment.status.${item.status}`)}</span>
            </div>
            <p className="text-secondary">
              {t("offering.PLAN")} · {item.startsOn}
            </p>
          </Link>
        ))}
      </div>
    </PageLayout>
  );
}
