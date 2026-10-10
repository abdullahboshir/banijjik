import type { GrantMap } from "../../domain/grant-map.js";

/**
 * Cache of resolved permissions. The key already contains every version that could make a value
 * stale (member, roles, catalogue), so an adapter never has to invalidate: old keys just age out.
 * The in-process adapter ships with card 1.4; a Redis adapter joins with card 1.5.
 */
export interface PermissionCache {
  get(key: string): Promise<GrantMap | undefined>;
  set(key: string, value: GrantMap): Promise<void>;
}
