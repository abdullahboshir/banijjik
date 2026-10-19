// @vitest-environment jsdom
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText } from "../auth/test-helpers";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const createExpense = vi.fn();
vi.mock("./expense-api", () => ({
  createExpense: (...args: unknown[]) => createExpense(...args),
}));
vi.mock("./use-expense-attachments", () => ({
  useExpenseAttachments: () => ({
    isUploading: false,
    uploadError: undefined,
    previewUrlOf: () => "",
    upload: vi.fn(),
    remove: vi.fn(),
    canAddMore: true,
    imageLabels: {
      choose: "ছবি যোগ",
      change: "ছবি যোগ",
      remove: "সরান",
      uploading: "আপলোড…",
      previewAlt: "সংযুক্তি",
    },
  }),
}));

const { ExpenseFormSheet } = await import("./expense-form-sheet");

const LABELS = {
  createTitle: "খরচ যোগ",
  close: "বন্ধ",
  save: "সংরক্ষণ",
  amount: "পরিমাণ",
  category: "ক্যাটেগরি",
  paidVia: "মাধ্যম",
  date: "তারিখ",
  location: "লোকেশন",
  note: "নোট",
  attachments: "সংযুক্তি",
  addPhoto: "ছবি যোগ",
  removeAttachment: "সরান",
  conflict: "দ্বন্দ্ব",
  reload: "রিলোড",
  paidViaOptions: {
    CASH: "নগদ",
    BKASH: "বিকাশ",
    NAGAD: "নগদ",
    BANK: "ব্যাংক",
    CARD: "কার্ড",
  },
};

const CATEGORIES = [
  {
    expenseCategoryId: "01900000-0000-7000-8000-000000000001",
    name: { bn: "ভাড়া", en: "Rent" },
    accountId: "01900000-0000-7000-8000-000000000010",
    accountCode: "EXPENSE_RENT",
    status: "ACTIVE" as const,
    isSystem: true,
  },
];

const LOCATIONS = [{ locationId: "01900000-0000-7000-8000-000000000020", name: "মূল দোকান" }];

function renderSheet(onClose = vi.fn()) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <ExpenseFormSheet
        organizationId="org-1"
        currency="BDT"
        categories={CATEGORIES}
        locations={LOCATIONS}
        labels={LABELS}
        defaultLocationId={LOCATIONS[0]?.locationId ?? ""}
        defaultBusinessDate="2026-10-19"
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

beforeEach(() => {
  createExpense.mockReset();
  refresh.mockReset();
});

describe("ExpenseFormSheet", () => {
  it("asks for an amount before calling the API", async () => {
    renderSheet();

    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    expect((await screen.findByLabelText(/পরিমাণ/u)).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByText(banglaText("validation.required")).length).toBeGreaterThan(0);
    expect(createExpense).not.toHaveBeenCalled();
  });

  it("creates an expense with an Idempotency-Key, then closes and reloads", async () => {
    createExpense.mockResolvedValue({});
    const onClose = renderSheet();

    await userEvent.type(screen.getByLabelText(/পরিমাণ/u), "500");
    await userEvent.selectOptions(
      screen.getByLabelText(/ক্যাটেগরি/u),
      CATEGORIES[0]?.expenseCategoryId ?? "",
    );
    await userEvent.click(screen.getByRole("button", { name: LABELS.save }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createExpense.mock.calls[0]?.[1]).toMatchObject({
      expenseCategoryId: CATEGORIES[0]?.expenseCategoryId ?? "",
      amount: { amount: 50000, currency: "BDT" },
      paidVia: "CASH",
      businessDate: "2026-10-19",
      locationId: LOCATIONS[0]?.locationId,
      attachmentFileIds: [],
    });
    expect(typeof createExpense.mock.calls[0]?.[2]).toBe("string");
    expect(refresh).toHaveBeenCalled();
  });
});
