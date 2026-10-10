import { z } from "zod";
import { loginIdentifierSchema } from "../login-identifier.js";
import { PASSWORD_INPUT_MAX_LENGTH } from "./password-input.js";

/** Body of `POST /auth/login`. The password policy is not applied: it may have changed since the password was set. */
export const loginRequestSchema = z.strictObject({
  identifier: loginIdentifierSchema,
  password: z.string().min(1).max(PASSWORD_INPUT_MAX_LENGTH),
});

export type LoginBody = z.output<typeof loginRequestSchema>;
