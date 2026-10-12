import {
  PLATFORM_PERMISSION_KEY,
  PLATFORM_ROLE,
  TOKEN_AUDIENCE,
  type PlatformRole,
  type TokenAudience,
} from "@banijjik/contracts";
import { SignJWT } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { MutableClock } from "../../test-support/mutable-clock.js";
import { createTestApp } from "../../test-support/test-app.js";
import { TEST_ACCESS_TOKEN_SECRET } from "../../test-support/test-config.js";
import { getRequestContext } from "../context/index.js";
import {
  ACCESS_TOKEN_ALGORITHM,
  audienceClaim,
  createJoseAccessTokenVerifier,
  secretToKey,
} from "./access-token-verifier.js";
import {
  authenticatePlatform,
  type ActivePlatformOperator,
  type PlatformOperatorLookup,
} from "./authenticate-platform.middleware.js";
import { platformPermission } from "./platform-permission.middleware.js";

const USER_ID = "0199a3b2-7c11-7a3e-9d5e-1f2e3d4c5b6a";
const OPERATOR_ID = "0199a3b2-7c11-7a3e-9d5e-bbbbbbbbbbbb";
const SESSION_ID = "0199a3b2-7c11-7a3e-9d5e-aaaaaaaaaaaa";

const clock = new MutableClock();
const verifier = createJoseAccessTokenVerifier({ secret: TEST_ACCESS_TOKEN_SECRET, clock });

function operatorWith(roles: readonly PlatformRole[]): PlatformOperatorLookup {
  const operator: ActivePlatformOperator = {
    platformOperatorId: OPERATOR_ID,
    platformRoles: roles,
  };
  return { findActiveOperator: async (userId) => (userId === USER_ID ? operator : undefined) };
}

const NO_OPERATOR: PlatformOperatorLookup = { findActiveOperator: async () => undefined };

function createApp(operators: PlatformOperatorLookup) {
  return createTestApp((router) => {
    router.get("/who", authenticatePlatform({ verifier, operators }), (_request, response) => {
      const { userId, platformOperatorId, platformRoles } = getRequestContext();
      response.json({ data: { userId, platformOperatorId, platformRoles } });
    });
    router.get(
      "/packages",
      authenticatePlatform({ verifier, operators }),
      platformPermission(PLATFORM_PERMISSION_KEY.PACKAGE_WRITE),
      (_request, response) => {
        response.json({ data: "ok" });
      },
    );
  }).app;
}

async function signToken(audience: TokenAudience): Promise<string> {
  const issuedAt = Math.floor(clock.now().getTime() / 1000);
  return new SignJWT({ sid: SESSION_ID })
    .setProtectedHeader({ alg: ACCESS_TOKEN_ALGORITHM })
    .setSubject(USER_ID)
    .setAudience(audienceClaim(audience))
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 900)
    .sign(secretToKey(TEST_ACCESS_TOKEN_SECRET));
}

function get(app: ReturnType<typeof createApp>, path: string, cookie?: string) {
  const call = request(app).get(`/api/v1${path}`);
  return cookie === undefined ? call : call.set("Cookie", cookie);
}

describe("authenticatePlatform", () => {
  it("puts the operator and its roles into the request context for a platform token", async () => {
    const app = createApp(operatorWith([PLATFORM_ROLE.SUPPORT]));
    const token = await signToken(TOKEN_AUDIENCE.PLATFORM);

    const response = await get(app, "/who", `platform_access_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      userId: USER_ID,
      platformOperatorId: OPERATOR_ID,
      platformRoles: [PLATFORM_ROLE.SUPPORT],
    });
  });

  it("answers 401 without a cookie", async () => {
    const response = await get(createApp(operatorWith([])), "/who");
    expect(response.status).toBe(401);
  });

  it("refuses an admin token, even when it is sent in the platform cookie", async () => {
    const token = await signToken(TOKEN_AUDIENCE.ADMIN);

    const response = await get(
      createApp(operatorWith([])),
      "/who",
      `platform_access_token=${token}`,
    );

    expect(response.status).toBe(401);
  });

  it("ignores the admin cookie: a platform token under access_token does not sign in", async () => {
    const token = await signToken(TOKEN_AUDIENCE.PLATFORM);

    const response = await get(createApp(operatorWith([])), "/who", `access_token=${token}`);

    expect(response.status).toBe(401);
  });

  it("answers 401 when the user is no active operator, so a disabled operator stops at once", async () => {
    const token = await signToken(TOKEN_AUDIENCE.PLATFORM);

    const response = await get(createApp(NO_OPERATOR), "/who", `platform_access_token=${token}`);

    expect(response.status).toBe(401);
  });
});

describe("platformPermission", () => {
  it("lets a role that grants the key through", async () => {
    const token = await signToken(TOKEN_AUDIENCE.PLATFORM);
    const app = createApp(operatorWith([PLATFORM_ROLE.SUPER_ADMIN]));

    const response = await get(app, "/packages", `platform_access_token=${token}`);

    expect(response.status).toBe(200);
  });

  it("answers 403 FORBIDDEN when no role grants the key", async () => {
    const token = await signToken(TOKEN_AUDIENCE.PLATFORM);
    const app = createApp(operatorWith([PLATFORM_ROLE.SUPPORT]));

    const response = await get(app, "/packages", `platform_access_token=${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
