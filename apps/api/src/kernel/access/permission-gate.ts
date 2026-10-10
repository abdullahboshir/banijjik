/**
 * Port implemented by core/iam: "at which locations may the caller do this?". It reads the
 * organization, the member and the access version from the request context (set by tenantContext).
 */
export interface PermissionGate {
  /** The location IDs where the permission is granted, "ALL" for every location, [] for none. */
  locationsWith(permissionKey: string): Promise<readonly string[] | "ALL">;
}
