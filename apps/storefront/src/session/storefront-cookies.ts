import {
  STOREFRONT_ACCESS_COOKIE_NAME,
  STOREFRONT_REFRESH_COOKIE_NAME,
} from "@banijjik/contracts/contact";

export { STOREFRONT_ACCESS_COOKIE_NAME, STOREFRONT_REFRESH_COOKIE_NAME };

const COOKIE_SEPARATOR = ";";
const NAME_VALUE_SEPARATOR = "=";

/** The value of one cookie in a `Cookie` request header, or undefined. */
export function readCookie(
  cookieHeader: string | null | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(COOKIE_SEPARATOR)) {
    const [pairName, ...valueParts] = pair.trim().split(NAME_VALUE_SEPARATOR);
    if (pairName === name) return valueParts.join(NAME_VALUE_SEPARATOR);
  }
  return undefined;
}

/** A `Cookie` header with the named cookie replaced (or added) by `value`; the other cookies stay. */
export function withCookie(cookieHeader: string | null, name: string, value: string): string {
  const kept = (cookieHeader ?? "")
    .split(COOKIE_SEPARATOR)
    .map((pair) => pair.trim())
    .filter((pair) => pair !== "" && pair.split(NAME_VALUE_SEPARATOR)[0] !== name);
  return [...kept, `${name}${NAME_VALUE_SEPARATOR}${value}`].join(COOKIE_SEPARATOR + " ");
}

/** The value of a cookie from one `Set-Cookie` line (the part before the first attribute). */
export function valueFromSetCookie(setCookieLine: string, name: string): string | undefined {
  const [pair = ""] = setCookieLine.split(COOKIE_SEPARATOR);
  const separatorIndex = pair.indexOf(NAME_VALUE_SEPARATOR);
  if (separatorIndex < 0 || pair.slice(0, separatorIndex).trim() !== name) return undefined;
  return pair.slice(separatorIndex + 1);
}
