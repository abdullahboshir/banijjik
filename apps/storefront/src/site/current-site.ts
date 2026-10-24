import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { organizationIdFrom } from "../host/organization-header";

/**
 * The business of this request. An unknown host has no business, and the page answers 404 (M.6 decision 9).
 * The id comes only from the header the proxy set, never from the URL or the browser.
 */
export async function requireOrganizationId(): Promise<string> {
  const organizationId = organizationIdFrom(await headers());
  if (organizationId === undefined) notFound();
  return organizationId;
}
