import { AUDIT_ACTION, type CurrencyCode } from "@banijjik/contracts";
import type { CreditPackCreateRequest } from "@banijjik/contracts/credit";
import { describe, expect, it, vi } from "vitest";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { CreditPackCurrencyMismatchError } from "../../domain/index.js";
import { CreateCreditPackUseCase } from "./credit-pack.use-cases.js";
import { withOrganizationContext } from "../../../../../test-support/organization-context.js";

const ORGANIZATION_ID = "org-1";
const NOW = new Date("2026-10-21T08:00:00.000Z");

function aRequest(overrides: Partial<CreditPackCreateRequest> = {}): CreditPackCreateRequest {
  return {
    name: { bn: "প্যাক", en: "Pack" },
    credits: 10,
    price: { amount: 25_000, currency: "BDT" as CurrencyCode },
    validityDays: null,
    sortOrder: 1,
    ...overrides,
  };
}

function dependencies(organizationCurrency: CurrencyCode | undefined) {
  const insert = vi.fn(async () => undefined);
  const record = vi.fn(async () => undefined);
  const deps = {
    currency: { read: vi.fn(async () => organizationCurrency) },
    packs: { insert },
    audit: { record },
    clock: { now: () => NOW },
    unitOfWork: { run: async <Result>(fn: () => Promise<Result>) => fn() },
  } as unknown as CreditDependencies;
  return { deps, insert, record };
}

describe("CreateCreditPackUseCase", () => {
  it("refuses a pack whose currency the organization does not use", async () => {
    await withOrganizationContext(ORGANIZATION_ID, async () => {
      const { deps, insert } = dependencies(undefined);
      const useCase = new CreateCreditPackUseCase(deps);

      await expect(useCase.execute(aRequest(), null)).rejects.toBeInstanceOf(
        CreditPackCurrencyMismatchError,
      );
      expect(insert).not.toHaveBeenCalled();
    });
  });

  it("creates an ACTIVE pack in the organization's currency and audits it", async () => {
    await withOrganizationContext(ORGANIZATION_ID, async () => {
      const { deps, insert, record } = dependencies("BDT" as CurrencyCode);
      const useCase = new CreateCreditPackUseCase(deps);

      const pack = await useCase.execute(aRequest({ credits: 12 }), null);

      expect(pack).toMatchObject({ credits: 12, status: "ACTIVE", version: 1 });
      expect(pack.price).toEqual({ amount: 25_000, currency: "BDT" });
      expect(insert).toHaveBeenCalledTimes(1);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AUDIT_ACTION.CREDIT_PACK_CREATED }),
      );
    });
  });

  it("refuses a pack priced in another currency when the organization uses BDT", async () => {
    await withOrganizationContext(ORGANIZATION_ID, async () => {
      const { deps, insert } = dependencies("BDT" as CurrencyCode);
      const useCase = new CreateCreditPackUseCase(deps);

      await expect(
        useCase.execute(
          aRequest({ price: { amount: 100, currency: "USD" as CurrencyCode } }),
          null,
        ),
      ).rejects.toBeInstanceOf(CreditPackCurrencyMismatchError);
      expect(insert).not.toHaveBeenCalled();
    });
  });
});
