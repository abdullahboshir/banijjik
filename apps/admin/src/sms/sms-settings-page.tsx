import { PERMISSION_KEY } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import type { SmsGatewayView } from "./sms-api";
import { SmsGatewayForm } from "./sms-gateway-form";
import { smsSettingsLabelsOf } from "./sms-labels";
import { SmsLogs } from "./sms-logs";
import { SmsTestPanel } from "./sms-test-panel";

/**
 * `/{orgSlug}/settings/sms`: the business's own SMS account, the test send and the last sends. A member
 * with `sms.gateway.read` sees the page; the controls need `sms.credential.update`, the log needs
 * `sms.log.read`. The API enforces each of them; the screen only hides what the person may not use.
 */
export async function SmsSettingsPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t, locale } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.SMS_GATEWAY_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const gateway = await fetchBusinessResource<SmsGatewayView>(
    `/orgs/${organizationId}/sms/gateway`,
  );
  const labels = smsSettingsLabelsOf(t);
  const canEdit =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.SMS_CREDENTIAL_UPDATE);
  const canReadLogs = holdsPermission(permissions, PERMISSION_KEY.SMS_LOG_READ);
  return (
    <PageLayout title={labels.title} subtitle={labels.subtitle}>
      <div className="flex flex-col gap-8">
        <SmsGatewayForm
          key={gateway.data.version}
          organizationId={organizationId}
          view={gateway.data}
          labels={labels}
          canEdit={canEdit}
        />
        {canEdit ? <SmsTestPanel organizationId={organizationId} labels={labels} /> : null}
        {canReadLogs ? (
          <SmsLogs
            organizationId={organizationId}
            labels={labels}
            locale={locale}
            timeZone={access.timeZone}
          />
        ) : null}
      </div>
    </PageLayout>
  );
}
