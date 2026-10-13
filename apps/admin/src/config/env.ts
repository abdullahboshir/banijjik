import { parseEnvironment } from "@banijjik/web-client";

// Next.js inlines NEXT_PUBLIC_* values only when each one is read by its full name.
export const env = parseEnvironment({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
});
