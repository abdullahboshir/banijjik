import { PACKAGE_KEY } from "./package-key.js";

/** Message keys the package, billing and entitlement modules can send to a client. Both catalogs need each. The two internal errors of card 1.6a are masked as errors.internal, so they have no text. */
export const ENTITLEMENT_MESSAGE_KEYS: readonly string[] = [
  ...Object.values(PACKAGE_KEY).map((packageKey) => `package.${packageKey}.name`),
];
