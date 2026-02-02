import {
  OrganizationIndustryType,
  OrganizationLegalType,
  OrganizationNatureType,
  OrganizationStatusType,
  OrganizationCurrencyType,
  OrganizationLanguageType,
  DeploymentType,
  OrganizationStorageProviderType,
} from "../../constants/index";

export interface OrganizationLocalization {
  currency: OrganizationCurrencyType;
  language: OrganizationLanguageType;
  timezone: string;
  dateFormat: string;
}

export interface OrganizationDeployment {
  type: DeploymentType;
  customDomain?: string;
  databaseUri?: string;
  serverRegion?: string;
  dbCluster?: string;
  customEnv?: Record<string, any>;
  storageConfig?: {
    provider: OrganizationStorageProviderType;
    bucket?: string;
    region?: string;
  };
}

export interface OrganizationResponseDto {
  organizationId: string;
  name: string;
  slug: string;
  industry: OrganizationIndustryType;
  legalType: OrganizationLegalType;
  nature: OrganizationNatureType;
  status: OrganizationStatusType;
  email: string;
  phone?: string;
  supportPhone?: string;
  website?: string;
  address?: string;
  establishedDate?: Date;
  localization: OrganizationLocalization;
  deployment: OrganizationDeployment;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
