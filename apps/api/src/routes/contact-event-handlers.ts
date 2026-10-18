import { PREFERRED_LOCALE } from "@banijjik/contracts";
import { CUSTOMER_OTP_RULES } from "@banijjik/contracts/contact";
import { createTranslator } from "@banijjik/i18n";
import type { AppConfig } from "../config/index.js";
import { getRequestContext } from "../kernel/context/index.js";
import {
  registerContactEventHandlers,
  type OtpMessageComposer,
} from "../modules/commerce/contact/index.js";
import { buildStorefrontOrganizationReader } from "../modules/core/organization/index.js";

const SECONDS_PER_MINUTE = 60;

/**
 * Builds the sign-in SMS in the business's default language, with its name and the code. The handler
 * runs as the business that asked, so the organization comes from the request context.
 */
export function buildOtpMessageComposer(): OtpMessageComposer {
  const organizations = buildStorefrontOrganizationReader();
  return {
    async compose(code) {
      const { organizationId } = getRequestContext();
      const organization =
        organizationId === undefined
          ? undefined
          : await organizations.findActiveById(organizationId);
      const businessName = organization?.name ?? "";
      const translator = createTranslator({
        locale: organization?.defaultLocale ?? PREFERRED_LOCALE.bn,
        brandName: businessName,
      });
      return translator.t("sms.customerOtp", {
        businessName,
        code,
        minutes: CUSTOMER_OTP_RULES.expiresInSeconds / SECONDS_PER_MINUTE,
      });
    },
  };
}

/** Registers the handlers that need other modules' adapters. The worker calls it before it starts. */
export function registerContactHandlers(config: AppConfig): void {
  registerContactEventHandlers({
    storefront: config.storefront,
    composer: buildOtpMessageComposer(),
  });
}
