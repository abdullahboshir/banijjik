/**
 * Server-side environment of the storefront, read when a request needs it (not at import time), so a
 * build without the API address still succeeds. Nothing here is sent to the browser.
 */
const TRAILING_SLASHES = /\/+$/;

/** Origin of the API the storefront calls server to server, e.g. `http://localhost:4000`. */
export function storefrontApiOrigin(): string {
  const raw = process.env["STOREFRONT_API_ORIGIN"];
  if (raw === undefined || raw.trim() === "") {
    throw new Error("STOREFRONT_API_ORIGIN is not set: point it at the API origin");
  }
  const origin = raw.trim().replace(TRAILING_SLASHES, "");
  const parsed = new URL(origin);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("STOREFRONT_API_ORIGIN must be an http or https origin");
  }
  return origin;
}

/** The product name shown in the UI. Catalogs never contain the brand (ADR-038). */
export function brandName(): string {
  return process.env["NEXT_PUBLIC_BRAND_NAME"] ?? "Example Brand";
}
