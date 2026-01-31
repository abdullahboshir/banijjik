import {
  OrganizationIndustryType,
  OrganizationLegalType,
  OrganizationNatureType,
  OrganizationStatusType,
  DeploymentType,
  OrganizationCurrencyType,
  OrganizationStorageProviderType,
} from "@banijjik/contracts";

export interface OrganizationLocalization {
  currency: OrganizationCurrencyType;
  language: string;
  timezone: string;
  dateFormat: string;
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
    provider: OrganizationStorageProviderType;
    bucket?: string;
    region?: string;
  };
}

export interface OrganizationProps {
  _id?: string;
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
      id: props.id ?? crypto.randomUUID(),
      status: props.status || "PENDING",
      nature: props.nature || "SERVICE",
      establishedDate: props.establishedDate || new Date(),
      metadata: props.metadata || {},
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    };
  }

  get _id() {
    return this.props._id;
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
