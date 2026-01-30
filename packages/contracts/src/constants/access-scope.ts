export const ACCESS_SCOPE_ENUM = ["PLATFORM", "ORGANIZATION", "SELF"] as const;

export type AccessScopeType = (typeof ACCESS_SCOPE_ENUM)[number];

export const ACCESS_SCOPE = ACCESS_SCOPE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in AccessScopeType]: K },
);
