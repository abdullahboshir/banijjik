// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import type { CreditPack } from "@banijjik/contracts/credit";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const writes = {
  createCreditPack: vi.fn(),
  updateCreditPack: vi.fn(),
  archiveCreditPack: vi.fn(),
};
vi.mock("./credit-api", () => ({
  createCreditPack: (...args: unknown[]) => writes.createCreditPack(...args),
  updateCreditPack: (...args: unknown[]) => writes.updateCreditPack(...args),
  archiveCreditPack: (...args: unknown[]) => writes.archiveCreditPack(...args),
}));

const { CreditPacksManager } = await import("./packs-manager");
const { creditPackLabelsOf } = await import("./credit-labels");

const labels = creditPackLabelsOf(banglaTranslator().t);

function pack(change: Partial<CreditPack> = {}): CreditPack {
  return {
    creditPackId: "pack-1",
    name: { bn: "স্টার্টার", en: "Starter" },
    credits: 10,
    price: { amount: 12000, currency: "BDT" },
    validityDays: 30,
    status: "ACTIVE",
    sortOrder: 0,
    version: 3,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
    ...change,
  };
}

function renderManager(
  packs: CreditPack[],
  permissions = { canCreate: true, canUpdate: true, canArchive: true },
) {
  renderInBangla(
    <CreditPacksManager
      organizationId="org-1"
      packs={packs}
      currency="BDT"
      currencySymbol="৳"
      locale="bn"
      labels={labels}
      {...permissions}
    />,
  );
}

beforeEach(() => {
  refresh.mockReset();
  for (const write of Object.values(writes)) write.mockReset().mockResolvedValue({});
});

describe("the credit pack list", () => {
  it("shows each pack with its name, status and validity", () => {
    renderManager([
      pack(),
      pack({
        creditPackId: "pack-2",
        name: { bn: "বড়", en: "Big" },
        validityDays: null,
        sortOrder: 1,
      }),
    ]);

    expect(screen.getByText("স্টার্টার")).toBeTruthy();
    expect(screen.getByText("কেনার 30 দিন পরে মেয়াদ শেষ")).toBeTruthy();
    expect(screen.getByText(labels.neverExpires)).toBeTruthy();
    expect(screen.getAllByText(labels.status.ACTIVE)).toHaveLength(2);
  });

  it("says when there is no pack yet", () => {
    renderManager([]);

    expect(screen.getByText(labels.empty)).toBeTruthy();
  });

  it("offers no add or change control to a person who may only look", () => {
    renderManager([pack()], { canCreate: false, canUpdate: false, canArchive: false });

    expect(screen.getByText("স্টার্টার")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("does not offer to edit an archived pack", () => {
    renderManager([pack({ status: "ARCHIVED" })]);

    expect(screen.getByText(labels.status.ARCHIVED)).toBeTruthy();
    expect(screen.queryByRole("button", { name: labels.edit })).toBeNull();
  });
});

describe("adding a pack", () => {
  it("sends both names, the credits and the price in minor units, then reloads", async () => {
    renderManager([]);

    await userEvent.click(screen.getByRole("button", { name: labels.add }));
    await userEvent.type(screen.getByLabelText(labels.nameBn), "স্টার্টার");
    await userEvent.type(screen.getByLabelText(labels.nameEn), "Starter");
    await userEvent.type(screen.getByLabelText(labels.credits), "10");
    await userEvent.type(screen.getByLabelText(`${labels.price} (৳)`), "120");
    await userEvent.type(screen.getByLabelText(labels.validityDays), "30");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() =>
      expect(writes.createCreditPack).toHaveBeenCalledWith("org-1", {
        name: { bn: "স্টার্টার", en: "Starter" },
        credits: 10,
        price: { amount: 12000, currency: "BDT" },
        validityDays: 30,
        sortOrder: 0,
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("shows what is missing instead of sending an unreadable form", async () => {
    renderManager([]);

    await userEvent.click(screen.getByRole("button", { name: labels.add }));
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(labels.invalid)).toBeTruthy();
    expect(writes.createCreditPack).not.toHaveBeenCalled();
  });

  it("says when someone else changed the packs and offers to reload", async () => {
    writes.createCreditPack.mockRejectedValue(
      new ApiError({ status: 409, code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" }),
    );
    renderManager([]);

    await userEvent.click(screen.getByRole("button", { name: labels.add }));
    await userEvent.type(screen.getByLabelText(labels.nameBn), "স্টার্টার");
    await userEvent.type(screen.getByLabelText(labels.nameEn), "Starter");
    await userEvent.type(screen.getByLabelText(labels.credits), "10");
    await userEvent.type(screen.getByLabelText(`${labels.price} (৳)`), "120");
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    expect(await screen.findByText(labels.conflict)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: labels.reload }));
    expect(refresh).toHaveBeenCalled();
  });
});

describe("changing a pack", () => {
  it("saves with the version it read", async () => {
    renderManager([pack()]);

    await userEvent.click(screen.getByRole("button", { name: labels.edit }));
    await userEvent.click(screen.getByRole("button", { name: labels.save }));

    await waitFor(() =>
      expect(writes.updateCreditPack).toHaveBeenCalledWith("org-1", {
        creditPackId: "pack-1",
        version: 3,
        body: {
          name: { bn: "স্টার্টার", en: "Starter" },
          credits: 10,
          price: { amount: 12000, currency: "BDT" },
          validityDays: 30,
          sortOrder: 0,
        },
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("archives with the version it read", async () => {
    renderManager([pack()]);

    await userEvent.click(screen.getByRole("button", { name: labels.edit }));
    await userEvent.click(screen.getByRole("button", { name: labels.archive }));

    await waitFor(() =>
      expect(writes.archiveCreditPack).toHaveBeenCalledWith("org-1", {
        creditPackId: "pack-1",
        version: 3,
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });
});
