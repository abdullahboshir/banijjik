import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../../test-support/test-app.js";
import { getRequestContext, runWithRequestContext } from "../context/index.js";
import type { AllowedLocations } from "../tenancy/tenant-scope.js";
import { requireAllLocations } from "./require-all-locations.js";

function probeApp(allowedLocationIds: AllowedLocations) {
  return createTestApp((router) => {
    router.get(
      "/probe",
      (_request, _response, next) =>
        runWithRequestContext({ ...getRequestContext(), allowedLocationIds }, () => next()),
      requireAllLocations(),
      (_request, response) => {
        response.json({ data: { reached: true } });
      },
    );
  }).app;
}

describe("requireAllLocations", () => {
  it("lets a request that covers every location through", async () => {
    const response = await request(probeApp("ALL")).get("/api/v1/probe");

    expect(response.status).toBe(200);
  });

  it.each([[["L1"]], [[]]])(
    "answers 403 FORBIDDEN for a request narrowed to %j",
    async (locations) => {
      const response = await request(probeApp(locations)).get("/api/v1/probe");

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    },
  );
});
