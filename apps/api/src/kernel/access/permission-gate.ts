/** Every permission the caller holds, by where it is granted. Keys are plain strings: the kernel does not know the catalogue. */
export interface CallerGrants {
  /** Keys granted at every location. */
  readonly allLocations: readonly string[];
  /** Keys granted at one specific location, by location ID. */
  readonly byLocation: Readonly<Record<string, readonly string[]>>;
}

/**
 * Port implemented by core/iam: "at which locations may the caller do this?". It reads the
 * organization, the member and the access version from the request context (set by tenantContext).
 */
export interface PermissionGate {
  /** The location IDs where the permission is granted, "ALL" for every location, [] for none. */
  locationsWith(permissionKey: string): Promise<readonly string[] | "ALL">;
  /** All of the caller's grants, for `/me/config`. */
  describeCaller(): Promise<CallerGrants>;
}
