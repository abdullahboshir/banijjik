/** The counted limits of a package (10-MODULE-CATALOG section 9). `null` in a package means unlimited. */
export const LIMIT_KEY = {
  LOCATIONS: "locations",
  MEMBERS: "members",
  OFFERINGS: "offerings",
  ORDERS_PER_MONTH: "ordersPerMonth",
  AI_MESSAGES_PER_MONTH: "aiMessagesPerMonth",
  SMS_PER_MONTH: "smsPerMonth",
  CHANNELS: "channels",
  POS_DEVICES: "posDevices",
} as const;

export type LimitKey = (typeof LIMIT_KEY)[keyof typeof LIMIT_KEY];

export const LIMIT_KEY_VALUES: readonly LimitKey[] = Object.values(LIMIT_KEY);

/** A limit value: a count, or `null` for unlimited. */
export type LimitValue = number | null;

export type LimitMap = Readonly<Record<LimitKey, LimitValue>>;
