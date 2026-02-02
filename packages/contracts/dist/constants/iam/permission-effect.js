// Permission Effect
export const PERMISSION_EFFECT_ENUM = ["ALLOW", "DENY"];
export const PERMISSION_EFFECT = PERMISSION_EFFECT_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=permission-effect.js.map