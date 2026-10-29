import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  organizationIdFrom,
  storefrontResolutionFrom,
  type TrustedHostResolution,
} from "../host/organization-header";

export type CurrentSiteResolution = TrustedHostResolution;

/**
 * Reads the single authoritative host resolution stamped by the proxy for the current request.
 * Returns undefined for unknown hosts.
 */
export async function currentSiteResolution(): Promise<CurrentSiteResolution | undefined> {
  return storefrontResolutionFrom(await headers());
}

/**
 * Requires an authoritative host resolution for this request.
 * If the host was unknown to the proxy, renders not-found immediately.
 */
export async function requireCurrentSiteResolution(): Promise<CurrentSiteResolution> {
  const resolution = await currentSiteResolution();
  if (resolution === undefined) notFound();
  return resolution;
}

/**
 * The business of this request. An unknown host has no business, and the page answers 404 (M.6 decision 9).
 * The id comes only from the header the proxy set, never from the URL or the browser.
 */
export async function requireOrganizationId(): Promise<string> {
  const organizationId = organizationIdFrom(await headers());
  if (organizationId === undefined) notFound();
  return organizationId;
}

/** The canonical hostname for the active site, or undefined on unknown hosts. */
export async function currentCanonicalHostname(): Promise<string | undefined> {
  const resolution = await currentSiteResolution();
  return resolution?.canonicalHostname;
}

/** The canonical hostname for the active site, or 404 on unknown hosts. */
export async function requireCanonicalHostname(): Promise<string> {
  const resolution = await requireCurrentSiteResolution();
  return resolution.canonicalHostname;
}
