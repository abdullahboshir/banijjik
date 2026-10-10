import type { Router } from "express";

/**
 * The part of an Express 5 router layer this walk reads. @types/express-serve-static-core still
 * describes the Express 4 layer, so the shape is declared here and checked by the walk's tests.
 */
interface RouterLayer {
  readonly name: string;
  readonly route?: { readonly path: string };
  /** True for `router.use(handler)` without a path: the layer matches every request. */
  readonly slash: boolean;
  readonly matchers: readonly ((path: string) => unknown)[];
  readonly handle: { readonly stack?: readonly RouterLayer[] };
}

export interface MountedTenantRoutes {
  /** Full v1 paths such as `/orgs/:organizationId/audit-logs`. */
  readonly paths: readonly string[];
  /** Nested routers mounted on a path: Express 5 does not keep that path in a readable form. */
  readonly unreadableMounts: number;
}

const TENANT_MOUNT = "/orgs/:organizationId";
const SAMPLE_TENANT_PATH = "/orgs/sample-organization";

function layersOf(router: { stack?: readonly RouterLayer[] }): readonly RouterLayer[] {
  return router.stack ?? [];
}

function collectRoutes(layers: readonly RouterLayer[]): { paths: string[]; unreadable: number } {
  const paths: string[] = [];
  let unreadable = 0;
  for (const layer of layers) {
    if (layer.route !== undefined) {
      paths.push(layer.route.path === "/" ? "" : layer.route.path);
      continue;
    }
    if (layer.name !== "router") continue;
    if (!layer.slash) {
      unreadable += 1;
      continue;
    }
    const nested = collectRoutes(layersOf(layer.handle));
    paths.push(...nested.paths);
    unreadable += nested.unreadable;
  }
  return { paths, unreadable };
}

function isTenantMount(layer: RouterLayer): boolean {
  return layer.matchers.some((matches) => Boolean(matches(SAMPLE_TENANT_PATH)));
}

/**
 * The routes that the v1 router mounts behind `/orgs/:organizationId`. The mount layers are found
 * by asking each layer whether it matches a tenant path; the routes are read from the module
 * routers under them. Express 5 does not keep the text of a mount path, so a router mounted on a
 * path inside a module router is reported as unreadable instead of guessed.
 */
export function listTenantRoutes(v1Router: Router): MountedTenantRoutes {
  // Safe: Express 5 stores the layers in router.stack; see RouterLayer.
  const topLayers = layersOf(v1Router as unknown as { stack: readonly RouterLayer[] });
  const tenantLayers = topLayers.filter((layer) => layer.name === "router" && isTenantMount(layer));
  const found = tenantLayers.map((layer) => collectRoutes(layersOf(layer.handle)));
  return {
    paths: found.flatMap((entry) => entry.paths).map((path) => `${TENANT_MOUNT}${path}`),
    unreadableMounts: found.reduce((total, entry) => total + entry.unreadable, 0),
  };
}
