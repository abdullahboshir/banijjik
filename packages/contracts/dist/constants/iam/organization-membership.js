export const MEMBERSHIP_TYPE_ENUM = ["STAFF", "CONSUMER"];
export const MEMBERSHIP_TYPE = MEMBERSHIP_TYPE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
export const MEMBERSHIP_SOURCE_ENUM = [
    "WEB_PORTAL",
    "MOBILE_APP",
    "MANUAL_ADD",
    "BULK_IMPORT",
    "REFERRAL",
];
export const MEMBERSHIP_SOURCE = MEMBERSHIP_SOURCE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=organization-membership.js.map