import type { Metadata } from "next";
import type { ReactElement } from "react";
import { DataExportButton } from "../../../src/account/data-export-button";
import { LazyEraseAccountDialog } from "../../../src/account/lazy-erase-account-dialog";
import { requireSignedInCustomer } from "../../../src/account/require-customer";
import { storefrontTranslator } from "../../../src/i18n/translator";
import { requireOrganizationId } from "../../../src/site/current-site";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const MY_ACCOUNT_PATH = "/my/account";

/** The customer's data: export as a file, or erase the account after a code sent to the phone. */
export default async function MyAccountPage(): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  await requireSignedInCustomer(organizationId, MY_ACCOUNT_PATH);
  const { locale, translator } = await storefrontTranslator();
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h1 className="text-display font-semibold text-primary">
          {translator.t("storefront.account.title")}
        </h1>
        <h2 className="text-title font-semibold text-primary">
          {translator.t("storefront.account.exportTitle")}
        </h2>
        <p className="text-body text-secondary">{translator.t("storefront.account.exportIntro")}</p>
        <DataExportButton organizationId={organizationId} locale={locale} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-title font-semibold text-danger">
          {translator.t("storefront.account.eraseTitle")}
        </h2>
        <LazyEraseAccountDialog organizationId={organizationId} locale={locale} />
      </section>
    </div>
  );
}
