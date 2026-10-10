/** Rate limits of the auth endpoints (14-API.md section 2, plan 1.1 decision 17). */
export interface AuthRateLimit {
  readonly bucket: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

const FIFTEEN_MINUTES_SECONDS = 15 * 60;
const ONE_HOUR_SECONDS = 60 * 60;

export const AUTH_RATE_LIMIT = {
  /** Counts every login attempt for one identifier; a successful login clears the counter. */
  LOGIN_PER_IDENTIFIER: {
    bucket: "auth.login.identifier",
    limit: 5,
    windowSeconds: FIFTEEN_MINUTES_SECONDS,
  },
  LOGIN_PER_IP: { bucket: "auth.login.ip", limit: 30, windowSeconds: FIFTEEN_MINUTES_SECONDS },
  REGISTER_PER_IP: { bucket: "auth.register.ip", limit: 10, windowSeconds: ONE_HOUR_SECONDS },
  REFRESH_PER_IP: { bucket: "auth.refresh.ip", limit: 60, windowSeconds: FIFTEEN_MINUTES_SECONDS },
} as const satisfies Record<string, AuthRateLimit>;

/**
 * A refresh token that was rotated this recently is treated as two browser tabs racing, not as a
 * stolen token: the request fails but the session family stays alive.
 */
export const REFRESH_REUSE_GRACE_SECONDS = 10;
