import "server-only";
import { ERROR_HTTP_STATUS } from "@banijjik/contracts";
import type { CustomerAccountResponse } from "@banijjik/contracts/contact";
import { requireSession } from "../auth/session-data";
import { ApiError } from "../lib/api/api-error";
import { serverApiFetch } from "../lib/api/server-api-fetch";

/**
 * A contact's website login, or `undefined` when it never signed in (the API answers 404). Any other
 * failure reaches the error page: the section must not pretend there is no login when the read failed.
 */
export function fetchWebsiteLogin(
  organizationId: string,
  contactId: string,
): Promise<CustomerAccountResponse | undefined> {
  return requireSession(async () => {
    try {
      const result = await serverApiFetch<CustomerAccountResponse>(
        `/orgs/${organizationId}/contacts/${contactId}/customer-account`,
      );
      return result.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === ERROR_HTTP_STATUS.NOT_FOUND) {
        return undefined;
      }
      throw error;
    }
  });
}
