import { TOKEN_AUDIENCE } from "@banijjik/contracts";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { MutableClock } from "../../test-support/mutable-clock.js";
import { TEST_ACCESS_TOKEN_SECRET } from "../../test-support/test-config.js";
import { ACCESS_TOKEN_ALGORITHM, audienceClaim, secretToKey } from "./access-token-verifier.js";
import { createCustomerTokenIssuer, createCustomerTokenVerifier } from "./customer-access-token.js";

const clock = new MutableClock();
const claims = { customerAccountId: "account-1", organizationId: "organization-1" };
const issuer = createCustomerTokenIssuer({
  secret: TEST_ACCESS_TOKEN_SECRET,
  clock,
  ttlSeconds: 900,
});
const verifier = createCustomerTokenVerifier({ secret: TEST_ACCESS_TOKEN_SECRET, clock });

async function adminToken(): Promise<string> {
  const issuedAt = Math.floor(clock.now().getTime() / 1000);
  return new SignJWT({ sid: "session-1", org: claims.organizationId })
    .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM })
    .setSubject("user-1")
    .setAudience(audienceClaim(TOKEN_AUDIENCE.ADMIN))
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 900)
    .sign(secretToKey(TEST_ACCESS_TOKEN_SECRET));
}

describe("customer access token", () => {
  it("carries the account and the business that issued it", async () => {
    expect(await verifier.verify(await issuer.issue(claims))).toEqual(claims);
  });

  it("is refused after it expires", async () => {
    const token = await issuer.issue(claims);

    clock.advanceSeconds(901);

    expect(await verifier.verify(token)).toBeUndefined();
  });

  it("is refused when it is an admin token, even one with an organization claim", async () => {
    expect(await verifier.verify(await adminToken())).toBeUndefined();
  });

  it("is refused when signed with another secret", async () => {
    const other = createCustomerTokenIssuer({
      secret: `${TEST_ACCESS_TOKEN_SECRET}-other`,
      clock,
      ttlSeconds: 900,
    });

    expect(await verifier.verify(await other.issue(claims))).toBeUndefined();
  });
});
