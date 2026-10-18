import type { CustomerAccountResponse } from "@banijjik/contracts/contact";
import { apiFetch } from "../lib/api/api-client";

export type WebsiteLoginChange = "block" | "unblock";

/** `POST …/contacts/{contactId}/customer-account/block` or `/unblock` with the version read. */
export async function changeWebsiteLogin(
  organizationId: string,
  contactId: string,
  request: { readonly change: WebsiteLoginChange; readonly version: number },
): Promise<CustomerAccountResponse> {
  const result = await apiFetch<CustomerAccountResponse>(
    `/orgs/${organizationId}/contacts/${contactId}/customer-account/${request.change}`,
    { method: "POST", body: { version: request.version } },
  );
  return result.data;
}
