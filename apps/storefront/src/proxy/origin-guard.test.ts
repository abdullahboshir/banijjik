import { describe, expect, it } from "vitest";
import { isForeignOriginWrite } from "./origin-guard";

const OWN_HOST = "shop.sites.example.com";

describe("origin guard", () => {
  it("refuses a write whose Origin is another host", () => {
    expect(
      isForeignOriginWrite({
        method: "POST",
        origin: "https://evil.example.org",
        host: OWN_HOST,
      }),
    ).toBe(true);
    expect(isForeignOriginWrite({ method: "PUT", origin: "null", host: OWN_HOST })).toBe(true);
  });

  it("allows a write from the storefront's own host, and any read", () => {
    expect(
      isForeignOriginWrite({ method: "POST", origin: `https://${OWN_HOST}`, host: OWN_HOST }),
    ).toBe(false);
    expect(
      isForeignOriginWrite({ method: "GET", origin: "https://evil.example.org", host: OWN_HOST }),
    ).toBe(false);
    expect(isForeignOriginWrite({ method: "POST", origin: null, host: OWN_HOST })).toBe(false);
  });
});
