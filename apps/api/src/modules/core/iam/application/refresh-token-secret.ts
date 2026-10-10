import { createHash, randomBytes } from "node:crypto";

const REFRESH_TOKEN_BYTES = 32;

/** 32 random bytes as base64url: the value of the refresh cookie. It exists only in the cookie. */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

/** The stored form of a refresh token. A fast hash is enough: the token itself is 256 random bits. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A client address is kept only as a salted hash (09 section 4.1 `ipHash`), enough to compare, not to read. */
export function hashClientAddress(ipAddress: string, secret: string): string {
  return createHash("sha256").update(`${ipAddress}:${secret}`).digest("hex");
}
