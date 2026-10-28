import { describe, expect, it } from "vitest";
import { copyText, mailtoHref, publicHref, publicImageSrc, telHref } from "./copy-text.js";

describe("copyText", () => {
  it("prefers the visitor language and falls back to the other", () => {
    expect(copyText({ bn: "হ্যালো", en: "Hello" }, "bn")).toBe("হ্যালো");
    expect(copyText({ bn: "", en: "Hello" }, "bn")).toBe("Hello");
  });
});

describe("publicHref", () => {
  it("allows a local path and https, and refuses javascript", () => {
    expect(publicHref("/pages/about")).toBe("/pages/about");
    expect(publicHref("https://example.com/x")).toBe("https://example.com/x");
    expect(publicHref("javascript:alert(1)")).toBeUndefined();
    expect(publicHref("")).toBeUndefined();
  });
});

describe("publicImageSrc", () => {
  it("builds a public file URL only for a UUID v7", () => {
    const fileId = "01926b48-1234-7abc-8def-0123456789a5";
    expect(publicImageSrc(fileId)).toBe(`/api/v1/public/files/${fileId}/medium`);
    expect(publicImageSrc("not-a-uuid")).toBeUndefined();
  });
});

describe("contact hrefs", () => {
  it("allows E.164 and a simple email, and refuses javascript", () => {
    expect(telHref("+8801712345678")).toBe("tel:+8801712345678");
    expect(telHref("javascript:alert(1)")).toBeUndefined();
    expect(mailtoHref("help@example.com")).toBe("mailto:help@example.com");
    expect(mailtoHref("a@b")).toBeUndefined();
  });
});
