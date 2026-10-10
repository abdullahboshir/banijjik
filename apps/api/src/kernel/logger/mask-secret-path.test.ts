import { describe, expect, it } from "vitest";
import { maskSecretPathSegments } from "./mask-secret-path.js";

const TOKEN = "A".repeat(43);

describe("maskSecretPathSegments", () => {
  it("hides the invitation token in the preview and accept paths", () => {
    expect(maskSecretPathSegments(`/api/v1/invitations/${TOKEN}`)).toBe(
      "/api/v1/invitations/:token",
    );
    expect(maskSecretPathSegments(`/api/v1/invitations/${TOKEN}/accept`)).toBe(
      "/api/v1/invitations/:token/accept",
    );
  });

  it("leaves a tenant invitation id, which is a UUID, readable", () => {
    const path =
      "/api/v1/orgs/018f0000-0000-7000-8000-000000000001/invitations/018f0000-0000-7000-8000-000000000002/revoke";

    expect(maskSecretPathSegments(path)).toBe(path);
  });

  it("leaves other paths unchanged", () => {
    expect(maskSecretPathSegments("/api/v1/me/orgs")).toBe("/api/v1/me/orgs");
  });
});
