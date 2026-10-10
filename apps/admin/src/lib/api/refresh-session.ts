import { buildApiUrl } from "./api-url";
import { networkError } from "./api-error";

let renewalInFlight: Promise<boolean> | undefined;

async function requestRenewal(): Promise<boolean> {
  try {
    // Only the refresh cookie matters here; it is sent because credentials are included (ADR-010).
    const response = await fetch(buildApiUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return response.ok;
  } catch {
    throw networkError();
  }
}

/**
 * Asks the API for a new access cookie. Callers that arrive while a renewal is running share its result, so
 * parallel 401s cost one refresh: the refresh token rotates and a second use would count as reuse.
 * Resolves false when the refresh cookie is missing, expired or revoked.
 */
export function refreshSession(): Promise<boolean> {
  renewalInFlight ??= requestRenewal().finally(() => {
    renewalInFlight = undefined;
  });
  return renewalInFlight;
}
