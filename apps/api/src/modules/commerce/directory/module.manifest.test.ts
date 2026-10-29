import { SECTION_KEY } from "@banijjik/contracts/website";
import { describe, expect, it } from "vitest";
import { directoryManifest } from "./module.manifest.js";

describe("directory module manifest", () => {
  it("declares the two storefront sections the directory already serves, so a site can place them", () => {
    expect(directoryManifest.storefrontSections).toEqual([
      SECTION_KEY["directory-search"],
      SECTION_KEY["directory-list"],
    ]);
  });
});
