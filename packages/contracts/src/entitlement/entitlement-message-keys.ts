import { PACKAGE_KEY } from "./package-key.js";

/** Message keys the package, billing and entitlement modules can send to a client. Both catalogs need each. */
export const ENTITLEMENT_MESSAGE_KEYS: readonly string[] = [
  "errors.route_without_module",
  "errors.trial_package_missing",
  ...Object.values(PACKAGE_KEY).map((packageKey) => `package.${packageKey}.name`),
];
