export const CREDIT_RULE_KEY = {
  UNLOCK_COST: "credit.unlockCost",
  UNLOCKS_PER_DAY: "credit.unlocksPerDay",
  SHOW_UNLOCKERS_TO_OWNER: "credit.showUnlockersToOwner",
} as const;

export type CreditRuleKey = (typeof CREDIT_RULE_KEY)[keyof typeof CREDIT_RULE_KEY];

export const CREDIT_SEARCH_RULES = {
  [CREDIT_RULE_KEY.UNLOCK_COST]: {
    kind: "number" as const,
    defaultValue: 1,
    min: 1,
    max: 1000,
  },
  [CREDIT_RULE_KEY.UNLOCKS_PER_DAY]: {
    kind: "number" as const,
    defaultValue: 20,
    min: 1,
    max: 1000,
  },
  [CREDIT_RULE_KEY.SHOW_UNLOCKERS_TO_OWNER]: {
    kind: "boolean" as const,
    defaultValue: false,
  },
} as const;

/** Credit settings topic for the admin panel (SALES topic, plan item 8). */
export const CREDIT_SETTINGS_TOPIC = "SALES";
