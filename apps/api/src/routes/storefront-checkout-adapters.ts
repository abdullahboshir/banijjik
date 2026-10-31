import type { ModuleManifest } from "@banijjik/contracts";
import {
  WEBSITE_CHECKOUT_ENABLED_SETTING_KEY,
  WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY,
} from "@banijjik/contracts/website";
import { asId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import {
  buildCustomerAccountLookup,
  buildProvisionalGuestContactCreator,
  type ProvisionalGuestContactCreatorOptions,
} from "../modules/commerce/contact/index.js";
import type {
  CustomerPhoneReaderPort,
  GuestContactPort,
  OrgStorefrontConfigReader,
  StorefrontOrganizationConfig,
} from "../modules/commerce/website/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";

export function buildGuestContactAdapter(
  options: ProvisionalGuestContactCreatorOptions,
): GuestContactPort {
  const creator = buildProvisionalGuestContactCreator(options);
  return {
    ensureProvisionalContact: async (input) => {
      const res = await creator.execute({
        organizationId: input.organizationId,
        guestSessionId: input.guestSessionId,
        name: input.contactSnapshot.name,
        phoneE164: input.contactSnapshot.phoneE164,
        customFields: input.contactSnapshot.customFields,
      });
      return res.contactId;
    },
  };
}

export function buildCustomerPhoneReaderAdapter(): CustomerPhoneReaderPort {
  const lookup = buildCustomerAccountLookup();
  return {
    getVerifiedPhone: async (_orgId: string, customerAccountId: string) => {
      const account = await lookup.findById(asId<CustomerAccountId>(customerAccountId));
      return account ? account.phoneE164 : null;
    },
  };
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === "string") : [];
}

/**
 * The public checkout switches of one organization. Values come from the settings resolver, so an
 * org without an explicit row still sees the manifest's system defaults (checkout is off unless
 * the org turns it on).
 */
export function buildOrgStorefrontConfigReaderAdapter(
  orgConfig: OrgConfigService,
  manifests: readonly ModuleManifest[],
): OrgStorefrontConfigReader {
  const settings = buildSettingsResolver({ orgConfig, manifests });
  return {
    readStorefrontConfig: async (organizationId: string): Promise<StorefrontOrganizationConfig> => {
      const resolved = await orgConfig.forOrganization(organizationId);
      const values = await settings.resolve(asId<OrganizationId>(organizationId), {
        keys: [WEBSITE_CHECKOUT_ENABLED_SETTING_KEY, WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY],
      });
      return {
        checkoutEnabled: values.get(WEBSITE_CHECKOUT_ENABLED_SETTING_KEY)?.value === true,
        isReadOnly: resolved.accessMode === "READ_ONLY",
        isSuspended: false,
        publicLocationIds: stringList(values.get(WEBSITE_PUBLIC_LOCATION_IDS_SETTING_KEY)?.value),
        configVersion: resolved.config.configVersion ?? 1,
      };
    },
  };
}

export function buildResolveCustomerContactId(): (
  organizationId: string,
  customerAccountId: string,
) => Promise<string | undefined> {
  const lookup = buildCustomerAccountLookup();
  return async (_orgId: string, customerAccountId: string) => {
    const account = await lookup.findById(asId<CustomerAccountId>(customerAccountId));
    return account?.contactId;
  };
}
