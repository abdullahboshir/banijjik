import {
  platformPermissionsOf,
  type PlatformRole,
  type PlatformSessionResponse,
} from "@banijjik/contracts";
import type { User } from "../domain/user.entity.js";

/** Who is signed in on the platform and what the roles allow; shared by login and `GET /platform/me`. */
export function toPlatformSessionResponse(
  user: User,
  operator: {
    readonly platformOperatorId: string;
    readonly platformRoles: readonly PlatformRole[];
  },
): PlatformSessionResponse {
  return {
    userId: user.userId,
    platformOperatorId: operator.platformOperatorId,
    name: user.name,
    platformRoles: [...operator.platformRoles],
    permissions: [...platformPermissionsOf(operator.platformRoles)],
  };
}
