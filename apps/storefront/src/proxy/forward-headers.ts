/**
 * Headers the proxy copies from the browser to the API. Everything else is dropped: most of all `Origin`
 * and `Host`, which the API would compare with its own allow-list (the proxy is a server-to-server call
 * from the API's view, ADR-119). `x-forwarded-for` is copied as Next.js received it, never extended by the
 * proxy: the API counts the storefront as one trusted hop (TRUSTED_PROXY_HOPS, M.6 amendment 1).
 */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "cookie",
  "idempotency-key",
  "x-forwarded-for",
  "user-agent",
] as const;

/** Headers the API answers with that the browser needs; `set-cookie` is handled apart (every value). */
const RETURNED_RESPONSE_HEADERS = [
  "cache-control",
  "content-disposition",
  "content-language",
  "content-type",
  "etag",
  "last-modified",
] as const;

export function headersForUpstream(incoming: Headers): Headers {
  const outgoing = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) outgoing.set(name, value);
  }
  return outgoing;
}

/** Copies the allowed headers, then every `Set-Cookie` the API sent, one header line each. */
export function headersForBrowser(upstream: Response): Headers {
  const outgoing = new Headers();
  for (const name of RETURNED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) outgoing.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) {
    outgoing.append("set-cookie", cookie);
  }
  return outgoing;
}
