import type { MeResponse } from "@banijjik/contracts";
import type { User } from "../domain/user.entity.js";

/** The public shape of a user. The password hash and the status never leave the module. */
export function toMeResponse(user: User): MeResponse {
  return {
    userId: user.userId,
    name: user.name,
    ...(user.email === undefined ? {} : { email: user.email }),
    ...(user.phoneE164 === undefined ? {} : { phoneE164: user.phoneE164 }),
    preferredLocale: user.preferredLocale,
    isEmailVerified: user.emailVerifiedAt !== undefined,
    isPhoneVerified: user.phoneVerifiedAt !== undefined,
    version: user.version,
  };
}
