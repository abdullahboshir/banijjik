import request from "supertest";
import { PERMISSION_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../test-support/test-app.js";
import { getRequestContext, runWithRequestContext } from "../context/index.js";
import type { AllowedLocations } from "../tenancy/tenant-scope.js";
import { createPermissionMiddleware } from "./permission.middleware.js";

const PROBE_PATH = "/api/v1/probe";

interface ProbeSetup {
  readonly callerLocations: AllowedLocations;
  readonly granted: readonly string[] | "ALL";
}

function probeApp(setup: ProbeSetup) {
  const permission = createPermissionMiddleware({ locationsWith: async () => setup.granted });
  return createTestApp((router) => {
    router.get(
      "/probe",
      (_request, _response, next) =>
        runWithRequestContext(
          { ...getRequestContext(), allowedLocationIds: setup.callerLocations },
          () => next(),
        ),
      permission(PERMISSION_KEY.IAM_ROLE_READ),
      (_request, response) => {
        response.json({ data: { allowedLocationIds: getRequestContext().allowedLocationIds } });
      },
    );
  }).app;
}

describe("createPermissionMiddleware", () => {
  it("answers 403 FORBIDDEN when the permission is granted nowhere", async () => {
    const response = await request(probeApp({ callerLocations: "ALL", granted: [] })).get(
      PROBE_PATH,
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("narrows the request to the locations where the permission is granted", async () => {
    const response = await request(probeApp({ callerLocations: "ALL", granted: ["L1"] })).get(
      PROBE_PATH,
    );

    expect(response.body.data.allowedLocationIds).toEqual(["L1"]);
  });

  it("intersects with the caller's locations and never widens them", async () => {
    const response = await request(
      probeApp({ callerLocations: ["L1"], granted: ["L1", "L2"] }),
    ).get(PROBE_PATH);

    expect(response.body.data.allowedLocationIds).toEqual(["L1"]);
  });

  it("answers 403 when the intersection is empty", async () => {
    const response = await request(probeApp({ callerLocations: ["L1"], granted: ["L2"] })).get(
      PROBE_PATH,
    );

    expect(response.status).toBe(403);
  });

  it("answers 403 for a ?location= outside the granted locations", async () => {
    const response = await request(probeApp({ callerLocations: "ALL", granted: ["L1"] })).get(
      `${PROBE_PATH}?location=L2`,
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("lets a ?location= inside the granted locations through", async () => {
    const response = await request(probeApp({ callerLocations: "ALL", granted: ["L1"] })).get(
      `${PROBE_PATH}?location=L1`,
    );

    expect(response.status).toBe(200);
  });

  it("keeps ALL when the permission is granted at every location", async () => {
    const response = await request(probeApp({ callerLocations: "ALL", granted: "ALL" })).get(
      PROBE_PATH,
    );

    expect(response.body.data.allowedLocationIds).toBe("ALL");
  });
});
