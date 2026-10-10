import { asId, type UserId } from "@banijjik/ids";
import { getRequestContext } from "../context/index.js";
import { unauthenticated } from "../http/index.js";

/** The signed-in user, put into the request context by authenticate(). */
export function requireCurrentUserId(): UserId {
  const { userId } = getRequestContext();
  if (userId === undefined) throw unauthenticated();
  return asId<UserId>(userId);
}
