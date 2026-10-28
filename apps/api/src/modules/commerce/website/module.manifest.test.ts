import { PERMISSION_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { websiteManifest } from "./module.manifest.js";

describe("website module manifest", () => {
  it("declares site read, update and publish so the owner catalog includes every PERMISSION_KEY", () => {
    expect(websiteManifest.permissions.map((permission) => permission.permissionKey)).toEqual(
      expect.arrayContaining([
        PERMISSION_KEY.WEBSITE_PAGE_READ,
        PERMISSION_KEY.WEBSITE_PAGE_UPDATE,
        PERMISSION_KEY.WEBSITE_SITE_READ,
        PERMISSION_KEY.WEBSITE_SITE_UPDATE,
        PERMISSION_KEY.WEBSITE_SITE_PUBLISH,
      ]),
    );
  });
});
