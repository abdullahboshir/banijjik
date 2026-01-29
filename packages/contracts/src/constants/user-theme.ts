export const USER_THEME_ENUM = ["LIGHT", "DARK", "SYSTEM"] as const;
export type UserThemeType = (typeof USER_THEME_ENUM)[number];

export const USER_THEME = USER_THEME_ENUM.reduce(
  (acc: any, current) => {
    acc[current as UserThemeType] = current;
    return acc;
  },
  {} as { [K in UserThemeType]: K },
);
