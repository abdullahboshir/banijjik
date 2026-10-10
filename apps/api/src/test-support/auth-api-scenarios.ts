import type { MeResponse } from "@banijjik/contracts";
import type { Express } from "express";
import { callApi, readSessionCookies, type SessionCookies } from "./auth-api-client.js";

export const API_PASSWORD = "correct horse battery staple";

let issuedEmails = 0;

export function uniqueEmail(): string {
  issuedEmails += 1;
  return `person${issuedEmails}@example.com`;
}

export interface RegisteredPerson {
  readonly email: string;
  readonly password: string;
  readonly session: SessionCookies;
  readonly me: MeResponse;
}

/** Registers a new person through the real endpoint and returns what the cookies and the body said. */
export async function registerViaApi(app: Express): Promise<RegisteredPerson> {
  const email = uniqueEmail();
  const response = await callApi(app, {
    method: "post",
    path: "/api/v1/auth/register",
    body: {
      name: "Rahim Uddin",
      email,
      password: API_PASSWORD,
    },
  });
  if (response.status !== 201) throw new Error(`register failed: ${response.status}`);
  return {
    email,
    password: API_PASSWORD,
    session: readSessionCookies(response),
    me: response.body.data as MeResponse,
  };
}

/** Logs in again, which starts a second, independent session family for the same person. */
export async function loginViaApi(app: Express, person: RegisteredPerson): Promise<SessionCookies> {
  const response = await callApi(app, {
    method: "post",
    path: "/api/v1/auth/login",
    body: {
      identifier: person.email,
      password: person.password,
    },
  });
  if (response.status !== 200) throw new Error(`login failed: ${response.status}`);
  return readSessionCookies(response);
}
