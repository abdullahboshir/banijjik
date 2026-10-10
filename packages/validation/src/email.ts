import { z } from "zod";

const EMAIL_MAX_LENGTH = 254;
// Deliberately light (RFC 5322 is not checkable with a regex): something@something.something, no spaces.
// Real verification is the email link (OTP card), not this pattern.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An email address, trimmed and lower-cased (05-CONVENTIONS "Phone and email"). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH)
  .regex(EMAIL_PATTERN);
