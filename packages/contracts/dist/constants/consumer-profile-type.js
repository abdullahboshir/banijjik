export const USER_PROFILE_TYPE_ENUM = [
    "STUDENT",
    "MEMBER",
    "PATIENT",
    "CUSTOMER",
    "GUARDIAN",
    "GUEST",
];
export const USER_PROFILE_TYPE = USER_PROFILE_TYPE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=consumer-profile-type.js.map