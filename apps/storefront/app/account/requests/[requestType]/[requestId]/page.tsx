import type { Metadata } from "next";
import type { ReactElement } from "react";
import { RequestDetailView } from "../../../../../src/account/request-history";
import { parseRequestType } from "../../../../../src/account/requests-api";
import { storefrontTranslator } from "../../../../../src/i18n/translator";
import { requireOrganizationId } from "../../../../../src/site/current-site";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface RequestDetailPageProps {
  readonly params: Promise<{
    readonly requestType: string;
    readonly requestId: string;
  }>;
}

/**
 * Individual request detail page for orders, bookings, and enrollments.
 * Never indexed by search engines.
 */
export default async function RequestDetailPage({
  params,
}: RequestDetailPageProps): Promise<ReactElement> {
  const { requestType, requestId } = await params;
  const organizationId = await requireOrganizationId();
  const { locale } = await storefrontTranslator();

  return (
    <RequestDetailView
      organizationId={organizationId}
      requestType={parseRequestType(requestType)}
      requestId={requestId}
      locale={locale}
    />
  );
}
