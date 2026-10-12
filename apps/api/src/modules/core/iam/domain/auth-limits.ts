/** Rate limits of the auth endpoints (14-API.md section 2, plan 1.1 decision 17). */
export interface AuthRateLimit {
  readonly bucket: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

const FIFTEEN_MINUTES_SECONDS = 15 * 60;
const ONE_HOUR_SECONDS = 60 * 60;

export const AUTH_RATE_LIMIT = {
  /** Failed logins of one identifier from one address; a successful login clears it (decision 1, review M6). */
  LOGIN_PER_IDENTIFIER_AND_IP: {
    bucket: "auth.login.identifier-ip",
    limit: 5,
    windowSeconds: FIFTEEN_MINUTES_SECONDS,
  },
  /**
   * Failed logins of one identifier from anywhere. Far above the per-address limit, so one stranger
   * cannot lock a person out, yet a guess spread over many addresses still stops.
   */
  LOGIN_PER_IDENTIFIER: {
    bucket: "auth.login.identifier",
    limit: 50,
    windowSeconds: FIFTEEN_MINUTES_SECONDS,
  },
  LOGIN_PER_IP: { bucket: "auth.login.ip", limit: 30, windowSeconds: FIFTEEN_MINUTES_SECONDS },
  REGISTER_PER_IP: { bucket: "auth.register.ip", limit: 10, windowSeconds: ONE_HOUR_SECONDS },
  REFRESH_PER_IP: { bucket: "auth.refresh.ip", limit: 60, windowSeconds: FIFTEEN_MINUTES_SECONDS },
  /** The platform panel counts in its own buckets, so a flood on one app never locks out the other (plan 1.8a). */
  PLATFORM_LOGIN_PER_IDENTIFIER_AND_IP: {
    bucket: "platform.login.identifier-ip",
    limit: 5,
    windowSeconds: FIFTEEN_MINUTES_SECONDS,
  },
  PLATFORM_LOGIN_PER_IDENTIFIER: {
    bucket: "platform.login.identifier",
    limit: 50,
    windowSeconds: FIFTEEN_MINUTES_SECONDS,
  },
  PLATFORM_LOGIN_PER_IP: {
    bucket: "platform.login.ip",
    limit: 30,
    windowSeconds: FIFTEEN_MINUTES_SECONDS,
  },
  PLATFORM_REFRESH_PER_IP: {
    bucket: "platform.refresh.ip",
    limit: 60,
    windowSeconds: FIFTEEN_MINUTES_SECONDS,
  },
} as const satisfies Record<string, AuthRateLimit>;

/** The two failed-login buckets of one sign-in surface. */
export interface LoginLimits {
  readonly perIdentifierAndIp: AuthRateLimit;
  readonly perIdentifier: AuthRateLimit;
}

export const ADMIN_LOGIN_LIMITS: LoginLimits = {
  perIdentifierAndIp: AUTH_RATE_LIMIT.LOGIN_PER_IDENTIFIER_AND_IP,
  perIdentifier: AUTH_RATE_LIMIT.LOGIN_PER_IDENTIFIER,
};

export const PLATFORM_LOGIN_LIMITS: LoginLimits = {
  perIdentifierAndIp: AUTH_RATE_LIMIT.PLATFORM_LOGIN_PER_IDENTIFIER_AND_IP,
  perIdentifier: AUTH_RATE_LIMIT.PLATFORM_LOGIN_PER_IDENTIFIER,
};

/**
 * A refresh token that was rotated this recently is treated as two browser tabs racing, not as a
 * stolen token: the request fails but the session family stays alive.
 */
export const REFRESH_REUSE_GRACE_SECONDS = 10;
