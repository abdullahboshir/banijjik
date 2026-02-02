export const OWNERSHIP_STATUS_ENUM = [
  "ACTIVE",
  "TRANSFERRED",
  "SUSPENDED",
] as const;
export type OwnershipStatusType = (typeof OWNERSHIP_STATUS_ENUM)[number];

export const OWNERSHIP_STATUS = OWNERSHIP_STATUS_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in OwnershipStatusType]: K },
);
