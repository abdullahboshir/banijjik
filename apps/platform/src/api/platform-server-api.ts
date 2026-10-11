import "server-only";
import { PLATFORM_ACCESS_TOKEN_COOKIE_NAME } from "@banijjik/contracts";
import { createServerApiFetch } from "@banijjik/web-client/server";
import { API_BASE_URL } from "../config/api-base-url";
import { API_PREFIX } from "./api-prefix";

/** Server components call the API with the operator's access cookie only (never the refresh cookie). */
export const { serverApiFetch } = createServerApiFetch({
  baseUrl: API_BASE_URL,
  apiPrefix: API_PREFIX,
  accessCookieName: PLATFORM_ACCESS_TOKEN_COOKIE_NAME,
});
