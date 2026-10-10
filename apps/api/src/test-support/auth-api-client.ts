import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from "@banijjik/contracts";
import type { Express } from "express";
import request, { type Response, type Test } from "supertest";

export interface CallOptions {
  /** Cookie name to value, sent as one Cookie header. */
  readonly cookies?: Readonly<Record<string, string>>;
  /** The client address, sent as X-Forwarded-For (the app trusts one proxy hop). */
  readonly ip?: string;
  readonly origin?: string;
}

export interface SetCookie {
  readonly name: string;
  readonly value: string;
  readonly attributes: readonly string[];
  readonly raw: string;
}

export interface SessionCookies {
  readonly access: string;
  readonly refresh: string;
}

const ADDRESSES_PER_BLOCK = 250;
let issuedAddresses = 0;

/** A fresh client address per call keeps the per-IP rate limits of one test from affecting another. */
export function freshIp(): string {
  issuedAddresses += 1;
  const block = Math.floor(issuedAddresses / ADDRESSES_PER_BLOCK);
  return `10.0.${block}.${(issuedAddresses % ADDRESSES_PER_BLOCK) + 1}`;
}

function startRequest(app: Express, method: "get" | "post" | "patch", path: string): Test {
  const agent = request(app);
  if (method === "get") return agent.get(path);
  if (method === "patch") return agent.patch(path);
  return agent.post(path);
}

export interface ApiCall extends CallOptions {
  readonly method: "get" | "post" | "patch";
  readonly path: string;
  readonly body?: object;
}

export function callApi(app: Express, call: ApiCall): Test {
  let pending = startRequest(app, call.method, call.path).set(
    "X-Forwarded-For",
    call.ip ?? freshIp(),
  );
  if (call.origin !== undefined) pending = pending.set("Origin", call.origin);
  if (call.cookies !== undefined) {
    const header = Object.entries(call.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    pending = pending.set("Cookie", header);
  }
  return call.body === undefined ? pending : pending.send(call.body);
}

export function parseSetCookies(response: Response): SetCookie[] {
  const headers = response.headers["set-cookie"] as unknown as string[] | undefined;
  return (headers ?? []).map((raw) => {
    const [pair = "", ...attributes] = raw.split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    return {
      name: pair.slice(0, separator),
      value: pair.slice(separator + 1),
      attributes,
      raw,
    };
  });
}

/** The two session cookie values a successful register, login or refresh set. */
export function readSessionCookies(response: Response): SessionCookies {
  const cookies = parseSetCookies(response);
  const access = cookies.find((cookie) => cookie.name === ACCESS_TOKEN_COOKIE_NAME);
  const refresh = cookies.find((cookie) => cookie.name === REFRESH_TOKEN_COOKIE_NAME);
  if (access === undefined || refresh === undefined) {
    throw new Error(`expected both session cookies, got ${cookies.map((c) => c.name).join(", ")}`);
  }
  return { access: access.value, refresh: refresh.value };
}

export function asCookies(session: SessionCookies): Record<string, string> {
  return {
    [ACCESS_TOKEN_COOKIE_NAME]: session.access,
    [REFRESH_TOKEN_COOKIE_NAME]: session.refresh,
  };
}
