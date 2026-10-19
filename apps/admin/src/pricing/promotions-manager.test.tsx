// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { promotionLabelsOf } from "./pricing-labels";
import { PromotionsManager } from "./promotions-manager";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const createPromotion = vi.fn();
const updatePromotion = vi.fn();
const archivePromotion = vi.fn();
const previewQuote = vi.fn();
vi.mock("./pricing-api", () => ({
  createPromotion: (...args: unknown[]) => createPromotion(...args),
  updatePromotion: (...args: unknown[]) => updatePromotion(...args),
  archivePromotion: (...args: unknown[]) => archivePromotion(...args),
  previewQuote: (...args: unknown[]) => previewQuote(...args),
}));

const { t } = banglaTranslator();
const labels = promotionLabelsOf(t);

beforeEach(() => {
  for (const mock of [createPromotion, updatePromotion, archivePromotion, previewQuote]) {
    mock.mockReset();
  }
});

describe("PromotionsManager", () => {
  it("creates a percent promotion on a category", async () => {
    createPromotion.mockResolvedValue({
      promotionId: "p-1",
      name: "Ten off",
      status: "DRAFT",
      version: 1,
    });
    renderInBangla(
      <PromotionsManager
        organizationId="org-1"
        promotions={[]}
        categories={[
          {
            categoryId: "c-1",
            name: "Rice",
            slug: "rice",
            parentCategoryId: null,
            sortOrder: 1,
            imageFileId: null,
            imageUrl: null,
            customFields: {},
            version: 1,
            status: "ACTIVE",
            createdAt: "",
            updatedAt: "",
          },
        ]}
        locations={[{ locationId: "l-1", name: "Main" }]}
        offerings={[]}
        labels={labels}
        canCreate
        canUpdate
        canArchive
      />,
    );
    await userEvent.type(screen.getByLabelText(labels["promotions.name"]), "Ten off");
    await userEvent.clear(screen.getByLabelText(labels["promotions.percent"]));
    await userEvent.type(screen.getByLabelText(labels["promotions.percent"]), "10");
    await userEvent.click(screen.getByRole("button", { name: labels["promotions.save"] }));
    await waitFor(() => expect(createPromotion).toHaveBeenCalled());
    expect(createPromotion.mock.calls[0]?.[1]).toMatchObject({
      name: "Ten off",
      target: { scope: "CATEGORY", ids: ["c-1"] },
      benefit: { type: "PERCENT", value: 1000 },
    });
  });
});
