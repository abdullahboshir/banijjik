import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import { readSignedInCustomer } from "../../../src/api/storefront-api";
import { requireSignedInCustomer } from "../../../src/account/require-customer";
import { BlockedListings } from "../../../src/listing/blocked-listings";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { requireOrganizationId } from "../../../src/site/current-site";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const MY_CONNECTIONS_PATH = "/my/connections";

interface UnlockListItem {
  readonly listingUnlockId: string;
  readonly listingNumber: string;
  readonly unlockedAt: string;
}

interface Paged<Item> {
  readonly items: readonly Item[];
  readonly total: number;
}

/** The listings the customer has unlocked, and the listings they have blocked (M.6 decision 16). */
export default async function MyConnectionsPage(): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  await requireSignedInCustomer(organizationId, MY_CONNECTIONS_PATH);
  const { translator } = await storefrontTranslator();
  const unlocks = await readSignedInCustomer<Paged<UnlockListItem>>(
    `/orgs/${organizationId}/my/unlocks`,
  );
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-display font-semibold text-primary">
          {translator.t("storefront.connections.title")}
        </h1>
        {unlocks === undefined || unlocks.items.length === 0 ? (
          <p className="text-body text-secondary">{translator.t("storefront.connections.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {unlocks.items.map((unlock) => (
              <li key={unlock.listingUnlockId} className="rounded-md border border-default p-4">
                <Link
                  href={`/listings/${encodeURIComponent(unlock.listingNumber)}`}
                  className="inline-flex min-h-11 items-center font-semibold text-brand underline"
                >
                  {translator.t("storefront.listing.number", { number: unlock.listingNumber })}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <BlockedListings organizationId={organizationId} />
    </div>
  );
}
