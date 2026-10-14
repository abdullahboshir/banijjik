import type { ResolvedSetting } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { settingNotAvailable } from "../../domain/setting-errors.js";
import type { SettingsResolver } from "../settings-resolver.js";

export interface GetSettingsInput {
  readonly organizationId: OrganizationId;
  readonly keys?: readonly string[];
  readonly locationId?: string;
}

/** A keyed read of the effective settings. An unknown or ineffective key is 404. */
export class GetSettingsUseCase {
  constructor(private readonly resolver: SettingsResolver) {}

  async execute(input: GetSettingsInput): Promise<ReadonlyMap<string, ResolvedSetting>> {
    const resolved = await this.resolver.resolve(input.organizationId, {
      ...(input.keys === undefined ? {} : { keys: input.keys }),
      ...(input.locationId === undefined ? {} : { locationId: input.locationId }),
    });
    assertRequestedKeys(input.keys, resolved);
    return resolved;
  }
}

function assertRequestedKeys(
  keys: readonly string[] | undefined,
  resolved: ReadonlyMap<string, ResolvedSetting>,
): void {
  if (keys === undefined) return;
  for (const settingKey of keys) {
    if (!resolved.has(settingKey)) throw settingNotAvailable(settingKey);
  }
}
