import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { fetchPublicOfferingDetail } from "../../../src/catalog/storefront-catalog-api";
import { OfferingDetailView } from "../../../src/catalog/offering-detail-view";
import { localizedText } from "../../../src/i18n/localized-text";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { currentSiteResolution, requireOrganizationId } from "../../../src/site/current-site";
import { buildPageMetadata } from "../../../src/site/site-metadata";

interface OfferingDetailPageProps {
  readonly params: Promise<{ readonly offeringSlug: string }>;
  readonly searchParams: Promise<{ readonly location?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: OfferingDetailPageProps): Promise<Metadata> {
  const organizationId = await requireOrganizationId();
  const { offeringSlug } = await params;
  const { location } = await searchParams;
  const { locale } = await storefrontTranslator();
  const resolution = await currentSiteResolution();

  const offering = await fetchPublicOfferingDetail(organizationId, offeringSlug, location);
  if (!offering) {
    return buildPageMetadata({
      canonicalHostname: resolution?.canonicalHostname,
      title: "Not Found",
      path: `/offerings/${offeringSlug}`,
    });
  }

  return buildPageMetadata({
    canonicalHostname: resolution?.canonicalHostname,
    title: localizedText(offering.name, locale),
    path: `/offerings/${offeringSlug}`,
  });
}

export default async function OfferingDetailPage({
  params,
  searchParams,
}: OfferingDetailPageProps): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  const { offeringSlug } = await params;
  const { location } = await searchParams;
  const { locale } = await storefrontTranslator();

  const offering = await fetchPublicOfferingDetail(organizationId, offeringSlug, location);
  if (!offering) notFound();

  return (
    <OfferingDetailView
      organizationId={organizationId}
      locale={locale}
      offering={offering}
      defaultLocationId={location}
    />
  );
}
