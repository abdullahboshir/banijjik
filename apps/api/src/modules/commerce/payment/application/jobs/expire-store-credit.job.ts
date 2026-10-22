import { MODULE_KEY } from "@banijjik/contracts";
import {
  PAYMENT_EVENT_TYPE,
  PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
} from "@banijjik/contracts/payment";
import { asId, newId, type OrganizationId, type StoreCreditEntryId } from "@banijjik/ids";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import { StoreCreditEntry } from "../../domain/store-credit-entry.entity.js";
import type {
  ContactStoreCreditPort,
  PaymentUnitOfWork,
  StoreCreditRepository,
} from "../ports/payment-repositories.js";

export interface ExpireStoreCreditJobDependencies {
  readonly storeCredit: StoreCreditRepository;
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly unitOfWork: PaymentUnitOfWork;
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly orgConfig?: OrgConfigService;
  readonly clock: Clock;
}

async function resolveExpiryDays(
  orgConfig: OrgConfigService | undefined,
  organizationId: OrganizationId,
): Promise<number | null> {
  if (!orgConfig) return 1;
  const effective = await orgConfig.forOrganization(organizationId);
  const val = effective.config.settings[PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY];
  return typeof val === "number" && val > 0 ? val : null;
}

async function expireSingleEntry(input: {
  readonly deps: ExpireStoreCreditJobDependencies;
  readonly organizationId: OrganizationId;
  readonly entry: StoreCreditEntry;
  readonly now: Date;
}): Promise<void> {
  const { deps, organizationId, entry, now } = input;
  await deps.unitOfWork.run(async () => {
    const contactBal = await deps.contactStoreCredit.getBalance(organizationId, entry.contactId);
    if (!contactBal || contactBal.balanceMinor <= 0) return;

    const expireMinor = Math.min(contactBal.balanceMinor, entry.amount.amount);
    if (expireMinor <= 0) return;

    const adjustRes = await deps.contactStoreCredit.adjustBalance({
      organizationId,
      contactId: entry.contactId,
      deltaMinor: -expireMinor,
      expectedVersion: contactBal.version,
    });
    if (!adjustRes.success) return;

    const expireEntryId = newId<StoreCreditEntryId>();
    await deps.storeCredit.create(
      StoreCreditEntry.create({
        storeCreditEntryId: expireEntryId,
        organizationId,
        contactId: entry.contactId,
        direction: STORE_CREDIT_DIRECTION.DEBIT,
        kind: STORE_CREDIT_ENTRY_KIND.EXPIRY,
        amount: { amount: expireMinor, currency: entry.amount.currency },
        paymentId: null,
        balanceAfterMinor: adjustRes.newBalanceMinor,
        note: `Expired store credit from ${entry.storeCreditEntryId}`,
        expiresAt: null,
        expiresStoreCreditEntryId: entry.storeCreditEntryId,
        createdAt: now,
        createdByUserId: null,
      }),
    );

    await deps.events.publish(
      PAYMENT_EVENT_TYPE.STORE_CREDIT_CHANGED,
      { storeCreditEntryId: expireEntryId },
      { orderingKey: `paymentAccount:${organizationId}` },
    );
  });
}

export function buildExpireStoreCreditJob(deps: ExpireStoreCreditJobDependencies): ScheduledJob {
  return {
    jobKey: "payment.expireStoreCredit",
    everyMinutes: 24 * 60,
    moduleKey: MODULE_KEY.PAYMENT,
    run: async (rawOrgId, now) => {
      const organizationId = asId<OrganizationId>(rawOrgId);
      const expiryDays = await resolveExpiryDays(deps.orgConfig, organizationId);
      if (expiryDays === null) return;

      const expired = await deps.storeCredit.listExpiredUnprocessed(organizationId, now);
      for (const entry of expired) {
        await expireSingleEntry({ deps, organizationId, entry, now });
      }
    },
  };
}
