import {
  COUNTRY_CODE,
  CURRENCY_CODE,
  normalizeOrganizationSlug,
  ORGANIZATION_DEPLOYMENT,
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_NAME_MIN_LENGTH,
  ORGANIZATION_SLUG_MAX_LENGTH,
  ORGANIZATION_SLUG_MIN_LENGTH,
  ORGANIZATION_SLUG_PATTERN,
  ORGANIZATION_STATUS,
  RESERVED_ORGANIZATION_SLUGS,
  type CountryCode,
  type CurrencyCode,
  type IndustryTemplateKey,
  type OrganizationDeployment,
  type OrganizationStatus,
  type PreferredLocale,
} from "@banijjik/contracts";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { invalidField } from "./errors.js";

const DEFAULT_TIMEZONE = "Asia/Dhaka";
const INITIAL_CONFIG_VERSION = 1;

export interface OrganizationProps {
  readonly organizationId: OrganizationId;
  readonly slug: string;
  readonly name: string;
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly ownerUserId: UserId;
  readonly status: OrganizationStatus;
  readonly deployment: OrganizationDeployment;
  readonly countryCode: CountryCode;
  readonly currencyCode: CurrencyCode;
  readonly timezone: string;
  readonly defaultLocale: PreferredLocale;
  readonly configVersion: number;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Null when the system created it. */
  readonly createdByUserId: UserId | null;
}

export interface NewOrganizationInput {
  readonly name: string;
  readonly slug: string;
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly ownerUserId: UserId;
  readonly defaultLocale: PreferredLocale;
  readonly now: Date;
}

function assertNameLength(name: string): void {
  if (name.length < ORGANIZATION_NAME_MIN_LENGTH || name.length > ORGANIZATION_NAME_MAX_LENGTH) {
    throw invalidField("name", "validation.name_length");
  }
}

function assertSlugAllowed(slug: string): void {
  const isLengthValid =
    slug.length >= ORGANIZATION_SLUG_MIN_LENGTH && slug.length <= ORGANIZATION_SLUG_MAX_LENGTH;
  if (!isLengthValid || !ORGANIZATION_SLUG_PATTERN.test(slug)) {
    throw invalidField("slug", "validation.slug_invalid");
  }
  if (RESERVED_ORGANIZATION_SLUGS.includes(slug)) {
    throw invalidField("slug", "validation.slug_reserved");
  }
}

/**
 * One business with one industry template and one currency (09 section 4.2). It is the tenant:
 * its locations, members and roles all carry its `organizationId`. The template key is stored
 * here and never branched on (ADR-033).
 */
export class Organization implements OrganizationProps {
  readonly organizationId: OrganizationId;
  readonly slug: string;
  readonly name: string;
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly ownerUserId: UserId;
  readonly status: OrganizationStatus;
  readonly deployment: OrganizationDeployment;
  readonly countryCode: CountryCode;
  readonly currencyCode: CurrencyCode;
  readonly timezone: string;
  readonly defaultLocale: PreferredLocale;
  readonly configVersion: number;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Null when the system created it. */
  readonly createdByUserId: UserId | null;

  private constructor(props: OrganizationProps) {
    this.organizationId = props.organizationId;
    this.slug = props.slug;
    this.name = props.name;
    this.industryTemplateKey = props.industryTemplateKey;
    this.ownerUserId = props.ownerUserId;
    this.status = props.status;
    this.deployment = props.deployment;
    this.countryCode = props.countryCode;
    this.currencyCode = props.currencyCode;
    this.timezone = props.timezone;
    this.defaultLocale = props.defaultLocale;
    this.configVersion = props.configVersion;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  /** A new, active organization on the shared database. The caller owns it and created it. */
  static create(input: NewOrganizationInput): Organization {
    const name = input.name.trim();
    const slug = normalizeOrganizationSlug(input.slug);
    assertNameLength(name);
    assertSlugAllowed(slug);
    return new Organization({
      organizationId: newId(),
      slug,
      name,
      industryTemplateKey: input.industryTemplateKey,
      ownerUserId: input.ownerUserId,
      status: ORGANIZATION_STATUS.ACTIVE,
      deployment: ORGANIZATION_DEPLOYMENT.SHARED,
      countryCode: COUNTRY_CODE.BD,
      currencyCode: CURRENCY_CODE.BDT,
      timezone: DEFAULT_TIMEZONE,
      defaultLocale: input.defaultLocale,
      configVersion: INITIAL_CONFIG_VERSION,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.ownerUserId,
    });
  }

  /** Rebuilds a stored organization. The stored data was checked when it was written. */
  static restore(props: OrganizationProps): Organization {
    return new Organization(props);
  }
}
