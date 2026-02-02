export const USER_THEME_ENUM = ["LIGHT", "DARK", "SYSTEM"];
export const USER_THEME = USER_THEME_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=user-theme.js.map