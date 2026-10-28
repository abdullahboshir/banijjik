import { isAllowedPublicHref, type LocalizedText } from "@banijjik/contracts/website";
import { isUuidV7 } from "@banijjik/ids";

export type SiteLocale = "bn" | "en";

/** The visitor's language, or the other language when that one is empty. */
export function copyText(text: LocalizedText, locale: SiteLocale): string {
  const own = text[locale];
  if (own.trim() !== "") return own;
  return locale === "bn" ? text.en : text.bn;
}

export function publicHref(path: string | undefined): string | undefined {
  if (path === undefined || !isAllowedPublicHref(path)) return undefined;
  return path;
}

export function publicImageSrc(fileId: string | undefined): string | undefined {
  if (fileId === undefined || !isUuidV7(fileId)) return undefined;
  return `/api/v1/public/files/${fileId}/medium`;
}

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function telHref(phone: string | undefined): string | undefined {
  if (phone === undefined || !E164.test(phone)) return undefined;
  return `tel:${phone}`;
}

export function mailtoHref(email: string | undefined): string | undefined {
  if (email === undefined || !EMAIL.test(email)) return undefined;
  return `mailto:${email}`;
}
