export const ORGANIZATION_INDUSTRY_ENUM = [
    "GYM",
    "COACHING",
    "SALON",
    "RETAIL",
    "RESTAURANT",
    "CLINIC",
    "HOSTEL",
    "PARLOR",
    "IT",
    "OTHER",
];
export const ORGANIZATION_INDUSTRY = ORGANIZATION_INDUSTRY_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
export const ORGANIZATION_LEGAL_TYPE_ENUM = [
    "PROPRIETORSHIP",
    "PARTNERSHIP",
    "PRIVATE_LIMITED",
    "PUBLIC_LIMITED",
    "NON_PROFIT",
    "TRUST",
];
export const ORGANIZATION_LEGAL_TYPE = ORGANIZATION_LEGAL_TYPE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
export const ORGANIZATION_NATURE_ENUM = [
    "SERVICE",
    "PRODUCT",
    "HYBRID",
];
export const ORGANIZATION_NATURE = ORGANIZATION_NATURE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
export const ORGANIZATION_STATUS_ENUM = [
    "PENDING",
    "ACTIVE",
    "SUSPENDED",
    "ARCHIVED",
    "INACTIVE",
];
export const ORGANIZATION_STATUS = ORGANIZATION_STATUS_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
export const DEPLOYMENT_TYPE_ENUM = ["SHARED", "DEDICATED", "SAAS"];
export const DEPLOYMENT_TYPE = DEPLOYMENT_TYPE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
export const ORGANIZATION_CURRENCY_ENUM = ["BDT", "USD"];
export const ORGANIZATION_CURRENCY = ORGANIZATION_CURRENCY_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
export const ORGANIZATION_LANGUAGE_ENUM = ["EN", "BN"];
export const ORGANIZATION_LANGUAGE = ORGANIZATION_LANGUAGE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
export const ORGANIZATION_STORAGE_PROVIDER_ENUM = [
    "CLOUDINARY",
    "S3",
    "LOCAL",
];
export const ORGANIZATION_STORAGE_PROVIDER = ORGANIZATION_STORAGE_PROVIDER_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=organization.js.map