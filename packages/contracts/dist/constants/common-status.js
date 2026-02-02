export const COMMON_STATUS_ENUM = ["ACTIVE", "INACTIVE"];
export const COMMON_STATUS = COMMON_STATUS_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=common-status.js.map