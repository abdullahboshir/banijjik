import type { PermissionGate } from "../../../../kernel/access/index.js";
import { rolePermissionsNotGrantable } from "../domain/errors.js";
import { changedPermissionKeys, keysNotHeld } from "../domain/role-grant-rules.js";

/**
 * No privilege escalation through roles (ADR-092): every key a role write adds or removes must be
 * held by the caller at ALL locations. A key the write leaves as it is does not count, so an editor
 * can still rename a role that holds keys they lack. Run inside the request of the write.
 */
export async function assertCallerMayChangeKeys(
  permissions: Pick<PermissionGate, "describeCaller">,
  before: readonly string[],
  after: readonly string[],
): Promise<void> {
  const changed = changedPermissionKeys(before, after);
  if (changed.length === 0) return;
  const caller = await permissions.describeCaller();
  const notHeld = keysNotHeld(changed, caller.allLocations);
  if (notHeld.length > 0) throw rolePermissionsNotGrantable(notHeld);
}
