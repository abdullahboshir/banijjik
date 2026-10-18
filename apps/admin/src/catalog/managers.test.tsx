// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const record = {
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  archiveCategory: vi.fn(),
  createModifierGroup: vi.fn(),
  updateModifierGroup: vi.fn(),
  archiveModifierGroup: vi.fn(),
  saveSynonyms: vi.fn(),
};
vi.mock("./record-api", () => ({
  createCategory: (...args: unknown[]) => record.createCategory(...args),
  updateCategory: (...args: unknown[]) => record.updateCategory(...args),
  archiveCategory: (...args: unknown[]) => record.archiveCategory(...args),
  createModifierGroup: (...args: unknown[]) => record.createModifierGroup(...args),
  updateModifierGroup: (...args: unknown[]) => record.updateModifierGroup(...args),
  archiveModifierGroup: (...args: unknown[]) => record.archiveModifierGroup(...args),
  saveSynonyms: (...args: unknown[]) => record.saveSynonyms(...args),
}));

const { CategoriesManager } = await import("./categories-manager");
const { AddOnsManager } = await import("./add-ons-manager");
const { SynonymsEditor } = await import("./synonyms-editor");
const { categoryLabelsOf, addOnLabelsOf } = await import("./manager-labels");

const { t } = banglaTranslator();
const categoryLabels = categoryLabelsOf(t);
const addOnLabels = addOnLabelsOf(t);

function category(
  categoryId: string,
  name: string,
  sortOrder: number,
  parent: string | null = null,
) {
  return { categoryId, name, sortOrder, parentCategoryId: parent, version: 1 } as never;
}

beforeEach(() => {
  refresh.mockReset();
  for (const mock of Object.values(record)) mock.mockReset().mockResolvedValue({});
});

describe("the categories list", () => {
  const manager = {
    organizationId: "org-1",
    labels: categoryLabels,
    canCreate: true,
    canUpdate: true,
    canArchive: true,
  };

  it("adds a category under the chosen parent", async () => {
    renderInBangla(<CategoriesManager {...manager} categories={[category("c-1", "পোশাক", 0)]} />);

    await userEvent.type(screen.getByLabelText(categoryLabels["categories.name"]), "শার্ট");
    await userEvent.selectOptions(
      screen.getByLabelText(categoryLabels["categories.parent"]),
      "c-1",
    );
    await userEvent.click(screen.getByRole("button", { name: categoryLabels["categories.add"] }));

    await waitFor(() =>
      expect(record.createCategory).toHaveBeenCalledWith("org-1", {
        name: "শার্ট",
        parentCategoryId: "c-1",
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("moves a category down by renumbering its siblings", async () => {
    renderInBangla(
      <CategoriesManager
        {...manager}
        categories={[category("c-1", "ক", 10), category("c-2", "খ", 20)]}
      />,
    );

    const [firstMoveDown] = screen.getAllByRole("button", {
      name: categoryLabels["categories.moveDown"],
    });
    await userEvent.click(firstMoveDown as HTMLElement);

    await waitFor(() => expect(record.updateCategory).toHaveBeenCalledTimes(1));
    expect(record.updateCategory.mock.calls[0]?.[1]).toMatchObject({
      categoryId: "c-2",
      changes: { sortOrder: 0 },
    });
  });

  it("shows the tree without any button to a person who may only look", () => {
    renderInBangla(
      <CategoriesManager
        {...manager}
        canCreate={false}
        canUpdate={false}
        canArchive={false}
        categories={[category("c-1", "ক", 10)]}
      />,
    );

    expect(screen.getByText("ক")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("the add-ons list", () => {
  const manager = {
    organizationId: "org-1",
    groups: [],
    currency: "BDT" as const,
    currencySymbol: "৳",
    labels: addOnLabels,
    canCreate: true,
    canUpdate: true,
    canArchive: true,
  };

  it("creates a group of several options with the price of each and says the rule in words", async () => {
    renderInBangla(<AddOnsManager {...manager} />);

    await userEvent.click(screen.getByRole("button", { name: addOnLabels["addOns.add"] }));
    await userEvent.type(screen.getByLabelText(addOnLabels["addOns.name"]), "টপিং");
    await userEvent.type(screen.getByLabelText(addOnLabels["addOns.optionName"]), "চিজ");
    await userEvent.type(screen.getByLabelText(`${addOnLabels["addOns.optionPrice"]} (৳)`), "20");
    expect(screen.getByText(/সর্বোচ্চ 1টি অপশন/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: addOnLabels["addOns.save"] }));

    await waitFor(() => expect(record.createModifierGroup).toHaveBeenCalled());
    expect(record.createModifierGroup.mock.calls[0]?.[1]).toMatchObject({
      name: "টপিং",
      selection: "MULTIPLE",
      isRequired: false,
      minSelect: 0,
      maxSelect: 1,
      options: [{ name: "চিজ", priceDelta: { amount: 2000, currency: "BDT" } }],
    });
  });
});

describe("the words customers use", () => {
  it("saves the entries with the version that was read", async () => {
    renderInBangla(
      <SynonymsEditor
        organizationId="org-1"
        labels={categoryLabels}
        canUpdate
        synonyms={{ entries: [{ term: "শার্ট", synonyms: ["জামা"] }], version: 4 }}
      />,
    );

    await userEvent.type(screen.getByDisplayValue("জামা"), ", টপ");
    await userEvent.click(screen.getByRole("button", { name: categoryLabels["synonyms.save"] }));

    await waitFor(() =>
      expect(record.saveSynonyms).toHaveBeenCalledWith("org-1", {
        entries: [{ term: "শার্ট", synonyms: ["জামা", "টপ"] }],
        version: 4,
      }),
    );
  });
});
