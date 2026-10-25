import type { ReactElement } from "react";
import { readSignedInCustomer } from "../api/storefront-api";
import { storefrontTranslator } from "../i18n/translator";
import { UnblockButton } from "./unblock-button";

interface BlockedListingItem {
  readonly listingBlockId: string;
  readonly listingNumber: string;
}

/** Listings this customer hid from their own search: each can be unblocked again (M.6 decision 16). */
export async function BlockedListings({
  organizationId,
}: {
  readonly organizationId: string;
}): Promise<ReactElement> {
  const { locale, translator } = await storefrontTranslator();
  const blocks = await readSignedInCustomer<{ readonly items: readonly BlockedListingItem[] }>(
    `/orgs/${organizationId}/my/listing-blocks?page=1&limit=100`,
  );
  const items = blocks?.items ?? [];
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title font-semibold text-primary">
        {translator.t("storefront.connections.blockedTitle")}
      </h2>
      {items.length === 0 ? (
        <p className="text-body text-secondary">
          {translator.t("storefront.connections.blockedEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((block) => (
            <li
              key={block.listingBlockId}
              className="flex flex-wrap items-center gap-3 rounded-md border border-default p-4"
            >
              <span className="text-body text-primary">
                {translator.t("storefront.listing.number", { number: block.listingNumber })}
              </span>
              <UnblockButton
                organizationId={organizationId}
                listingNumber={block.listingNumber}
                locale={locale}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
