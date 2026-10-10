import { SYSTEM_REASON, TOKEN_AUDIENCE } from "@banijjik/contracts";
import { Router, type Express } from "express";
import { buildApp } from "../../app.js";
import { authenticate, createJoseAccessTokenVerifier } from "../../kernel/auth/index.js";
import { asSystemPort } from "../../kernel/context/index.js";
import { createLogger } from "../../kernel/logger/index.js";
import { locationAccess, tenantContext } from "../../kernel/tenancy/index.js";
import { buildMembershipDirectory } from "../../modules/core/organization/index.js";
import type { IamApiHarness } from "../iam-api-harness.js";
import { buildContractProbeRouter } from "./probe-modules.js";

/**
 * The probe routes behind the real authentication and tenant pipeline but with NO entitlement
 * gate: a probe route "mounted without the gate". Only the negative test of the contract suite
 * uses it, to prove the route assertion notices a module that is off but still answering.
 */
export function buildUngatedApp(harness: IamApiHarness): Express {
  const { config, clock } = harness;
  const verifier = createJoseAccessTokenVerifier({ secret: config.auth.accessTokenSecret, clock });
  const membershipDirectory = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMembershipDirectory());
  const v1Router = Router();
  v1Router.use(
    "/orgs/:organizationId",
    authenticate({ audience: TOKEN_AUDIENCE.ADMIN, verifier }),
    tenantContext({ directory: membershipDirectory }),
    locationAccess(),
    buildContractProbeRouter(),
  );
  const logger = createLogger({ level: "debug", destination: harness.logs.destination });
  return buildApp({ config, logger, clock, v1Router });
}
