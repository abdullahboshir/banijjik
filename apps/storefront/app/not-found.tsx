import type { ReactElement } from "react";
import { readPublic } from "../src/api/storefront-api";
import { organizationIdFrom } from "../src/host/organization-header";
import { storefrontTranslator } from "../src/i18n/translator";
import { headers } from "next/headers";
import type { StorefrontSiteResponse } from "@banijjik/contracts/website";

/** A host with no business says so; a page that does not exist says that instead (the layout is shared). */
export default async function NotFoundPage(): Promise<ReactElement> {
  const { translator } = await storefrontTranslator();
  const organizationId = organizationIdFrom(await headers());
  const site =
    organizationId === undefined
      ? undefined
      : await readPublic<StorefrontSiteResponse>(`/orgs/${organizationId}/site`);
  const isSiteMissing = site === undefined;
  return (
    <section className="flex flex-col gap-2 py-8">
      <h1 className="text-title font-semibold text-primary">
        {translator.t(isSiteMissing ? "storefront.site.notFound" : "storefront.page.notFound")}
      </h1>
      <p className="text-body text-secondary">
        {translator.t(isSiteMissing ? "storefront.site.notFoundHelp" : "storefront.pages.backHome")}
      </p>
    </section>
  );
}
