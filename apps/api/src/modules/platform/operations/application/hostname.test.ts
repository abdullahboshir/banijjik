import { describe, expect, it } from "vitest";
import { isReservedHostname, normalizeHostname } from "./hostname.js";

const RESERVATIONS = {
  baseDomain: "sites.example.com",
  reservedHostnames: ["api.sites.example.com", "admin.sites.example.com"],
};

describe("normalizeHostname", () => {
  it("lower-cases the host, drops one terminal dot and keeps the ASCII form", () => {
    expect(normalizeHostname("  Shop.Example.COM. ")).toBe("shop.example.com");
  });

  it("maps an international name to its punycode form", () => {
    expect(normalizeHostname("bücher.example.com")).toBe("xn--bcher-kva.example.com");
  });

  it("refuses a URL, a port, userinfo, a path and a query", () => {
    expect(normalizeHostname("https://shop.example.com")).toBeUndefined();
    expect(normalizeHostname("shop.example.com:443")).toBeUndefined();
    expect(normalizeHostname("user@shop.example.com")).toBeUndefined();
    expect(normalizeHostname("shop.example.com/path")).toBeUndefined();
    expect(normalizeHostname("shop.example.com?x=1")).toBeUndefined();
  });

  it("refuses two hosts in one value and a wildcard", () => {
    expect(normalizeHostname("shop.example.com,evil.example.com")).toBeUndefined();
    expect(normalizeHostname("*.example.com")).toBeUndefined();
  });

  it("refuses an IP literal, a bare label and an empty label", () => {
    expect(normalizeHostname("192.168.0.10")).toBeUndefined();
    expect(normalizeHostname("localhost")).toBeUndefined();
    expect(normalizeHostname("shop..example.com")).toBeUndefined();
    expect(normalizeHostname("shop.example.com..")).toBeUndefined();
  });

  it("refuses an empty value, whitespace inside the name and an over-long name", () => {
    expect(normalizeHostname("   ")).toBeUndefined();
    expect(normalizeHostname("shop example.com")).toBeUndefined();
    expect(normalizeHostname(`${"a".repeat(64)}.example.com`)).toBeUndefined();
  });
});

describe("isReservedHostname", () => {
  it("reserves the SaaS apex and the platform hosts", () => {
    expect(isReservedHostname("sites.example.com", RESERVATIONS)).toBe(true);
    expect(isReservedHostname("api.sites.example.com", RESERVATIONS)).toBe(true);
    expect(isReservedHostname("admin.sites.example.com", RESERVATIONS)).toBe(true);
  });

  it("keeps a business host claimable", () => {
    expect(isReservedHostname("shop.sites.example.com", RESERVATIONS)).toBe(false);
    expect(isReservedHostname("www.a-business.com", RESERVATIONS)).toBe(false);
  });
});
