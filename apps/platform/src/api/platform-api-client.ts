import { redirectToSignIn, createApiClient } from "@banijjik/web-client";
import { API_BASE_URL } from "../config/api-base-url";
import { API_PREFIX } from "./api-prefix";

/** The operator audience: sign-in at `/platform/auth/*`, renewal through `/platform/auth/refresh`. */
export const platformApiClient = createApiClient({
  baseUrl: API_BASE_URL,
  apiPrefix: API_PREFIX,
  refreshPath: "/platform/auth/refresh",
  authPathPrefix: "/platform/auth/",
  onSessionLost: redirectToSignIn,
});

export const { apiFetch, refreshSession } = platformApiClient;
