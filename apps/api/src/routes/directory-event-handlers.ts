import {
  buildGatewaySmsSender,
  type SmsModuleDependencies,
} from "../modules/integration/sms/index.js";
import { PREFERRED_LOCALE, type ModuleManifest, type PreferredLocale } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { createTranslator } from "@banijjik/i18n";
import type { StorefrontConfig } from "../config/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildCustomerSmsNotifier,
  type CustomerSmsNotifier,
} from "../modules/commerce/contact/index.js";
import {
  directorySettingsFromResolver,
  MongoListingRepository,
  registerDirectoryReviewResultHandler,
  type DirectoryTemplateReader,
  type ListingReviewOutcome,
  type ReviewResultMessageComposer,
} from "../modules/commerce/directory/index.js";
import { buildStorefrontOrganizationReader } from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildDirectoryBlockReader } from "../modules/platform/industry/index.js";

const SMS_KEYS: Readonly<Record<ListingReviewOutcome, string>> = {
  APPROVED: "sms.listingApproved",
  REJECTED: "sms.listingRejected",
};

/**
 * Builds the review-result text in the business's default language. The reasons come from the
 * template in that same language; an unknown key stays visible as itself. The staff note is never
 * read here (M.8b decision 4).
 */
export function buildReviewResultMessageComposer(
  template: DirectoryTemplateReader,
): ReviewResultMessageComposer {
  const organizations = buildStorefrontOrganizationReader();
  return {
    async compose(input) {
      const organization = await organizations.findActiveById(input.organizationId);
      const businessName = organization?.name ?? "";
      const locale = organization?.defaultLocale ?? PREFERRED_LOCALE.bn;
      const translator = createTranslator({ locale, brandName: businessName });
      return translator.t(SMS_KEYS[input.outcome], {
        businessName,
        listingNumber: input.listingNumber,
        reasons: await reasonLabels({
          template,
          organizationId: input.organizationId,
          locale,
          reasonKeys: input.reasonKeys,
        }),
      });
    },
  };
}

interface ReasonLabelQuery {
  readonly template: DirectoryTemplateReader;
  readonly organizationId: OrganizationId;
  readonly locale: PreferredLocale;
  readonly reasonKeys: readonly string[];
}

async function reasonLabels(query: ReasonLabelQuery): Promise<string> {
  const { template, organizationId, locale, reasonKeys } = query;
  if (reasonKeys.length === 0) return "";
  const block = await template.directoryBlockOf(organizationId);
  const labels = new Map(
    (block?.rejectionReasons ?? []).map((reason) => [reason.reasonKey, reason.label[locale]]),
  );
  return reasonKeys.map((key) => labels.get(key) ?? key).join(", ");
}

export interface DirectoryReviewSmsDependencies {
  readonly sms: SmsModuleDependencies;
  readonly clock: Clock;
  readonly smsDriver: StorefrontConfig["smsDriver"];
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

/** The worker calls it after the config service exists; the notifier comes from the contact module. */
export function registerDirectoryReviewSmsHandler(input: DirectoryReviewSmsDependencies): void {
  const settings = directorySettingsFromResolver(
    buildSettingsResolver({ orgConfig: input.orgConfig, manifests: input.manifests }),
  );
  const notifier: CustomerSmsNotifier = buildCustomerSmsNotifier({
    smsDriver: input.smsDriver,
    gatewaySender: buildGatewaySmsSender(input.sms),
    clock: input.clock,
  });
  registerDirectoryReviewResultHandler({
    listings: new MongoListingRepository(),
    settings,
    notifier,
    composer: buildReviewResultMessageComposer(buildDirectoryBlockReader()),
  });
}
