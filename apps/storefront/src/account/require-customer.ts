import type { StorefrontMeResponse } from "@banijjik/contracts/contact";
import { redirect } from "next/navigation";
import { readSignedInCustomer } from "../api/storefront-api";

/**
 * The signed-in customer of a signed-in page. A visitor without a valid session goes to sign-in and
 * comes back to the page they asked for (the refresh cookie is renewed in the browser, M.6 amendment 2).
 */
export async function requireSignedInCustomer(
  organizationId: string,
  nextPath: string,
): Promise<StorefrontMeResponse> {
  const customer = await readSignedInCustomer<StorefrontMeResponse>(`/orgs/${organizationId}/me`);
  if (customer === undefined) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return customer;
}
