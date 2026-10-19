import { EVENT_TYPE, MODULE_KEY } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { AccountRepository } from "../ports/account-repository.js";
import { seedSystemAccounts } from "../seed-system-accounts.js";

export function buildSeedOnOrganizationCreatedHandler(input: {
  readonly accounts: AccountRepository;
  readonly clock: Clock;
}): EventHandler<typeof EVENT_TYPE.ORGANIZATION_CREATED> {
  return {
    handlerKey: "accounting.seedSystemAccounts",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: EVENT_TYPE.ORGANIZATION_CREATED,
    ordering: "UNORDERED",
    async handle(envelope) {
      await seedSystemAccounts(
        { accounts: input.accounts, clock: input.clock },
        {
          organizationId: asId<OrganizationId>(envelope.payload.organizationId),
          actorUserId: null,
        },
      );
    },
  };
}
