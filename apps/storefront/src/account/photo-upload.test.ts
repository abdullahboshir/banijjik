import { DIRECTORY_PHOTO_POLICY } from "@banijjik/contracts/directory";
import { describe, expect, it } from "vitest";
import { showsPhotoUpload } from "./photo-upload";

describe("the biodata photo field", () => {
  it("shows the photo upload only when the photo policy allows it", () => {
    expect(showsPhotoUpload(DIRECTORY_PHOTO_POLICY.NONE)).toBe(false);
    expect(showsPhotoUpload(undefined)).toBe(false);
    expect(showsPhotoUpload(DIRECTORY_PHOTO_POLICY.BLURRED_PUBLIC)).toBe(true);
    expect(showsPhotoUpload(DIRECTORY_PHOTO_POLICY.UNLOCKED_ONLY)).toBe(true);
  });
});
