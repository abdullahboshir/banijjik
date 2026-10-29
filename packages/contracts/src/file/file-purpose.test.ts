import { describe, expect, it } from "vitest";
import { FILE_PURPOSE, FILE_VISIBILITY, FILE_VISIBILITY_BY_PURPOSE } from "./file-purpose.js";

describe("FILE_VISIBILITY_BY_PURPOSE", () => {
  it("makes website images public and never treats them as offering images", () => {
    expect(FILE_PURPOSE.WEBSITE_IMAGE).toBe("WEBSITE_IMAGE");
    expect(FILE_VISIBILITY_BY_PURPOSE[FILE_PURPOSE.WEBSITE_IMAGE]).toBe(FILE_VISIBILITY.PUBLIC);
    expect(FILE_VISIBILITY_BY_PURPOSE[FILE_PURPOSE.WEBSITE_IMAGE]).toBe(
      FILE_VISIBILITY_BY_PURPOSE[FILE_PURPOSE.LOGO],
    );
    expect(FILE_PURPOSE.WEBSITE_IMAGE).not.toBe(FILE_PURPOSE.OFFERING_IMAGE);
  });
});
