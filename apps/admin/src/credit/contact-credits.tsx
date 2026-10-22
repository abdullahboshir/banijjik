import {
  MODULE_KEY,
  PERMISSION_KEY,
  SYSTEM_ROLE_KEY,
  type LocationResponse,
} from "@banijjik/contracts";
import type { CreditAccountResponse } from "@banijjik/contracts/credit";
import type { ContactResponse } from "@banijjik/contracts/contact";
import type { Translator } from "@banijjik/i18n";
import type { ReactElement } from "react";
import { fetchWebsiteLogin } from "../contacts/website-login-data";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ContactCreditsSectionLazy } from "./contact-credits-lazy";
import { contactCreditsLabelsOf } from "./credit-labels";

const HISTORY_LIMIT = 20;
const LOCATION_LIMIT = 100;

/**
 * The "Credits" section of a contact's page (M.4): balance, history and the staff adjustment.
 * It shows only for a contact with a customer account, when the credit module is on and the caller
 * may read both the account and its credits. Adjusting also needs the adjust key and a business that
 * is not read-only. The API checks every one of these again.
 */
export async function ContactCredits(props: {
  access: OrgAccess;
  contact: ContactResponse;
  translator: Translator;
}): Promise<ReactElement | null> {
  const { access, contact, translator } = props;
  const { modules, permissions } = access.config;
  if (!modules.includes(MODULE_KEY.CREDIT)) return null;
  const mayMapAccount = holdsPermission(permissions, PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_READ);
  const mayReadCredits = holdsPermission(permissions, PERMISSION_KEY.CREDIT_ACCOUNT_READ);
  if (!mayMapAccount || !mayReadCredits) return null;

  const { organizationId, roleKeys } = access.organization;
  const customerAccount = await fetchWebsiteLogin(organizationId, contact.contactId);
  if (customerAccount === undefined) return null;

  const { data: account } = await fetchBusinessResource<CreditAccountResponse>(
    `/orgs/${organizationId}/credit/accounts/${customerAccount.customerAccountId}?limit=${HISTORY_LIMIT}`,
  );
  const canAdjust =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.CREDIT_ACCOUNT_ADJUST);
  const isOwner = roleKeys.includes(SYSTEM_ROLE_KEY.OWNER);
  const locations =
    canAdjust && !isOwner
      ? ((await fetchBusinessResourceIfAllowed<LocationResponse[]>(
          `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOCATION_LIMIT}`,
        )) ?? [])
      : [];
  return (
    <ContactCreditsSectionLazy
      organizationId={organizationId}
      customerAccountId={customerAccount.customerAccountId}
      account={account}
      canAdjust={canAdjust}
      isOwner={isOwner}
      locations={locations.map((location) => ({
        locationId: location.locationId,
        name: location.name,
      }))}
      locale={translator.locale}
      timeZone={access.timeZone}
      labels={contactCreditsLabelsOf(translator.t)}
    />
  );
}
