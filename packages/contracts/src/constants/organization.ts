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
] as const;

export type OrganizationIndustryType =
  (typeof ORGANIZATION_INDUSTRY_ENUM)[number];

export const ORGANIZATION_INDUSTRY = ORGANIZATION_INDUSTRY_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in OrganizationIndustryType]: K },
);

export const ORGANIZATION_LEGAL_TYPE_ENUM = [
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "PRIVATE_LIMITED",
  "PUBLIC_LIMITED",
  "NON_PROFIT",
  "TRUST",
] as const;

export type OrganizationLegalType =
  (typeof ORGANIZATION_LEGAL_TYPE_ENUM)[number];

export const ORGANIZATION_LEGAL_TYPE = ORGANIZATION_LEGAL_TYPE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in OrganizationLegalType]: K },
);

export const ORGANIZATION_NATURE_ENUM = [
  "SERVICE",
  "PRODUCT",
  "HYBRID",
] as const;

export type OrganizationNatureType = (typeof ORGANIZATION_NATURE_ENUM)[number];

export const ORGANIZATION_NATURE = ORGANIZATION_NATURE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in OrganizationNatureType]: K },
);

export const ORGANIZATION_STATUS_ENUM = [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
  "INACTIVE",
] as const;

export type OrganizationStatusType = (typeof ORGANIZATION_STATUS_ENUM)[number];

export const ORGANIZATION_STATUS = ORGANIZATION_STATUS_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in OrganizationStatusType]: K },
);

export const DEPLOYMENT_TYPE_ENUM = ["SHARED", "DEDICATED", "SAAS"] as const;
export type DeploymentType = (typeof DEPLOYMENT_TYPE_ENUM)[number];

export const DEPLOYMENT_TYPE = DEPLOYMENT_TYPE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in DeploymentType]: K },
);

export const ORGANIZATION_CURRENCY_ENUM = ["BDT", "USD"] as const;
export type OrganizationCurrencyType =
  (typeof ORGANIZATION_CURRENCY_ENUM)[number];

export const ORGANIZATION_CURRENCY = ORGANIZATION_CURRENCY_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in OrganizationCurrencyType]: K },
);

export const ORGANIZATION_LANGUAGE_ENUM = ["EN", "BN"] as const;
export type OrganizationLanguageType =
  (typeof ORGANIZATION_LANGUAGE_ENUM)[number];

export const ORGANIZATION_LANGUAGE = ORGANIZATION_LANGUAGE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in OrganizationLanguageType]: K },
);

export const ORGANIZATION_STORAGE_PROVIDER_ENUM = [
  "CLOUDINARY",
  "S3",
  "LOCAL",
] as const;
export type OrganizationStorageProviderType =
  (typeof ORGANIZATION_STORAGE_PROVIDER_ENUM)[number];

export const ORGANIZATION_STORAGE_PROVIDER =
  ORGANIZATION_STORAGE_PROVIDER_ENUM.reduce(
    (acc: any, current) => {
      acc[current] = current;
      return acc;
    },
    {} as { [K in OrganizationStorageProviderType]: K },
  );
