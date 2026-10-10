import { z } from "zod";
import { emailSchema } from "./email.js";
import { phoneE164Schema } from "./phone.js";

export type LoginIdentifier =
  | { readonly kind: "EMAIL"; readonly value: string }
  | { readonly kind: "PHONE"; readonly value: string };

const IDENTIFIER_MAX_LENGTH = 254;

function classify(input: string, context: z.core.$RefinementCtx<string>): LoginIdentifier {
  const isEmail = input.includes("@");
  const parsed = isEmail ? emailSchema.safeParse(input) : phoneE164Schema.safeParse(input);
  if (parsed.success) return { kind: isEmail ? "EMAIL" : "PHONE", value: parsed.data };
  // One issue on the identifier field itself; the inner issue paths would not match the request body.
  context.issues.push({ code: "invalid_format", format: isEmail ? "email" : "phone", input });
  return z.NEVER;
}

/** A login identifier: an `@` means email, anything else is read as a phone number. */
export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH)
  .transform(classify);
