import { describe, expect, it } from "vitest";
import { SITE_DOMAIN_STATUS } from "./site-domain.js";

describe("site domain contract", () => {
  it("defines each supported provisioning and removal state once", () => {
    expect(Object.values(SITE_DOMAIN_STATUS)).toEqual([
      "PENDING",
      "VERIFYING",
      "ACTIVE",
      "SUSPENDED",
      "FAILED",
      "REMOVING",
      "REMOVED",
    ]);
  });
});
