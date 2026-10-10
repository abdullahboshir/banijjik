import type { MyOrganizationSummary } from "@banijjik/contracts";
import type { QueryClient } from "@tanstack/react-query";

/** TanStack Query key of the businesses the signed-in person belongs to. */
export const MY_ORGANIZATIONS_QUERY_KEY = ["me", "orgs"] as const;

/**
 * The server layout already loaded the businesses (`GET /me/orgs`), so the browser cache is filled from that
 * answer instead of asking again. Reading it with `useQuery` would add about 4 KB gzip to every page's first
 * load (13-UX section 11), so client code reads this key only where it needs live updates.
 */
export function seedMyOrganizations(
  queryClient: QueryClient,
  organizations: MyOrganizationSummary[],
): void {
  queryClient.setQueryData(MY_ORGANIZATIONS_QUERY_KEY, organizations);
}
