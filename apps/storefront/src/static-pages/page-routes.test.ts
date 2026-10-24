import { describe, expect, it } from "vitest";
import { pageKeyOfSlug, slugOfPageKey } from "./page-routes";

describe("static page routes", () => {
  it("maps a URL slug to its page key and refuses any other slug", () => {
    expect(pageKeyOfSlug("about")).toBe("ABOUT");
    expect(pageKeyOfSlug("refund")).toBe("REFUND");
    expect(pageKeyOfSlug("secret")).toBeUndefined();
    expect(slugOfPageKey("FAQ")).toBe("faq");
  });
});
