import "server-only";
import { OFFERING_KIND, PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { ResourceResponse } from "@banijjik/contracts/booking";
import {
  VARIANT_STATUS,
  type OfferingListItem,
  type OfferingResponse,
  type PlanDetails,
} from "@banijjik/contracts/catalog";
import type { ContactResponse } from "@banijjik/contracts/contact";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import type { PlanChoice, ResourceChoice } from "./new-enrollment-form";

const LOOKUP_LIMIT = 100;

function planChoiceOf(offering: OfferingResponse): PlanChoice {
  const details = offering.kindDetails as PlanDetails;
  return {
    offeringId: offering.offeringId,
    name: offering.name,
    startRule: details.startRule,
    startDates: details.startDates ?? [],
    variants: offering.variants
      .filter((variant) => variant.status === VARIANT_STATUS.ACTIVE)
      .map((variant) => ({ variantId: variant.variantId, name: variant.name })),
  };
}

/** The ACTIVE plans with their ACTIVE variants: what the enrollment sheet and the plan filter offer. */
export async function loadPlans(access: OrgAccess): Promise<PlanChoice[]> {
  const organizationId = access.organization.organizationId;
  const { data: list } = await fetchBusinessResource<OfferingListItem[]>(
    `/orgs/${organizationId}/offerings?kind=${OFFERING_KIND.PLAN}&status=ACTIVE&limit=${LOOKUP_LIMIT}`,
  );
  const offerings = await Promise.all(
    list.map(async (row) => {
      const { data } = await fetchBusinessResource<OfferingResponse>(
        `/orgs/${organizationId}/offerings/${row.offeringId}`,
      );
      return data;
    }),
  );
  return offerings.map(planChoiceOf);
}

export async function loadActiveLocations(access: OrgAccess): Promise<LocationResponse[]> {
  const organizationId = access.organization.organizationId;
  const locations = await fetchBusinessResourceIfAllowed<LocationResponse[]>(
    `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOOKUP_LIMIT}`,
  );
  return locations ?? [];
}

/** Beds and other resources an enrollment may hold; empty when the caller may not read resources. */
export async function loadResourceChoices(access: OrgAccess): Promise<ResourceChoice[]> {
  const organizationId = access.organization.organizationId;
  const resources = await fetchBusinessResourceIfAllowed<ResourceResponse[]>(
    `/orgs/${organizationId}/resources?status=ACTIVE&page=1&limit=${LOOKUP_LIMIT}`,
  );
  return (resources ?? []).map((resource) => ({
    resourceId: resource.resourceId,
    locationId: resource.locationId,
    name: resource.name,
  }));
}

/** Names for the contacts on one page; a contact the caller cannot read stays unnamed. */
export async function loadContactNames(
  access: OrgAccess,
  contactIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.CONTACT_CONTACT_READ)) {
    return new Map();
  }
  const organizationId = access.organization.organizationId;
  const unique = [...new Set(contactIds)];
  const contacts = await Promise.all(
    unique.map((contactId) =>
      fetchBusinessResourceIfAllowed<ContactResponse>(
        `/orgs/${organizationId}/contacts/${contactId}`,
      ),
    ),
  );
  const names = new Map<string, string>();
  for (const contact of contacts) {
    if (contact) names.set(contact.contactId, contact.name ?? contact.phoneE164 ?? "");
  }
  return names;
}
