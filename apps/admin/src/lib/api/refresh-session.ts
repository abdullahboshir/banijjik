import { adminApiClient } from "./admin-api-client";

/** One shared renewal for the admin audience (see @banijjik/web-client). */
export const refreshSession = adminApiClient.refreshSession;
