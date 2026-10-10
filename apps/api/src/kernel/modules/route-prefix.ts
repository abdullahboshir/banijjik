import type { ModuleManifest } from "@banijjik/contracts";

export interface RoutePrefix {
  readonly prefix: string;
  readonly segments: readonly string[];
  readonly owner: ModuleManifest;
}

function segmentsOf(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

/** `/orgs/:organizationId/roles` and `/orgs/:id/roles` are the same shape: any param matches one segment. */
export function routeShape(prefix: string): string {
  return segmentsOf(prefix)
    .map((segment) => (segment.startsWith(":") ? ":" : segment))
    .join("/");
}

/** Every route prefix of a manifest, over all four surfaces. */
export function allRoutePrefixes(manifest: ModuleManifest): readonly RoutePrefix[] {
  const lists = Object.values(manifest.routes);
  return lists.flatMap((list) =>
    (list ?? []).map((prefix: string) => ({
      prefix,
      segments: segmentsOf(prefix),
      owner: manifest,
    })),
  );
}

function isPrefixOf(prefix: RoutePrefix, pathSegments: readonly string[]): boolean {
  if (prefix.segments.length > pathSegments.length) return false;
  return prefix.segments.every(
    (segment, index) => segment.startsWith(":") || segment === pathSegments[index],
  );
}

/** The route whose prefix matches the path with the most segments (the most specific owner). */
export function findOwningRoute(
  prefixes: readonly RoutePrefix[],
  path: string,
): RoutePrefix | undefined {
  const pathSegments = segmentsOf(path);
  let best: RoutePrefix | undefined;
  for (const candidate of prefixes) {
    if (!isPrefixOf(candidate, pathSegments)) continue;
    if (best === undefined || candidate.segments.length > best.segments.length) best = candidate;
  }
  return best;
}
