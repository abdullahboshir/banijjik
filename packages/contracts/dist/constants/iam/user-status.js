export const USER_STATUS_ENUM = [
    "ACTIVE",
    "INACTIVE",
    "PENDING",
    "SUSPENDED",
    "BLOCKED",
    "DELETED",
];
export const USER_STATUS = USER_STATUS_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=user-status.js.map