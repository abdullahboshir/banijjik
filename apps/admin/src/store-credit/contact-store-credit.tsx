import type { ReactElement } from "react";
import {
  MODULE_KEY,
  PERMISSION_KEY,
  type LocationResponse,
  type OrganizationProfileResponse,
} from "@banijjik/contracts";
import type { ContactResponse } from "@banijjik/contracts/contact";
import type { StoreCreditEntryResponse } from "@banijjik/contracts/payment";
import type { Translator } from "@banijjik/i18n";
import { fetchBusinessResource } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ContactStoreCreditLazy } from "./contact-store-credit-lazy";
import { storeCreditLabelsOf } from "./store-credit-labels";

export async function ContactStoreCredit(props: {
  access: OrgAccess;
  contact: ContactResponse;
  translator: Translator;
}): Promise<ReactElement | null> {
  const { access, contact, translator } = props;
  if (
    !access.config.modules.includes(MODULE_KEY.PAYMENT) ||
    !holdsPermission(access.config.permissions, PERMISSION_KEY.PAYMENT_STORE_CREDIT_READ)
  )
    return null;
  const organizationId = access.organization.organizationId;
  const canAdjust =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.PAYMENT_STORE_CREDIT_ADJUST);
  const [history, profile, locations] = await Promise.all([
    fetchBusinessResource<StoreCreditEntryResponse[], { total: number }>(
      `/orgs/${organizationId}/store-credit?contactId=${contact.contactId}&limit=20`,
    ),
    fetchBusinessResource<OrganizationProfileResponse>(`/orgs/${organizationId}/profile`),
    canAdjust
      ? fetchBusinessResource<LocationResponse[]>(
          `/orgs/${organizationId}/locations?status=ACTIVE&limit=100`,
        )
      : undefined,
  ]);
  return (
    <ContactStoreCreditLazy
      organizationId={organizationId}
      contactId={contact.contactId}
      balanceMinor={contact.summary?.storeCreditBalanceMinor ?? 0}
      entries={history.data}
      total={history.meta?.total ?? 0}
      currency={profile.data.currencyCode}
      canAdjust={canAdjust}
      locations={locationOptions(locations?.data)}
      locale={translator.locale}
      timeZone={access.timeZone}
      labels={storeCreditLabelsOf(translator.t)}
    />
  );
}

function locationOptions(
  locations: readonly LocationResponse[] | undefined,
): { locationId: string; name: string }[] {
  return locations?.map(({ locationId, name }) => ({ locationId, name })) ?? [];
}
