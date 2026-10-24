import { MODULE_KEY } from "@banijjik/contracts";
import type { SalesPerformerResponse } from "@banijjik/contracts/sales";
import type { ResolvedOrgConfigResponse } from "@banijjik/contracts";

/** The "Done by" select and the performer names show only while the commission module is on (ADR-135). */
export function commissionEnabledOf(config: ResolvedOrgConfigResponse): boolean {
  return config.modules.includes(MODULE_KEY.COMMISSION);
}

/** Member id to display name, for the performers of one location; an unknown id has no entry. */
export function performerNamesOf(
  performers: readonly SalesPerformerResponse[] | undefined,
): Readonly<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const performer of performers ?? []) names[performer.memberId] = performer.name;
  return names;
}
