import type { Metadata } from "next";
import type { ReactElement } from "react";
import { RequestHistoryView } from "../../../src/account/request-history";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { requireOrganizationId } from "../../../src/site/current-site";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Customer and guest request history page.
 * Never indexed by search engines.
 */
export default async function AccountRequestsPage(): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  const { locale } = await storefrontTranslator();

  return <RequestHistoryView organizationId={organizationId} locale={locale} />;
}
