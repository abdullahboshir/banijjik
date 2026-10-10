import { newId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { TOKEN_AUDIENCE } from "@banijjik/contracts";
import { createJoseAccessTokenVerifier } from "../../../../kernel/auth/index.js";
import { MutableClock } from "../../../../test-support/mutable-clock.js";
import { TEST_ACCESS_TOKEN_SECRET } from "../../../../test-support/test-config.js";
import { Argon2PasswordHasher } from "./argon2-password-hasher.js";
import { JwtTokenIssuer } from "./jwt-token-issuer.js";

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();

  it("produces an argon2id hash with the OWASP parameters (19 MiB, 2 iterations, 1 lane)", async () => {
    const hash = await hasher.hash("correct horse battery staple");

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it("verifies the right password and refuses a wrong one", async () => {
    const hash = await hasher.hash("correct horse battery staple");

    await expect(hasher.verify(hash, "correct horse battery staple")).resolves.toBe(true);
    await expect(hasher.verify(hash, "wrong horse battery staple")).resolves.toBe(false);
  });

  it("salts every hash, so equal passwords give different hashes", async () => {
    const first = await hasher.hash("same password");
    const second = await hasher.hash("same password");

    expect(first).not.toBe(second);
  });

  it("does not put the password into the hash text", async () => {
    const hash = await hasher.hash("very-recognisable-password");

    expect(hash).not.toContain("very-recognisable-password");
  });
});

describe("JwtTokenIssuer", () => {
  const clock = new MutableClock();
  const issuer = new JwtTokenIssuer({ secret: TEST_ACCESS_TOKEN_SECRET, ttlSeconds: 900, clock });
  const verifier = createJoseAccessTokenVerifier({ secret: TEST_ACCESS_TOKEN_SECRET, clock });
  const claims = { userId: newId() as UserId, refreshSessionId: newId() };

  it("issues a token the kernel verifier accepts for the admin audience", async () => {
    const token = await issuer.issueAccessToken(claims);

    await expect(verifier.verify(token, TOKEN_AUDIENCE.ADMIN)).resolves.toEqual({
      userId: claims.userId,
      refreshSessionId: claims.refreshSessionId,
    });
  });

  it("issues a token that other audiences refuse", async () => {
    const token = await issuer.issueAccessToken(claims);

    await expect(verifier.verify(token, TOKEN_AUDIENCE.PLATFORM)).resolves.toBeUndefined();
    await expect(verifier.verify(token, TOKEN_AUDIENCE.STOREFRONT)).resolves.toBeUndefined();
  });

  it("expires 900 seconds after it was issued", async () => {
    const token = await issuer.issueAccessToken(claims);

    clock.advanceSeconds(899);
    await expect(verifier.verify(token, TOKEN_AUDIENCE.ADMIN)).resolves.toBeDefined();
    clock.advanceSeconds(2);
    await expect(verifier.verify(token, TOKEN_AUDIENCE.ADMIN)).resolves.toBeUndefined();
  });
});
