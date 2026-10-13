import { createRequestPathProxy } from "@banijjik/web-client/proxy";
import { PLATFORM_SESSION_RENEWED_COOKIE } from "./src/auth/session-renewed-marker";

export const proxy = createRequestPathProxy(PLATFORM_SESSION_RENEWED_COOKIE);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
