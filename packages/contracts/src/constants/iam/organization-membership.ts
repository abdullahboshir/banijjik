export const MEMBERSHIP_TYPE_ENUM = ["STAFF", "CONSUMER"] as const;
export type MembershipType = (typeof MEMBERSHIP_TYPE_ENUM)[number];

export const MEMBERSHIP_TYPE = MEMBERSHIP_TYPE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in MembershipType]: K },
);

export const MEMBERSHIP_SOURCE_ENUM = [
  "WEB_PORTAL",
  "MOBILE_APP",
  "MANUAL_ADD",
  "BULK_IMPORT",
  "REFERRAL",
] as const;
export type MembershipSourceType = (typeof MEMBERSHIP_SOURCE_ENUM)[number];

export const MEMBERSHIP_SOURCE = MEMBERSHIP_SOURCE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in MembershipSourceType]: K },
);
