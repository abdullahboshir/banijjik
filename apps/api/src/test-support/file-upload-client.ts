import type { Express } from "express";
import type { Response as AgentResponse } from "superagent";
import request, { type Response } from "supertest";
import { asCookies, freshIp } from "./auth-api-client.js";
import type { ApiActor } from "./two-organizations.js";

export interface UploadSpec {
  readonly organizationId: string;
  readonly bytes: Buffer;
  readonly filename: string;
  /** Omit to send no purpose field. */
  readonly purpose?: string;
  /** A second file part, to prove that more than one file is refused. */
  readonly secondFile?: { readonly bytes: Buffer; readonly filename: string };
}

/** Sends a multipart upload as a signed-in person. `ApiActor.call` only sends JSON. */
export function uploadFile(app: Express, actor: ApiActor, spec: UploadSpec): Promise<Response> {
  const cookieHeader = Object.entries(asCookies(actor.person.session))
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  let pending = request(app)
    .post(`/api/v1/orgs/${spec.organizationId}/files`)
    .set("X-Forwarded-For", freshIp())
    .set("Cookie", cookieHeader);
  if (spec.purpose !== undefined) pending = pending.field("purpose", spec.purpose);
  pending = pending.attach("file", spec.bytes, spec.filename);
  if (spec.secondFile !== undefined) {
    pending = pending.attach("file", spec.secondFile.bytes, spec.secondFile.filename);
  }
  return pending;
}

/** A GET without any session, as a storefront visitor would send it. */
export function getWithoutSession(app: Express, path: string): Promise<Response> {
  return request(app).get(path).set("X-Forwarded-For", freshIp()).buffer(true).parse(collectBytes);
}

function collectBytes(
  response: AgentResponse,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer) => chunks.push(chunk));
  response.on("end", () => callback(null, Buffer.concat(chunks)));
}

/** A signed-in GET whose body is read as raw bytes (`response.body` is a Buffer). */
export function downloadFile(app: Express, actor: ApiActor, path: string): Promise<Response> {
  const cookieHeader = Object.entries(asCookies(actor.person.session))
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return request(app)
    .get(`/api/v1${path}`)
    .set("X-Forwarded-For", freshIp())
    .set("Cookie", cookieHeader)
    .buffer(true)
    .parse(collectBytes);
}
