/**
 * The API address for code that ships to the browser. It is read on its own, without Zod, because the
 * validated `env` module would pull the whole schema library into the first page load (13-UX section 11).
 * `env.ts` validates the same variable on every server render, so a wrong value still fails loudly there.
 * Next.js inlines NEXT_PUBLIC_* values only when each one is read by its full name.
 */
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
