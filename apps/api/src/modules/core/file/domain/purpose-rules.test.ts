import { FILE_PURPOSE } from "@banijjik/contracts/file";
import { describe, expect, it } from "vitest";
import { FILE_TYPE_GROUP } from "./file-types.js";
import { purposeAcceptsGroup, purposeRequiresWebsiteEdit } from "./purpose-rules.js";

describe("purposeRequiresWebsiteEdit", () => {
  it("requires website-edit authority only for website images", () => {
    expect(purposeRequiresWebsiteEdit(FILE_PURPOSE.WEBSITE_IMAGE)).toBe(true);
    expect(purposeRequiresWebsiteEdit(FILE_PURPOSE.LOGO)).toBe(false);
    expect(purposeRequiresWebsiteEdit(FILE_PURPOSE.OFFERING_IMAGE)).toBe(false);
    expect(purposeRequiresWebsiteEdit(FILE_PURPOSE.LISTING_PHOTO)).toBe(false);
  });
});

describe("purposeAcceptsGroup", () => {
  it("refuses a PDF for a website image and accepts an image", () => {
    expect(purposeAcceptsGroup(FILE_PURPOSE.WEBSITE_IMAGE, FILE_TYPE_GROUP.DOCUMENT)).toBe(false);
    expect(purposeAcceptsGroup(FILE_PURPOSE.WEBSITE_IMAGE, FILE_TYPE_GROUP.IMAGE)).toBe(true);
  });
});
