export const USER_PROFILE_TYPE_ENUM = [
  "STUDENT",
  "MEMBER",
  "PATIENT",
  "CUSTOMER",
  "EMPLOYEE",
  "GUEST",
] as const;

export type UserProfileType = (typeof USER_PROFILE_TYPE_ENUM)[number];

export const USER_PROFILE_TYPE = USER_PROFILE_TYPE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in UserProfileType]: K },
);
