import {
  AUDIT_ACTION,
  PLATFORM_AUDIT_ACTION,
  ERROR_CODE,
  PREFERRED_LOCALE,
  type ModuleManifest,
} from "@banijjik/contracts";
import { SMS_SETTING_KEY } from "@banijjik/contracts/sms";
import { createTranslator } from "@banijjik/i18n";
import { organizationId as smsOrganizationId } from "../modules/integration/sms/index.js";
import type { AppConfig } from "../config/index.js";
import type { AuditRecorder, PlatformAuditRecorder } from "../kernel/audit/index.js";
import { AppError } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildOrganizationTimezoneReader,
  buildStorefrontOrganizationReader,
} from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import { buildLimitGuard, type OrgConfigService } from "../modules/platform/entitlement/index.js";
import type { SmsModuleDependencies } from "../modules/integration/sms/index.js";

export function buildSmsDependencies(input: {
  config: AppConfig;
  clock: Clock;
  orgConfig: OrgConfigService;
  manifests: readonly ModuleManifest[];
}): SmsModuleDependencies {
  const settings = buildSettingsResolver(input);
  const timezones = buildOrganizationTimezoneReader();
  return {
    config: input.config.sms,
    clock: input.clock,
    limits: buildLimitGuard(input.orgConfig),
    policy: {
      async read() {
        const organizationId = smsOrganizationId();
        const timeZone = await timezones.read(organizationId);
        const values = await settings.resolve(organizationId, {
          keys: [SMS_SETTING_KEY.DAILY_LIMIT],
        });
        const dailyLimit = values.get(SMS_SETTING_KEY.DAILY_LIMIT)?.value;
        if (timeZone === undefined || typeof dailyLimit !== "number")
          throw new AppError({ code: ERROR_CODE.INTERNAL });
        return { timeZone, dailyLimit };
      },
    },
  };
}

export function tenantSmsAudit(
  audit: AuditRecorder,
): (tested: boolean, fields: readonly string[], entityId?: string) => Promise<void> {
  return (tested: boolean, fields: readonly string[], entityId?: string) =>
    audit.record({
      action: tested ? AUDIT_ACTION.SMS_GATEWAY_TESTED : AUDIT_ACTION.SMS_GATEWAY_UPDATED,
      entityType: "smsGatewaySetting",
      entityId: entityId ?? smsOrganizationId(),
      changes: { fields: { to: fields } },
    });
}

export function platformSmsAudit(
  audit: PlatformAuditRecorder,
): (tested: boolean, fields: readonly string[]) => Promise<void> {
  return (tested: boolean, fields: readonly string[]) =>
    audit.record({
      action: tested
        ? PLATFORM_AUDIT_ACTION.SMS_GATEWAY_TESTED
        : PLATFORM_AUDIT_ACTION.SMS_GATEWAY_UPDATED,
      targetType: "sms_gateway",
      targetId: "DEFAULT",
      changes: { fields: { to: fields } },
    });
}

export function buildSmsTestMessage(platform: boolean): () => Promise<string> {
  const organizations = buildStorefrontOrganizationReader();
  return async () => {
    const organization = platform
      ? undefined
      : await organizations.findActiveById(smsOrganizationId());
    const businessName = organization?.name ?? "";
    return createTranslator({
      locale: organization?.defaultLocale ?? PREFERRED_LOCALE.bn,
      brandName: businessName,
    }).t("sms.test_message", { businessName });
  };
}
