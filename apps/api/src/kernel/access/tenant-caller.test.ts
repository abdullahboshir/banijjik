import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { runWithRequestContext, type RequestContext } from "../context/index.js";
import { AppError } from "../http/index.js";
import { readTenantCaller } from "./tenant-caller.js";
import { readTenantIdentity } from "./tenant-identity.js";

const userId = newId();
const organizationId = newId();
const baseContext: RequestContext = { requestId: "request-1", userId, organizationId };

function readInside<Result>(context: RequestContext, work: () => Result): Result {
  return runWithRequestContext(context, work);
}

describe("readTenantIdentity", () => {
  it("reads the organization and the user of the request", () => {
    const identity = readInside(baseContext, readTenantIdentity);

    expect(identity).toEqual({ organizationId, actorUserId: userId });
  });

  it("refuses a request without an organization as a server error", () => {
    const withoutOrganization: RequestContext = { requestId: "request-1", userId };

    expect(() => readInside(withoutOrganization, readTenantIdentity)).toThrow(AppError);
  });

  it("refuses a request without a signed-in user", () => {
    const withoutUser: RequestContext = { requestId: "request-1", organizationId };

    expect(() => readInside(withoutUser, readTenantIdentity)).toThrow(AppError);
  });
});

describe("readTenantCaller", () => {
  it("adds the locations the permission guard allowed", () => {
    const caller = readInside({ ...baseContext, allowedLocationIds: ["L1"] }, readTenantCaller);

    expect(caller).toEqual({ organizationId, actorUserId: userId, allowedLocationIds: ["L1"] });
  });

  it("keeps ALL as ALL", () => {
    const caller = readInside({ ...baseContext, allowedLocationIds: "ALL" }, readTenantCaller);

    expect(caller.allowedLocationIds).toBe("ALL");
  });

  it("refuses a request that did not pass the permission guard", () => {
    expect(() => readInside(baseContext, readTenantCaller)).toThrow(AppError);
  });
});
