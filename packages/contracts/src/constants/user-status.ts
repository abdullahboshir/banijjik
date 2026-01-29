export const USER_STATUS_ENUM = [
  "ACTIVE",
  "PENDING",
  "SUSPENDED",
  "DELETED",
] as const;

export type UserStatusType = (typeof USER_STATUS_ENUM)[number];

export const USER_STATUS = USER_STATUS_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in UserStatusType]: K },
);
