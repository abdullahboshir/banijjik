export const PERMISSION_EFFECT_ENUM = ["ALLOW", "DENY"] as const;
export type PermissionEffectType = (typeof PERMISSION_EFFECT_ENUM)[number];

export const PERMISSION_EFFECT = PERMISSION_EFFECT_ENUM.reduce(
  (acc: any, current) => {
    acc[current as PermissionEffectType] = current;
    return acc;
  },
  {} as { [K in PermissionEffectType]: K },
);
