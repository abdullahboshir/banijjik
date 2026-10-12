const ONE_MINUTE_SECONDS = 60;

/** Generous on purpose: a person at a screen never reaches it (14-API.md section 2, review M8). */
export const PER_USER_LIMIT = {
  /** Every `/me/*` and `/orgs/*` request of a signed-in business user, keyed by `userId`. */
  ADMIN_USER: { bucket: "api.user", limit: 600, windowSeconds: ONE_MINUTE_SECONDS },
  /** Every `/platform/*` request of a platform operator, keyed by `platformOperatorId`. */
  PLATFORM_OPERATOR: {
    bucket: "platform.operator",
    limit: 600,
    windowSeconds: ONE_MINUTE_SECONDS,
  },
} as const;
