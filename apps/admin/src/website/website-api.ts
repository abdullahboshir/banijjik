import type {
  SitePageKey,
  SitePageResponse,
  SitePageUpsertRequest,
} from "@banijjik/contracts/website";
import { apiFetch } from "../lib/api/api-client";

function pagesPath(organizationId: string, suffix = ""): string {
  return `/orgs/${organizationId}/website/pages${suffix}`;
}

/** The six static pages; a page never saved comes back as an empty, unpublished page (version 0). */
export async function fetchSitePages(organizationId: string): Promise<SitePageResponse[]> {
  const result = await apiFetch<SitePageResponse[]>(pagesPath(organizationId));
  return result.data;
}

export async function saveSitePage(
  organizationId: string,
  pageKey: SitePageKey,
  body: SitePageUpsertRequest,
): Promise<SitePageResponse> {
  const result = await apiFetch<SitePageResponse>(pagesPath(organizationId, `/${pageKey}`), {
    method: "PUT",
    body,
  });
  return result.data;
}
