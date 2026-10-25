import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { POS_PAIRING_RULES } from "@banijjik/contracts/pos";

const DEVICE_SECRET_BYTES = 32;

/** A random code of the configured length, with leading zeros kept. */
export function generatePairingCode(): string {
  const upperBound = 10 ** POS_PAIRING_RULES.codeLength;
  return String(randomInt(0, upperBound)).padStart(POS_PAIRING_RULES.codeLength, "0");
}

/**
 * The stored form of a code: an HMAC bound to the organization, so a leaked hash cannot be
 * brute-forced without the server secret and cannot be replayed in another organization (ADR-119).
 */
export function hashPairingCode(secret: string, organizationId: string, code: string): string {
  return createHmac("sha256", secret).update(`pos-pairing:${organizationId}:${code}`).digest("hex");
}

/** 32 random bytes as base64url: the value of the device cookie. It exists only in the cookie. */
export function generateDeviceSecret(): string {
  return randomBytes(DEVICE_SECRET_BYTES).toString("base64url");
}

/** The stored form of a device secret. A fast hash is enough: the secret is 256 random bits. */
export function hashDeviceSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
