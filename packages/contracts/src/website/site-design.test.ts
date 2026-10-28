import { describe, expect, it } from "vitest";
import { containsUnsafeContent, isAllowedPublicHref, isReservedPublicPath } from "./site-design.js";

describe("public href and content safety", () => {
  it("allows relative local paths and https links", () => {
    expect(isAllowedPublicHref("/home")).toBe(true);
    expect(isAllowedPublicHref("/about-us")).toBe(true);
    expect(isAllowedPublicHref("https://example.com/menu")).toBe(true);
  });

  it("refuses javascript, data, protocol-relative and parent paths", () => {
    expect(isAllowedPublicHref("javascript:alert(1)")).toBe(false);
    expect(isAllowedPublicHref("data:text/html,x")).toBe(false);
    expect(isAllowedPublicHref("//evil.example/x")).toBe(false);
    expect(isAllowedPublicHref("/ok/../secret")).toBe(false);
    expect(isAllowedPublicHref("mailto:a@b.c")).toBe(false);
    expect(isAllowedPublicHref("tel:+8801712345678")).toBe(false);
  });

  it("reserves application, account and Track M routes", () => {
    expect(isReservedPublicPath("/")).toBe(false);
    expect(isReservedPublicPath("/home")).toBe(false);
    expect(isReservedPublicPath("/pages")).toBe(true);
    expect(isReservedPublicPath("/pages/about")).toBe(true);
    expect(isReservedPublicPath("/listings/1")).toBe(true);
    expect(isReservedPublicPath("/checkout")).toBe(true);
    expect(isReservedPublicPath("/api/v1")).toBe(true);
  });

  it("refuses raw HTML and CSS url() in tenant text", () => {
    expect(containsUnsafeContent("Hello")).toBe(false);
    expect(containsUnsafeContent("<script>x</script>")).toBe(true);
    expect(containsUnsafeContent("background: url(https://x)")).toBe(true);
    expect(containsUnsafeContent("javascript:alert(1)")).toBe(true);
  });
});
