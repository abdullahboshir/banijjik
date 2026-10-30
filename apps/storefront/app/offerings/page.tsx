import type { Metadata } from "next";
import type { OfferingKind } from "@banijjik/contracts/catalog";
import type { ReactElement } from "react";
import {
  fetchPublicCategories,
  fetchPublicLocations,
  fetchPublicOfferings,
} from "../../src/catalog/storefront-catalog-api";
import { OfferingCatalogView } from "../../src/catalog/offering-catalog-view";
import { storefrontTranslator } from "../../src/i18n/translator";
import { currentSiteResolution, requireOrganizationId } from "../../src/site/current-site";
import { buildPageMetadata } from "../../src/site/site-metadata";

interface OfferingsPageSearchParams {
  readonly page?: string;
  readonly limit?: string;
  readonly q?: string;
  readonly kind?: string;
  readonly categoryId?: string;
  readonly location?: string;
}

interface OfferingsPageProps {
  readonly searchParams: Promise<OfferingsPageSearchParams>;
}

export async function generateMetadata(): Promise<Metadata> {
  const resolution = await currentSiteResolution();
  const { translator } = await storefrontTranslator();
  return buildPageMetadata({
    canonicalHostname: resolution?.canonicalHostname,
    title: translator.t("storefront.catalog.title"),
    path: "/offerings",
  });
}

export default async function OfferingsPage({
  searchParams,
}: OfferingsPageProps): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  const params = await searchParams;
  const { locale } = await storefrontTranslator();

  const page = params.page ? Number(params.page) : 1;
  const limit = params.limit ? Number(params.limit) : 20;
  const q = params.q;
  const kind = params.kind as OfferingKind | undefined;
  const categoryId = params.categoryId;
  const locationId = params.location;

  const [offeringsData, categoriesData, locations] = await Promise.all([
    fetchPublicOfferings(organizationId, {
      page,
      limit,
      q,
      kind,
      categoryId,
      locationId,
    }),
    fetchPublicCategories(organizationId),
    fetchPublicLocations(organizationId),
  ]);

  const initialOfferings = offeringsData ?? {
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  };

  const categories = categoriesData?.items ?? [];

  return (
    <OfferingCatalogView
      organizationId={organizationId}
      locale={locale}
      initialOfferings={initialOfferings}
      categories={categories}
      locations={locations}
      selectedLocationId={locationId}
      selectedCategoryId={categoryId}
      selectedKind={kind}
      initialSearchQuery={q}
    />
  );
}
