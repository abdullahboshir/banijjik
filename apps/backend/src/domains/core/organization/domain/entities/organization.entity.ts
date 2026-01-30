import {
  OrganizationIndustryType,
  OrganizationLegalType,
  OrganizationNatureType,
  OrganizationStatusType,
  DeploymentType,
  OrganizationCurrencyType,
} from "@banijjik/contracts";

export interface OrganizationBranding {
  logo?: string;
  banner?: string;
  favicon?: string;
  tagline?: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
  };
}

export interface OrganizationSEO {
  metaTitle?: string;
  metaDescription?: string;
  keywords: string[];
  canonicalUrl?: string;
  ogImage?: string;
  structuredData?: Record<string, any>;
}

export interface OrganizationPolicies {
  privacyPolicy?: string;
  termsOfService?: string;
  refundPolicy?: string;
}

export interface OrganizationLocalization {
  currency: OrganizationCurrencyType;
  language: string;
  timezone: string;
  dateFormat: string;
}

export interface OrganizationDeployment {
  type: DeploymentType;
  customDomain?: string;
  databaseUri?: string; // Sensitive
  serverRegion?: string;
  dbCluster?: string;
  customEnv?: Record<string, any>;
  storageConfig?: {
    provider: "cloudinary" | "s3" | "local";
    bucket?: string;
    region?: string;
  };
}

export interface OrganizationProps {
  id?: string;
  name: string;
  slug: string;
  industry: OrganizationIndustryType;
  legalType: OrganizationLegalType;
  nature: OrganizationNatureType;
  status: OrganizationStatusType;
  email?: string;
  phone?: string;
  supportPhone?: string;
  website?: string;
  address?: string;
  establishedDate?: Date;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    linkedin?: string;
  };
  branding: OrganizationBranding;
  seo: OrganizationSEO;
  policies: OrganizationPolicies;
  localization: OrganizationLocalization;
  deployment: OrganizationDeployment;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Organization {
  private props: OrganizationProps;

  constructor(props: OrganizationProps) {
    this.props = {
      ...props,
      status: props.status || "PENDING",
      nature: props.nature || "SERVICE",
      socialMedia: props.socialMedia || {},
      establishedDate: props.establishedDate || new Date(),
      metadata: props.metadata || {},
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    };
  }

  get id() {
    return this.props.id;
  }
  get name() {
    return this.props.name;
  }
  get slug() {
    return this.props.slug;
  }
  get industry() {
    return this.props.industry;
  }
  get legalType() {
    return this.props.legalType;
  }
  get nature() {
    return this.props.nature;
  }
  get status() {
    return this.props.status;
  }
  get branding() {
    return this.props.branding;
  }
  get deployment() {
    return this.props.deployment;
  }
  get metadata() {
    return this.props.metadata;
  }

  public update(props: Partial<OrganizationProps>): void {
    this.props = {
      ...this.props,
      ...props,
      updatedAt: new Date(),
    };
  }

  public toJSON() {
    return { ...this.props };
  }
}
