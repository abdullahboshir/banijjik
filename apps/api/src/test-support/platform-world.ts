import {
  PLATFORM_ACCESS_TOKEN_COOKIE_NAME,
  PLATFORM_REFRESH_TOKEN_COOKIE_NAME,
  USER_STATUS,
  type PlatformRole,
} from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import type { Express } from "express";
import type { Response } from "supertest";
import type { DatabaseConnections } from "../kernel/db/index.js";
import { callApi, parseSetCookies, type ApiCall } from "./auth-api-client.js";
import { registerViaApi, type RegisteredPerson } from "./auth-api-scenarios.js";

export interface PlatformSessionCookies {
  readonly access: string;
  readonly refresh: string;
}

export function readPlatformCookies(response: Response): PlatformSessionCookies {
  const cookies = parseSetCookies(response);
  const access = cookies.find((cookie) => cookie.name === PLATFORM_ACCESS_TOKEN_COOKIE_NAME);
  const refresh = cookies.find((cookie) => cookie.name === PLATFORM_REFRESH_TOKEN_COOKIE_NAME);
  if (access === undefined || refresh === undefined) throw new Error("platform cookies missing");
  return { access: access.value, refresh: refresh.value };
}

export function asPlatformCookies(session: PlatformSessionCookies): Record<string, string> {
  return {
    [PLATFORM_ACCESS_TOKEN_COOKIE_NAME]: session.access,
    [PLATFORM_REFRESH_TOKEN_COOKIE_NAME]: session.refresh,
  };
}

interface PlatformActorParts {
  readonly app: Express;
  readonly person: RegisteredPerson;
  readonly platformOperatorId: string;
  readonly session: PlatformSessionCookies;
}

/** A platform operator who can call the real /platform API. */
export class PlatformActor {
  readonly person: RegisteredPerson;
  readonly platformOperatorId: string;
  private readonly app: Express;
  private session: PlatformSessionCookies;

  constructor(parts: PlatformActorParts) {
    this.app = parts.app;
    this.person = parts.person;
    this.platformOperatorId = parts.platformOperatorId;
    this.session = parts.session;
  }

  call(method: ApiCall["method"], path: string, body?: object): Promise<Response> {
    return callApi(this.app, {
      method,
      path: `/api/v1/platform${path}`,
      cookies: asPlatformCookies(this.session),
      ...(body === undefined ? {} : { body }),
    });
  }

  get userId(): string {
    return this.person.me.userId;
  }

  get cookies(): PlatformSessionCookies {
    return this.session;
  }

  replaceSession(session: PlatformSessionCookies): void {
    this.session = session;
  }
}

export async function platformLogin(
  app: Express,
  person: Pick<RegisteredPerson, "email" | "password">,
  ip?: string,
): Promise<Response> {
  return callApi(app, {
    method: "post",
    path: "/api/v1/platform/auth/login",
    body: { identifier: person.email, password: person.password },
    ...(ip === undefined ? {} : { ip }),
  });
}

/** Registers a user through the real endpoint and stores a PlatformOperator record for it. */
export async function insertOperator(
  app: Express,
  connections: DatabaseConnections,
  platformRoles: readonly PlatformRole[],
): Promise<{ person: RegisteredPerson; platformOperatorId: string }> {
  const person = await registerViaApi(app);
  const platformOperatorId = newId();
  const now = new Date();
  await connections.platform.collection("platform_operators").insertOne({
    platformOperatorId,
    userId: person.me.userId,
    platformRoles: [...platformRoles],
    status: USER_STATUS.ACTIVE,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUserId: null,
    updatedByUserId: null,
  });
  return { person, platformOperatorId };
}

/** A registered user who is an ACTIVE operator with the given roles, signed in on the platform. */
export async function createPlatformActor(
  app: Express,
  connections: DatabaseConnections,
  platformRoles: readonly PlatformRole[],
): Promise<PlatformActor> {
  const { person, platformOperatorId } = await insertOperator(app, connections, platformRoles);
  const response = await platformLogin(app, person);
  if (response.status !== 200) throw new Error(`platform login failed: ${response.status}`);
  return new PlatformActor({
    app,
    person,
    platformOperatorId,
    session: readPlatformCookies(response),
  });
}
