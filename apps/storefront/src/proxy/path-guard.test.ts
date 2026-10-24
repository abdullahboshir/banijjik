import { describe, expect, it } from "vitest";
import { isAllowedPublicFilePath, isAllowedStorefrontPath } from "./path-guard";

const ORGANIZATION_ID = "0195f3a0-0000-7000-8000-000000000001";
const OTHER_ORGANIZATION_ID = "0195f3a0-0000-7000-8000-000000000002";

describe("path guard", () => {
  it("refuses a proxied path that names another organization", () => {
    expect(
      isAllowedStorefrontPath(["orgs", OTHER_ORGANIZATION_ID, "listings"], ORGANIZATION_ID),
    ).toBe(false);
    expect(isAllowedStorefrontPath(["orgs", ORGANIZATION_ID, "listings"], ORGANIZATION_ID)).toBe(
      true,
    );
  });

  it("refuses dot segments and paths outside the storefront API", () => {
    expect(isAllowedStorefrontPath(["orgs", ORGANIZATION_ID, "..", "admin"], ORGANIZATION_ID)).toBe(
      false,
    );
    expect(isAllowedStorefrontPath(["admin", "members"], ORGANIZATION_ID)).toBe(false);
    expect(isAllowedStorefrontPath([], ORGANIZATION_ID)).toBe(false);
  });

  it("allows only the host lookup as the bare resolve path", () => {
    expect(isAllowedStorefrontPath(["resolve"], ORGANIZATION_ID)).toBe(true);
    expect(isAllowedStorefrontPath(["resolve", "extra"], ORGANIZATION_ID)).toBe(false);
  });

  it("allows public file paths without dot segments", () => {
    expect(isAllowedPublicFilePath(["0195f3a0-file.png"])).toBe(true);
    expect(isAllowedPublicFilePath(["..", "secret"])).toBe(false);
  });
});
