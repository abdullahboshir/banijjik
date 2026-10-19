// @vitest-environment jsdom
import { PERMISSION_KEY } from "@banijjik/contracts";
import type { TrialBalanceResponse } from "@banijjik/contracts/accounting";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator } from "../auth/test-helpers";
import { accessFixture } from "../settings/test-fixtures";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const requireOrgAccess = vi.fn();
vi.mock("../shell/org-access", () => ({
  requireOrgAccess: (...args: unknown[]) => requireOrgAccess(...args),
}));
vi.mock("../lib/i18n/get-translator", () => ({
  getTranslator: () => Promise.resolve(banglaTranslator()),
}));
const fetchBusinessResource = vi.fn();
vi.mock("../lib/api/server-resource", () => ({
  fetchBusinessResource: (...args: unknown[]) => fetchBusinessResource(...args),
}));

const { TrialBalancePage } = await import("./trial-balance-page");

const BALANCED: TrialBalanceResponse = {
  asOf: "2026-10-19",
  accounts: [
    {
      accountId: "a1",
      accountCode: "CASH",
      name: { bn: "নগদ", en: "Cash" },
      accountType: "ASSET",
      debitTotal: { amount: 1000, currency: "BDT" },
      creditTotal: { amount: 0, currency: "BDT" },
      balance: { amount: 1000, currency: "BDT" },
    },
  ],
  debitTotal: { amount: 1000, currency: "BDT" },
  creditTotal: { amount: 1000, currency: "BDT" },
  balances: true,
};

const UNBALANCED: TrialBalanceResponse = {
  ...BALANCED,
  creditTotal: { amount: 900, currency: "BDT" },
  balances: false,
};

beforeEach(() => {
  requireOrgAccess.mockReset();
  fetchBusinessResource.mockReset();
});

describe("TrialBalancePage", () => {
  it("shows books balance yes when the ledger nets to zero", async () => {
    requireOrgAccess.mockResolvedValue(
      accessFixture({ keys: [PERMISSION_KEY.ACCOUNTING_LEDGER_READ] }),
    );
    fetchBusinessResource.mockResolvedValue({ data: BALANCED });

    render(await TrialBalancePage({ orgSlug: "acme", searchParams: { asOf: "2026-10-19" } }));

    expect(screen.getByRole("status").textContent).toContain("হ্যাঁ");
    expect(fetchBusinessResource).toHaveBeenCalledWith(
      expect.stringContaining("/accounting/trial-balance?asOf=2026-10-19"),
    );
  });

  it("shows books balance no when debits and credits differ", async () => {
    requireOrgAccess.mockResolvedValue(
      accessFixture({ keys: [PERMISSION_KEY.ACCOUNTING_LEDGER_READ] }),
    );
    fetchBusinessResource.mockResolvedValue({ data: UNBALANCED });

    render(await TrialBalancePage({ orgSlug: "acme", searchParams: {} }));

    expect(screen.getByRole("status").textContent).toContain("না");
  });

  it("refuses without ledger read permission", async () => {
    requireOrgAccess.mockResolvedValue(accessFixture({ keys: [] }));

    render(await TrialBalancePage({ orgSlug: "acme", searchParams: {} }));

    expect(screen.getByText(/অনুমতি/u)).toBeTruthy();
    expect(fetchBusinessResource).not.toHaveBeenCalled();
  });
});
