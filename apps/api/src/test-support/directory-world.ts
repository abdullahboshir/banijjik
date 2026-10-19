import { MODULE_KEY, MODULE_OVERRIDE_EFFECT } from "@banijjik/contracts";
import type { TwoOrganizations } from "./two-organizations.js";
import { writeModuleOverride } from "./entitlement-world.js";

/** Grants the OPTIONAL directory module so tenant and storefront directory routes answer (M.2). */
export async function enableDirectoryModule(organizationId: string): Promise<void> {
  await writeModuleOverride({
    organizationId,
    moduleKey: MODULE_KEY.DIRECTORY,
    effect: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
  });
}

export async function enableDirectoryForWorld(world: TwoOrganizations): Promise<void> {
  await enableDirectoryModule(world.organizationA);
  await enableDirectoryModule(world.organizationB);
}
