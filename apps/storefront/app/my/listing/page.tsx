import type {
  ListingResponse,
  StorefrontDirectoryFormResponse,
} from "@banijjik/contracts/directory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { readPublic, readSignedInCustomer } from "../../../src/api/storefront-api";
import { LazyListingForm } from "../../../src/account/lazy-listing-form";
import { requireSignedInCustomer } from "../../../src/account/require-customer";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { requireOrganizationId } from "../../../src/site/current-site";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const MY_LISTING_PATH = "/my/listing";

interface MyListingPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/** The customer's own biodata: a multi-step form built from the business's template (M.6 decision 15). */
export default async function MyListingPage({
  searchParams,
}: MyListingPageProps): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  await requireSignedInCustomer(organizationId, MY_LISTING_PATH);
  const { locale, translator } = await storefrontTranslator();
  const form = await readPublic<StorefrontDirectoryFormResponse>(
    `/orgs/${organizationId}/directory/form`,
  );
  if (form === undefined) notFound();
  const listing = await readSignedInCustomer<ListingResponse>(`/orgs/${organizationId}/my/listing`);
  const params = await searchParams;
  const conflict = params["conflict"] === "1";
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-display font-semibold text-primary">
        {translator.t("storefront.account.myListingTitle")}
      </h1>
      {conflict ? (
        <p role="alert" className="text-body text-danger">
          {translator.t("storefront.account.conflict")}
        </p>
      ) : null}
      <LazyListingForm
        organizationId={organizationId}
        locale={locale}
        form={form}
        listing={listing}
      />
    </section>
  );
}
