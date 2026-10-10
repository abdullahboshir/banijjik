import { getRequestContext } from "../context/index.js";
import { unauthenticated } from "../http/index.js";

/** The signed-in platform operator, put into the request context by authenticatePlatform(). */
export function requirePlatformOperatorId(): string {
  const { platformOperatorId } = getRequestContext();
  if (platformOperatorId === undefined) throw unauthenticated();
  return platformOperatorId;
}
