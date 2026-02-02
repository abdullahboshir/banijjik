import { OrganizationIndustry } from "../value-objects/industry.vo.js";
import { OrganizationLegal } from "../value-objects/legal-type.vo.js";
import { OrganizationNature } from "../value-objects/nature.vo.js";
import { OrganizationStatus } from "../value-objects/status.vo.js";
import { OrganizationLocalization } from "../value-objects/localization.vo.js";
import { OrganizationDeployment } from "../value-objects/deployment.vo.js";

export interface OrganizationProps {
  organizationId?: string;
  name: string;
  slug: string; // Could be VO
  industry: OrganizationIndustry;
  legalType: OrganizationLegal;
  nature: OrganizationNature;
  status: OrganizationStatus;
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
      organizationId: props.organizationId ?? crypto.randomUUID(),
      establishedDate: props.establishedDate || new Date(),
      metadata: props.metadata || {},
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    };
  }

  get organizationId() {
    return this.props.organizationId;
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
  get localization() {
    return this.props.localization;
  }
  get metadata() {
    return this.props.metadata;
  }
  get email() {
    return this.props.email;
  }
  get phone() {
    return this.props.phone;
  }
  get supportPhone() {
    return this.props.supportPhone;
  }
  get establishedDate() {
    return this.props.establishedDate;
  }
  get address() {
    return this.props.address;
  }
  get website() {
    return this.props.website;
  }

  public update(props: Partial<OrganizationProps>): void {
    this.props = {
      ...this.props,
      ...props,
      updatedAt: new Date(),
    };
  }

  public toJSON() {
    return {
      ...this.props,
      industry: this.props.industry.getValue(),
      legalType: this.props.legalType.getValue(),
      nature: this.props.nature.getValue(),
      status: this.props.status.getValue(),
      localization: this.props.localization.toValue(),
      deployment: this.props.deployment.toValue(),
    };
  }
}
