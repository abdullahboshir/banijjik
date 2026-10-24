import { PERMISSION_KEY } from "@banijjik/contracts";
import type { EnrollmentDetailResponse } from "@banijjik/contracts/enrollment";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { EnrollmentDetailActions } from "./enrollment-detail-actions";

export async function EnrollmentDetailPage({
  orgSlug,
  enrollmentId,
}: {
  orgSlug: string;
  enrollmentId: string;
}): Promise<ReactElement> {
  const [{ t }, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.ENROLLMENT_ENROLLMENT_READ))
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  const { data } = await fetchBusinessResource<EnrollmentDetailResponse>(
    `/orgs/${access.organization.organizationId}/enrollments/${enrollmentId}`,
  );
  return (
    <PageLayout title={data.enrollmentNumber}>
      <div className="flex flex-col gap-5">
        <div>
          <p>{t("offering.PLAN")}</p>
          <p>
            {t(`enrollment.status.${data.status}`)} · {data.startsOn}
          </p>
        </div>
        <EnrollmentDetailActions
          organizationId={access.organization.organizationId}
          enrollment={data}
        />
        <section className="flex flex-col gap-2">
          <h2 className="text-h3">{t("enrollment.periods")}</h2>
          {data.periods.map((period) => (
            <div
              key={period.enrollmentPeriodId}
              className="flex justify-between rounded border border-default p-3"
            >
              <span>
                {period.periodStartsOn} – {period.periodEndsOn}
              </span>
              <span>
                {period.fee.amount} {period.fee.currency} · {period.status}
              </span>
            </div>
          ))}
        </section>
      </div>
    </PageLayout>
  );
}
