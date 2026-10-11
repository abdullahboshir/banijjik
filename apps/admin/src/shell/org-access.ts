import "server-only";
import {
  ACCESS_MODE,
  ERROR_HTTP_STATUS,
  ORGANIZATION_STATUS,
  type MeResponse,
  type MyOrganizationSummary,
  type OrganizationProfileResponse,
  type ResolvedOrgConfigResponse,
} from "@banijjik/contracts";
import { notFound } from "next/navigation";
import { cache } from "react";
import { loadSessionData, requireSession } from "../auth/session-data";
import { ApiError } from "../lib/api/api-error";
import { serverApiFetch } from "../lib/api/server-api-fetch";

/** Used when the profile cannot be read; the trial banner then counts days in UTC. */
const FALLBACK_TIME_ZONE = "UTC";

/** What the shell knows about one business for this request; the business and its config may be absent. */
export interface OrgContext {
  me: MeResponse;
  organizations: MyOrganizationSummary[];
  /** Absent when the slug is not one of the person's businesses. */
  organization: MyOrganizationSummary | undefined;
  /** Absent for an unknown or a suspended business, which have no menu to draw. */
  config: ResolvedOrgConfigResponse | undefined;
  timeZone: string;
}

/** The context a page needs to read or write business data. */
export interface OrgAccess extends OrgContext {
  organization: MyOrganizationSummary;
  config: ResolvedOrgConfigResponse;
  /** False in READ_ONLY mode: write actions are hidden (13-UX section 5, ADR-053). */
  canWrite: boolean;
}

async function loadTimeZone(organizationId: string): Promise<string> {
  try {
    const profile = await serverApiFetch<OrganizationProfileResponse>(
      `/orgs/${organizationId}/profile`,
    );
    return profile.data.timezone;
  } catch (error) {
    // The timezone only sharpens a banner; a failure other than "no session" must not hide the page.
    if (error instanceof ApiError && error.status !== ERROR_HTTP_STATUS.UNAUTHENTICATED) {
      return FALLBACK_TIME_ZONE;
    }
    throw error;
  }
}

async function loadConfig(organizationId: string): Promise<ResolvedOrgConfigResponse> {
  try {
    const result = await serverApiFetch<ResolvedOrgConfigResponse>(
      `/orgs/${organizationId}/me/config`,
    );
    return result.data;
  } catch (error) {
    // A member who was suspended or removed gets the same 404 as a stranger (ADR-022).
    if (error instanceof ApiError && error.status === ERROR_HTTP_STATUS.NOT_FOUND) notFound();
    throw error;
  }
}

async function loadOrgContextUncached(orgSlug: string): Promise<OrgContext> {
  const { me, organizations } = await loadSessionData();
  const organization = organizations.find((candidate) => candidate.slug === orgSlug);
  if (!organization || organization.status === ORGANIZATION_STATUS.SUSPENDED) {
    return { me, organizations, organization, config: undefined, timeZone: FALLBACK_TIME_ZONE };
  }
  const [config, timeZone] = await requireSession(() =>
    Promise.all([
      loadConfig(organization.organizationId),
      loadTimeZone(organization.organizationId),
    ]),
  );
  return { me, organizations, organization, config, timeZone };
}

/** One load per request: the layout and the page share it (React cache), so nothing is fetched twice. */
export const loadOrgContext = cache(loadOrgContextUncached);

/** For pages: the business must exist, be active and answer; anything else is the not-found page. */
export async function requireOrgAccess(orgSlug: string): Promise<OrgAccess> {
  const context = await loadOrgContext(orgSlug);
  const { organization, config } = context;
  if (!organization || !config) notFound();
  return { ...context, organization, config, canWrite: config.accessMode === ACCESS_MODE.FULL };
}
