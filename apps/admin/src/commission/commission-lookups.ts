import "server-only";
import type {
  CurrencyCode,
  LocationResponse,
  MemberResponse,
  OfferingKind,
  OrganizationProfileResponse,
  RoleSummary,
} from "@banijjik/contracts";
import type { CategoryResponse, OfferingListItem } from "@banijjik/contracts/catalog";
import type { Translator } from "@banijjik/i18n";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { roleLabelOf } from "../staff/assignment-options";
import type { OrgAccess } from "../shell/org-access";

const LOOKUP_LIMIT = 100;

export interface CommissionMemberOption {
  memberId: string;
  name: string;
}

export interface CommissionNamedOption {
  id: string;
  name: string;
}

export interface CommissionLocationOption {
  locationId: string;
  name: string;
}

/** Everything the rules screen needs to name a rule and to fill its sheet. */
export interface CommissionRuleLookups {
  members: CommissionMemberOption[];
  roles: CommissionNamedOption[];
  categories: CommissionNamedOption[];
  offerings: CommissionNamedOption[];
  kinds: OfferingKind[];
  currency: CurrencyCode;
}

/** The choices of a payout: who has commission, where and in which currency. */
export interface CommissionPayoutLookups {
  locations: CommissionLocationOption[];
  currency: CurrencyCode;
}

function baseOf(access: OrgAccess): string {
  return `/orgs/${access.organization.organizationId}`;
}

async function loadCurrency(access: OrgAccess): Promise<CurrencyCode> {
  const profile = await fetchBusinessResource<OrganizationProfileResponse>(
    `${baseOf(access)}/profile`,
  );
  return profile.data.currencyCode;
}

/** Reads the choices once per page; a missing permission leaves that choice empty (the API still decides). */
export async function loadCommissionRuleLookups(
  access: OrgAccess,
  t: Translator["t"],
): Promise<CommissionRuleLookups> {
  const base = baseOf(access);
  const [members, roles, categories, offerings, currency] = await Promise.all([
    fetchBusinessResourceIfAllowed<MemberResponse[]>(
      `${base}/members?status=ACTIVE&limit=${LOOKUP_LIMIT}`,
    ),
    fetchBusinessResourceIfAllowed<RoleSummary[]>(`${base}/roles?limit=${LOOKUP_LIMIT}`),
    fetchBusinessResourceIfAllowed<CategoryResponse[]>(`${base}/categories?limit=${LOOKUP_LIMIT}`),
    fetchBusinessResourceIfAllowed<OfferingListItem[]>(`${base}/offerings?limit=${LOOKUP_LIMIT}`),
    loadCurrency(access),
  ]);
  return {
    members: (members ?? []).map((member) => ({
      memberId: member.memberId,
      name: member.displayName,
    })),
    roles: (roles ?? [])
      .filter((role) => role.status === "ACTIVE")
      .map((role) => ({ id: role.roleId, name: roleLabelOf(role, t) })),
    categories: (categories ?? [])
      .filter((category) => category.status === "ACTIVE")
      .map((category) => ({ id: category.categoryId, name: category.name })),
    offerings: (offerings ?? [])
      .filter((offering) => offering.status === "ACTIVE")
      .map((offering) => ({ id: offering.offeringId, name: offering.name })),
    kinds: [...access.config.kinds],
    currency,
  };
}

/** Members for a filter or a payout sheet: the active staff, as names only. */
export async function loadCommissionMembers(access: OrgAccess): Promise<CommissionMemberOption[]> {
  const members = await fetchBusinessResourceIfAllowed<MemberResponse[]>(
    `${baseOf(access)}/members?status=ACTIVE&limit=${LOOKUP_LIMIT}`,
  );
  return (members ?? []).map((member) => ({
    memberId: member.memberId,
    name: member.displayName,
  }));
}

export async function loadCommissionLocations(
  access: OrgAccess,
): Promise<CommissionLocationOption[]> {
  const locations = await fetchBusinessResourceIfAllowed<LocationResponse[]>(
    `${baseOf(access)}/locations?status=ACTIVE&limit=${LOOKUP_LIMIT}`,
  );
  return (locations ?? []).map((location) => ({
    locationId: location.locationId,
    name: location.name,
  }));
}

export async function loadCommissionCurrency(access: OrgAccess): Promise<CurrencyCode> {
  return loadCurrency(access);
}
