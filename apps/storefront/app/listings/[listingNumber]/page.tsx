import type {
  ListingResponse,
  StorefrontDirectoryFormResponse,
} from "@banijjik/contracts/directory";
import type { StorefrontMeResponse } from "@banijjik/contracts/contact";
import type { StorefrontSiteResponse } from "@banijjik/contracts/website";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { readAsVisitor, readPublic, readSignedInCustomer } from "../../../src/api/storefront-api";
import { ListingSections } from "../../../src/components/listing-sections";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { requireOrganizationId } from "../../../src/site/current-site";

interface ListingPageProps {
  readonly params: Promise<{ readonly listingNumber: string }>;
}

/** Listing pages are never indexed (M.6 decision 14: the template has no switch yet, so every page is private). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ListingPage({ params }: ListingPageProps): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  const { listingNumber } = await params;
  const { locale, translator } = await storefrontTranslator();
  const listing = await readAsVisitor<ListingResponse>(
    `/orgs/${organizationId}/listings/${encodeURIComponent(listingNumber)}`,
  );
  if (listing === undefined) notFound();
  const form = await readPublic<StorefrontDirectoryFormResponse>(
    `/orgs/${organizationId}/directory/form`,
  );
  if (form === undefined) notFound();
  const site = await readPublic<StorefrontSiteResponse>(`/orgs/${organizationId}/site`);
  const customer = await readSignedInCustomer<StorefrontMeResponse>(`/orgs/${organizationId}/me`);
  const showActions = site?.features.customerLogin === true && customer === undefined;
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-small text-secondary">
          {translator.t("storefront.listing.number", { number: listing.listingNumber })}
        </p>
      </header>
      <ListingSections listing={listing} form={form} locale={locale} translator={translator} />
      {showActions ? (
        <aside className="flex flex-col gap-3 rounded-md border border-default bg-subtle p-4">
          <p className="text-body text-secondary">
            {translator.t("storefront.listing.signInToAct")}
          </p>
          <Link
            href={`/sign-in?next=${encodeURIComponent(`/listings/${encodeURIComponent(listing.listingNumber)}`)}`}
            className="inline-flex min-h-11 w-fit items-center rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-hover"
          >
            {translator.t("storefront.nav.signIn")}
          </Link>
        </aside>
      ) : null}
      <Link href="/search" className="inline-flex min-h-11 w-fit items-center underline">
        {translator.t("storefront.listing.backToSearch")}
      </Link>
    </article>
  );
}
