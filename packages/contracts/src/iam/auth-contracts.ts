import type { PreferredLocale } from "./preferred-locale.js";

/** `POST /auth/register` (14-API.md section 4). At least one of email and phone is required. */
export interface UserRegisterRequest {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  preferredLocale?: PreferredLocale;
}

/** `POST /auth/login`. The identifier is an email or a phone number in any accepted format. */
export interface LoginRequest {
  identifier: string;
  password: string;
}

/** `PATCH /me`. `version` is the value of the last MeResponse (optimistic concurrency). */
export interface MeUpdateRequest {
  name?: string;
  preferredLocale?: PreferredLocale;
  version: number;
}

/** `GET /me` and the body of register, login and `PATCH /me`. Never contains a token or a hash. */
export interface MeResponse {
  userId: string;
  name: string;
  email?: string;
  phoneE164?: string;
  preferredLocale: PreferredLocale;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  version: number;
}
