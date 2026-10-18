import { PERMISSION_KEY } from "@banijjik/contracts";
import type { ContactResponse } from "@banijjik/contracts/contact";
import type { Translator } from "@banijjik/i18n";
import type { ReactElement } from "react";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { fetchWebsiteLogin } from "./website-login-data";
import { WebsiteLoginSection } from "./website-login-section";

/**
 * The "Website login" section of a contact's page (card M.1). It shows only for an active contact and a
 * person who may read website logins; changing one also needs the block permission and a business that
 * is not read-only. The API checks every one of these again.
 */
export async function WebsiteLogin(props: {
  access: OrgAccess;
  contact: ContactResponse;
  translator: Translator;
}): Promise<ReactElement | null> {
  const { access, contact, translator } = props;
  const { permissions } = access.config;
  const mayRead = holdsPermission(permissions, PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_READ);
  if (contact.status !== "ACTIVE" || !mayRead) return null;
  const { organizationId } = access.organization;
  return (
    <WebsiteLoginSection
      organizationId={organizationId}
      contactId={contact.contactId}
      account={await fetchWebsiteLogin(organizationId, contact.contactId)}
      canBlock={
        access.canWrite &&
        holdsPermission(permissions, PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_BLOCK)
      }
      translator={translator}
      timeZone={access.timeZone}
    />
  );
}
