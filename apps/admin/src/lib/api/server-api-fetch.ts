import "server-only";
import { ACCESS_TOKEN_COOKIE_NAME } from "@banijjik/contracts";
import { createServerApiFetch } from "@banijjik/web-client/server";
import { API_BASE_URL } from "../../config/api-base-url";
import { API_PREFIX } from "./api-url";

export type { ServerApiRequestOptions } from "@banijjik/web-client/server";

/** The generic server fetch lives in @banijjik/web-client; this is its configuration for the admin audience. */
export const { serverApiFetch, serverPublicApiFetch } = createServerApiFetch({
  baseUrl: API_BASE_URL,
  apiPrefix: API_PREFIX,
  accessCookieName: ACCESS_TOKEN_COOKIE_NAME,
});
