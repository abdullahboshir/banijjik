import { createApiClient } from "@banijjik/web-client";
import { API_BASE_URL } from "../../config/api-base-url";
import { API_PREFIX } from "./api-url";
import { redirectToSignIn } from "./session-redirect";

/** The tenant audience: business staff sign in at `/auth/*` and renew through `/auth/refresh`. */
export const adminApiClient = createApiClient({
  baseUrl: API_BASE_URL,
  apiPrefix: API_PREFIX,
  refreshPath: "/auth/refresh",
  authPathPrefix: "/auth/",
  onSessionLost: redirectToSignIn,
});
