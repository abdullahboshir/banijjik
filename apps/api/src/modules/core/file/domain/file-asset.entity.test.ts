import { FILE_PURPOSE, FILE_VISIBILITY } from "@banijjik/contracts/file";
import { asId, newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { FileAsset, newFileId, sanitizeOriginalName } from "./file-asset.entity.js";
import { ORIGINAL_NAME_MAX_LENGTH } from "./file-limits.js";

function aFile(purpose: (typeof FILE_PURPOSE)[keyof typeof FILE_PURPOSE]): FileAsset {
  return FileAsset.create({
    fileId: newFileId(),
    organizationId: asId<OrganizationId>(newId()),
    actorUserId: asId<UserId>(newId()),
    purpose,
    mimeType: "image/webp",
    originalName: "logo.png",
    variants: [
      { variantKey: "thumb", byteSize: 10 },
      { variantKey: "medium", byteSize: 20 },
    ],
    now: new Date(),
  });
}

describe("FileAsset", () => {
  it("makes logos, offering images and website images public and everything else private, whatever is asked", () => {
    expect(aFile(FILE_PURPOSE.LOGO).visibility).toBe(FILE_VISIBILITY.PUBLIC);
    expect(aFile(FILE_PURPOSE.OFFERING_IMAGE).visibility).toBe(FILE_VISIBILITY.PUBLIC);
    expect(aFile(FILE_PURPOSE.WEBSITE_IMAGE).visibility).toBe(FILE_VISIBILITY.PUBLIC);
    expect(aFile(FILE_PURPOSE.CUSTOM_FIELD_IMAGE).visibility).toBe(FILE_VISIBILITY.PRIVATE);
    expect(aFile(FILE_PURPOSE.CUSTOM_FIELD_FILE).visibility).toBe(FILE_VISIBILITY.PRIVATE);
    expect(aFile(FILE_PURPOSE.ATTACHMENT).visibility).toBe(FILE_VISIBILITY.PRIVATE);
    expect(aFile(FILE_PURPOSE.LISTING_PHOTO).visibility).toBe(FILE_VISIBILITY.PRIVATE);
  });

  it("counts the stored size as the sum of its variants and keys objects under the organization", () => {
    const asset = aFile(FILE_PURPOSE.LOGO);
    expect(asset.byteSize).toBe(30);
    expect(asset.storageKey).toBe(`org/${asset.organizationId}/${asset.fileId}`);
  });
});

describe("sanitizeOriginalName", () => {
  it("drops path separators and control characters", () => {
    expect(sanitizeOriginalName("../../etc/passwd")).toBe("....etcpasswd");
    expect(sanitizeOriginalName("a\u0000b\nc.png")).toBe("abc.png");
  });

  it("keeps letters of any script, such as Bengali", () => {
    expect(sanitizeOriginalName("লোগো ১.png")).toBe("লোগো ১.png");
  });

  it("falls back to a fixed name when nothing is left, and shortens long names", () => {
    expect(sanitizeOriginalName("///")).toBe("file");
    expect(sanitizeOriginalName("x".repeat(500))).toHaveLength(ORIGINAL_NAME_MAX_LENGTH);
  });
});
