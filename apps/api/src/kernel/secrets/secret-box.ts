import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../http/index.js";

const CIPHER = "aes-256-gcm";
const IV_BYTES = 12;
let encryptionKey: Buffer | undefined;

/** Called by the composition root with the validated config, before any credential is used. */
export function initializeSecretBox(base64Key: string): void {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new AppError({ code: ERROR_CODE.INTERNAL });
  encryptionKey = key;
}

function key(): Buffer {
  if (encryptionKey === undefined) throw new AppError({ code: ERROR_CODE.INTERNAL });
  return encryptionKey;
}

export function sealSecret(plaintext: string, binding: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, key(), iv);
  cipher.setAAD(Buffer.from(binding));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function openSecret(sealed: string, binding: string): string {
  try {
    const [version, ivText, tagText, ciphertextText, extra] = sealed.split(".");
    if (
      version !== "v1" ||
      !ivText ||
      !tagText ||
      ciphertextText === undefined ||
      extra !== undefined
    )
      throw new Error("shape");
    const iv = Buffer.from(ivText, "base64url");
    const tag = Buffer.from(tagText, "base64url");
    if (iv.length !== IV_BYTES || tag.length !== 16) throw new Error("shape");
    const decipher = createDecipheriv(CIPHER, key(), iv);
    decipher.setAAD(Buffer.from(binding));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppError({ code: ERROR_CODE.INTERNAL });
  }
}
