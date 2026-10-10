import { SYSTEM_REASON } from "@banijjik/contracts";
import { asSystemPort } from "../../../../kernel/context/index.js";

export function wrapItself(port: object): object {
  return asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, port);
}
