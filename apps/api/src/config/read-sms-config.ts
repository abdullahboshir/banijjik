import { z } from "zod";
import type { ConfigSection } from "./read-auth-config.js";
import { collectIssues, readField, type Environment } from "./read-field.js";

export interface SmsConfig {
  readonly encryptionKey: string;
  readonly adareachBaseUrl: string;
  readonly bulksmsbdBaseUrl: string;
}

const DEVELOPMENT_KEY = Buffer.alloc(32, 7).toString("base64");
const keySchema = z.string().refine((value) => {
  const bytes = Buffer.from(value, "base64");
  return bytes.length === 32 && bytes.toString("base64") === value;
});

function baseUrlSchema(isProduction: boolean) {
  return z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
      return (
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        (url.protocol === "https:" || (!isProduction && local && url.protocol === "http:"))
      );
    })
    .transform((value) => value.replace(/\/+$/, ""));
}

export function readSmsConfig(env: Environment, isProduction: boolean): ConfigSection<SmsConfig> {
  const requiresKey = isProduction && env["SMS_DRIVER"]?.trim() === "gateway";
  const key = readField(env, {
    key: "CREDENTIALS_ENCRYPTION_KEY",
    hint: "must be base64 encoding of exactly 32 bytes",
    schema: keySchema,
    ...(requiresKey ? {} : { defaultValue: DEVELOPMENT_KEY }),
  });
  const adareach = readField(env, {
    key: "SMS_ADAREACH_BASE_URL",
    hint: "must be an HTTPS base URL without credentials, query or fragment",
    schema: baseUrlSchema(isProduction),
    defaultValue: "https://api.mobireach.com.bd",
  });
  const bulksmsbd = readField(env, {
    key: "SMS_BULKSMSBD_BASE_URL",
    hint: "must be an HTTPS base URL without credentials, query or fragment",
    schema: baseUrlSchema(isProduction),
    defaultValue: "https://bulksmsbd.net/api",
  });
  const issues = collectIssues([key, adareach, bulksmsbd]);
  if (key.value === undefined || adareach.value === undefined || bulksmsbd.value === undefined)
    return { issues };
  return {
    issues,
    value: Object.freeze({
      encryptionKey: key.value,
      adareachBaseUrl: adareach.value,
      bulksmsbdBaseUrl: bulksmsbd.value,
    }),
  };
}
