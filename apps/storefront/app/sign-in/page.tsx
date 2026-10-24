import type { StorefrontMeResponse } from "@banijjik/contracts/contact";
import type { StorefrontSiteResponse } from "@banijjik/contracts/website";
import { safeNextPath } from "@banijjik/web-client";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { readPublic, readSignedInCustomer } from "../../src/api/storefront-api";
import { SignInForm } from "../../src/components/sign-in-form";
import { storefrontTranslator } from "../../src/i18n/translator";
import { requireOrganizationId } from "../../src/site/current-site";

interface SignInPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/** Sign-in is not indexed; it lives behind the business's own host and asks for the phone first. */
export const metadata = { robots: { index: false, follow: false } };

export default async function SignInPage({ searchParams }: SignInPageProps): Promise<ReactElement> {
  const organizationId = await requireOrganizationId();
  const params = await searchParams;
  const { locale, translator } = await storefrontTranslator();
  const site = await readPublic<StorefrontSiteResponse>(`/orgs/${organizationId}/site`);
  if (site === undefined) notFound();
  const nextValue = Array.isArray(params["next"]) ? params["next"][0] : params["next"];
  const nextPath = safeNextPath(nextValue);
  if (!site.features.customerLogin) {
    return <p className="text-body text-secondary">{translator.t("storefront.signIn.notOpen")}</p>;
  }
  const customer = await readSignedInCustomer<StorefrontMeResponse>(`/orgs/${organizationId}/me`);
  if (customer !== undefined) {
    return (
      <section className="flex flex-col gap-4">
        <p className="text-body text-primary">
          {translator.t("storefront.signIn.signedIn", {
            name: customer.name ?? customer.phoneE164,
          })}
        </p>
        <Link href={nextPath} className="inline-flex min-h-11 w-fit items-center underline">
          {translator.t("storefront.pages.backHome")}
        </Link>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-display font-semibold text-primary">
        {translator.t("storefront.signIn.title")}
      </h1>
      <p className="text-body text-secondary">{translator.t("storefront.signIn.intro")}</p>
      <SignInForm organizationId={organizationId} locale={locale} nextPath={nextPath} />
    </section>
  );
}
