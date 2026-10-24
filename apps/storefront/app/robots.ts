import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { organizationIdFrom } from "../src/host/organization-header";

const HTTPS = "https";

/** Every host gets its own robots file. Sign-in and the API are never crawled. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const organizationId = organizationIdFrom(requestHeaders);
  if (organizationId === undefined) return { rules: { userAgent: "*", disallow: "/" } };
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? HTTPS}://${requestHeaders.get("host") ?? ""}`;
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/sign-in"] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
