export const COMMON_STATUS_ENUM = ["ACTIVE", "INACTIVE"] as const;
export type CommonStatusType = (typeof COMMON_STATUS_ENUM)[number];

export const COMMON_STATUS = COMMON_STATUS_ENUM.reduce(
  (acc: any, current) => {
    acc[current as CommonStatusType] = current;
    return acc;
  },
  {} as { [K in CommonStatusType]: K },
);
