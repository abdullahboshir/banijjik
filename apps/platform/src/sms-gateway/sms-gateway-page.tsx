import { PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchPlatformResource } from "../api/platform-resource";
import { holdsPermission } from "../auth/permissions";
import { loadOperator } from "../auth/session-data";
import { getTranslator } from "../i18n/get-translator";
import type { PlatformSmsGatewayView } from "./sms-gateway-api";
import { PlatformSmsGatewayForm } from "./sms-gateway-form";
import { platformSmsLabelsOf } from "./sms-gateway-labels";
import { PlatformSmsTestPanel } from "./sms-gateway-test";

/**
 * `/sms-gateway`: the platform's default SMS account, used by every business that has not set its own.
 * Reading needs `platform.sms.read`; saving and the test send need `platform.sms.write`.
 */
export async function SmsGatewayPage(): Promise<ReactElement> {
  const [viewer, translator] = await Promise.all([loadOperator(), getTranslator()]);
  const { t } = translator;
  if (!holdsPermission(viewer, PLATFORM_PERMISSION_KEY.SMS_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const gateway = await fetchPlatformResource<PlatformSmsGatewayView>("/platform/sms-gateway");
  const labels = platformSmsLabelsOf(t);
  const canWrite = holdsPermission(viewer, PLATFORM_PERMISSION_KEY.SMS_WRITE);
  return (
    <PageLayout title={labels.title} subtitle={labels.subtitle}>
      <div className="flex flex-col gap-8">
        <PlatformSmsGatewayForm
          key={gateway.data.version}
          view={gateway.data}
          labels={labels}
          canEdit={canWrite}
        />
        <PlatformSmsTestPanel labels={labels} canEdit={canWrite} />
      </div>
    </PageLayout>
  );
}
