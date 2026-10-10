import { SignJWT } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { MutableClock } from "../../test-support/mutable-clock.js";
import { createTestApp } from "../../test-support/test-app.js";
import { TEST_ACCESS_TOKEN_SECRET } from "../../test-support/test-config.js";
import { TOKEN_AUDIENCE, type TokenAudience } from "@banijjik/contracts";
import { getRequestContext } from "../context/index.js";
import {
  ACCESS_TOKEN_ALGORITHM,
  audienceClaim,
  createJoseAccessTokenVerifier,
  secretToKey,
} from "./access-token-verifier.js";
import { authenticate } from "./authenticate.middleware.js";

const USER_ID = "0199a3b2-7c11-7a3e-9d5e-1f2e3d4c5b6a";
const SESSION_ID = "0199a3b2-7c11-7a3e-9d5e-aaaaaaaaaaaa";

const clock = new MutableClock();
const verifier = createJoseAccessTokenVerifier({ secret: TEST_ACCESS_TOKEN_SECRET, clock });

function createApp() {
  return createTestApp((router) => {
    router.get(
      "/private",
      authenticate({ audience: TOKEN_AUDIENCE.ADMIN, verifier }),
      (_request, response) => {
        response.json({ data: { userId: getRequestContext().userId } });
      },
    );
  }).app;
}

interface TokenOptions {
  readonly audience?: TokenAudience;
  readonly secret?: string;
  readonly expiresInSeconds?: number;
}

async function signToken(options: TokenOptions = {}): Promise<string> {
  const { audience = TOKEN_AUDIENCE.ADMIN, secret = TEST_ACCESS_TOKEN_SECRET } = options;
  const issuedAt = Math.floor(clock.now().getTime() / 1000);
  return new SignJWT({ sid: SESSION_ID })
    .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM })
    .setSubject(USER_ID)
    .setAudience(audienceClaim(audience))
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + (options.expiresInSeconds ?? 900))
    .sign(secretToKey(secret));
}

function getPrivate(token?: string) {
  const call = request(createApp()).get("/api/v1/private");
  return token === undefined ? call : call.set("Cookie", `access_token=${token}`);
}

describe("authenticate", () => {
  it("puts the user id into the request context for a valid token", async () => {
    const response = await getPrivate(await signToken());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { userId: USER_ID } });
  });

  it("answers 401 without a cookie", async () => {
    const response = await getPrivate();

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("answers 401 for a tampered token", async () => {
    const token = await signToken();
    const tampered = `${token.slice(0, -4)}AAAA`;

    const response = await getPrivate(tampered);

    expect(response.status).toBe(401);
  });

  it("answers 401 for a token signed with another secret", async () => {
    const response = await getPrivate(
      await signToken({ secret: "another-secret-0123456789abcdefghij" }),
    );

    expect(response.status).toBe(401);
  });

  it("answers 401 for an expired token, judged by the clock", async () => {
    const token = await signToken({ expiresInSeconds: 900 });
    clock.advanceSeconds(901);

    const response = await getPrivate(token);

    clock.advanceSeconds(-901);
    expect(response.status).toBe(401);
  });

  it.each([TOKEN_AUDIENCE.STOREFRONT, TOKEN_AUDIENCE.PLATFORM])(
    "answers 401 for a token of audience %s",
    async (audience) => {
      const response = await getPrivate(await signToken({ audience }));

      expect(response.status).toBe(401);
    },
  );

  it("answers 401 for text that is not a token at all", async () => {
    const response = await getPrivate("not-a-jwt");

    expect(response.status).toBe(401);
  });
});
