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
  type OrganizationProfileFields,
  type OrganizationStatus,
  type PreferredLocale,
} from "@banijjik/contracts";
import { newId, type OrganizationId, type UserId } from "@banijjik/ids";
import { applyClearableChanges, type ClearableChanges } from "./clearable.js";
import { invalidField, invalidTransition } from "./errors.js";

const DEFAULT_TIMEZONE = "Asia/Dhaka";
const INITIAL_CONFIG_VERSION = 1;
const INITIAL_ROLES_VERSION = 1;

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
  /** Shown on invoices and the storefront; empty until the owner fills it in. */
  readonly profile: OrganizationProfileFields;
  readonly configVersion: number;
  /** Bumped by every role change; part of the permission cache key (card 1.4). */
  readonly rolesVersion: number;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Null when the system created it. */
  readonly createdByUserId: UserId | null;
}

/** The fields the profile endpoint may change (plan 1.7b decision 3). */
export interface OrganizationProfileChanges {
  readonly name?: string;
  readonly defaultLocale?: PreferredLocale;
  /** Per optional field: a value sets it, `null` clears it, an absent key leaves it. */
  readonly profile?: ClearableChanges<OrganizationProfileFields>;
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
  readonly profile: OrganizationProfileFields;
  readonly configVersion: number;
  /** Bumped by every role change; part of the permission cache key (card 1.4). */
  readonly rolesVersion: number;
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
    this.profile = props.profile;
    this.configVersion = props.configVersion;
    this.rolesVersion = props.rolesVersion;
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
      profile: {},
      configVersion: INITIAL_CONFIG_VERSION,
      rolesVersion: INITIAL_ROLES_VERSION,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.ownerUserId,
    });
  }

  /**
   * The organization with the given profile changes applied. Profile fields given are merged over
   * the stored ones, `null` removes a field, and an address replaces the stored address as a whole.
   */
  withProfileChanges(changes: OrganizationProfileChanges): Organization {
    const name = changes.name === undefined ? this.name : changes.name.trim();
    assertNameLength(name);
    return new Organization({
      ...this,
      name,
      defaultLocale: changes.defaultLocale ?? this.defaultLocale,
      profile: applyClearableChanges(this.profile, changes.profile ?? {}),
    });
  }

  /** ACTIVE to SUSPENDED: every tenant route of the organization then answers ORG_SUSPENDED. */
  suspended(): Organization {
    return this.withStatus([ORGANIZATION_STATUS.ACTIVE], ORGANIZATION_STATUS.SUSPENDED);
  }

  /** SUSPENDED to ACTIVE. A CLOSED organization never comes back. */
  reactivated(): Organization {
    return this.withStatus([ORGANIZATION_STATUS.SUSPENDED], ORGANIZATION_STATUS.ACTIVE);
  }

  private withStatus(
    allowedFrom: readonly OrganizationStatus[],
    next: OrganizationStatus,
  ): Organization {
    if (!allowedFrom.includes(this.status)) throw invalidTransition(this.status);
    return new Organization({ ...this, status: next });
  }

  /** Rebuilds a stored organization. The stored data was checked when it was written. */
  static restore(props: OrganizationProps): Organization {
    return new Organization(props);
  }
}
