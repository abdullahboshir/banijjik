import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { CUSTOMER_OTP_RULES } from "@banijjik/contracts/contact";

const CIPHER = "aes-256-gcm";
const IV_BYTES = 12;
const REFRESH_TOKEN_BYTES = 32;
const SEPARATOR = ".";

/** A random code of the configured length, with leading zeros kept. */
export function generateOtpCode(): string {
  const upperBound = 10 ** CUSTOMER_OTP_RULES.codeLength;
  return String(randomInt(0, upperBound)).padStart(CUSTOMER_OTP_RULES.codeLength, "0");
}

/** The stored form of a code: bound to the phone, so a hash cannot be replayed for another number. */
export function hashOtpCode(secret: string, phoneE164: string, code: string): string {
  return createHmac("sha256", secret).update(`${phoneE164}:${code}`).digest("hex");
}

/** Constant-time comparison of two hex hashes of equal length. */
export function sameHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function sealingKey(secret: string): Buffer {
  return createHash("sha256").update(`otp-seal:${secret}`).digest();
}

/** Seals the code for the SMS handler (AES-256-GCM). The sealed copy is removed right after sending. */
export function sealOtpCode(secret: string, code: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, sealingKey(secret), iv);
  const body = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(SEPARATOR);
}

export function openOtpCode(secret: string, sealed: string): string {
  const [iv, tag, body] = sealed.split(SEPARATOR).map((part) => Buffer.from(part, "base64url"));
  if (iv === undefined || tag === undefined || body === undefined) {
    throw new Error("sealed code has an unexpected shape");
  }
  const decipher = createDecipheriv(CIPHER, sealingKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

/** 32 random bytes as base64url: the value of the refresh cookie. It exists only in the cookie. */
export function generateCustomerRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString("base64url");
}

/** The stored form of a refresh token. A fast hash is enough: the token itself is 256 random bits. */
export function hashCustomerRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
