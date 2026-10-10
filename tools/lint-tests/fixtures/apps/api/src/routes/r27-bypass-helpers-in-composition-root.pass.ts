import { SYSTEM_REASON } from "@banijjik/contracts";
import { asSystemPort } from "../kernel/context/index.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";

export function composeBypasses(port: object): {
  wrapped: object;
  run: typeof runInOrganizationContext;
} {
  return { wrapped: asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, port), run: runInOrganizationContext };
}
