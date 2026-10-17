// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { BUNDLED_CATALOGS } from "@banijjik/i18n";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator } from "../auth/test-helpers";
import { effectiveField } from "../custom-fields/test-fixtures";
import type { CustomFieldsFormProps } from "../custom-fields/use-custom-fields-form";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const updateProfile = vi.fn();
vi.mock("./profile-api", () => ({
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

const { ProfileFormSheet } = await import("./profile-form-sheet");
const { profileLabelsOf } = await import("./profile-labels");

const labels = profileLabelsOf(banglaTranslator().t);
const INITIAL = {
  name: "রহিম ট্রেডার্স",
  defaultLocale: "bn" as const,
  legalName: "",
  legalType: "",
  businessPhone: "",
  businessEmail: "",
  line1: "",
  area: "",
  thana: "",
  district: "",
  postalCode: "",
  tradeLicenseNumber: "",
};
const FIELDS = [
  effectiveField({
    fieldKey: "branch_code",
    fieldType: "TEXT",
    entityType: "organization",
    label: { bn: "শাখা কোড", en: "Branch code" },
  }),
  effectiveField({
    fieldKey: "tax_note",
    fieldType: "TEXT",
    entityType: "organization",
    isSensitive: true,
    label: { bn: "কর নোট", en: "Tax note" },
  }),
];

function customFieldsProps(overrides: Partial<CustomFieldsFormProps> = {}): CustomFieldsFormProps {
  return {
    fields: FIELDS,
    stored: { branch_code: "DHK-01", tax_note: "secret" },
    canSeeSensitive: true,
    currencyCode: "BDT",
    title: banglaText("customFields.title"),
    hiddenHint: banglaText("customFields.hiddenHint"),
    ...overrides,
  };
}

function renderSheet(customFields: CustomFieldsFormProps) {
  render(
    <I18nProvider locale="bn" catalog={BUNDLED_CATALOGS.bn} brandName="Example">
      <ProfileFormSheet
        organizationId="org-1"
        initial={INITIAL}
        version={4}
        labels={labels}
        customFields={customFields}
        onClose={vi.fn()}
      />
    </I18nProvider>,
  );
}

function field(label: string): HTMLElement {
  return screen.getByLabelText(new RegExp(label));
}

beforeEach(() => {
  updateProfile.mockReset();
  refresh.mockReset();
});

describe("the extra details in the profile form", () => {
  it("shows the saved values under the section title", () => {
    renderSheet(customFieldsProps());

    expect(screen.getByText(banglaText("customFields.title"))).toBeTruthy();
    expect((field("শাখা কোড") as HTMLInputElement).value).toBe("DHK-01");
    expect((field("কর নোট") as HTMLInputElement).value).toBe("secret");
  });

  it("sends only the details that changed, next to the profile", async () => {
    updateProfile.mockResolvedValue({});
    renderSheet(customFieldsProps());

    await userEvent.clear(field("শাখা কোড"));
    await userEvent.type(field("শাখা কোড"), "DHK-02");
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile.mock.calls[0]?.[1]).toEqual({
      name: INITIAL.name,
      defaultLocale: "bn",
      customFields: { branch_code: "DHK-02" },
      version: 4,
    });
  });

  it("sends no customFields when no detail changed", async () => {
    updateProfile.mockResolvedValue({});
    renderSheet(customFieldsProps());

    await userEvent.click(screen.getByRole("button", { name: labels.submit }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile.mock.calls[0]?.[1]).not.toHaveProperty("customFields");
  });

  it("leaves a sensitive detail out of the form and says some details are hidden, for a person who may not read it", () => {
    renderSheet(customFieldsProps({ canSeeSensitive: false, stored: { branch_code: "DHK-01" } }));

    expect(screen.queryByLabelText(/কর নোট/)).toBeNull();
    expect(screen.getByText(banglaText("customFields.hiddenHint"))).toBeTruthy();
  });

  it("shows a refusal of the API at the detail it names", async () => {
    updateProfile.mockRejectedValue(
      new ApiError({
        status: 400,
        code: ERROR_CODE.VALIDATION_ERROR,
        messageKey: "errors.validation",
        details: {
          fields: [{ path: "customFields.branch_code", messageKey: "validation.too_big" }],
        },
      }),
    );
    renderSheet(customFieldsProps());

    await userEvent.type(field("শাখা কোড"), "x");
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));

    expect(await screen.findByText(banglaText("validation.too_big"))).toBeTruthy();
  });

  it("does not call the API when a detail breaks the shared rules", async () => {
    renderSheet(customFieldsProps({ stored: {} }));

    await userEvent.type(field("শাখা কোড"), "x".repeat(201));
    await userEvent.click(screen.getByRole("button", { name: labels.submit }));

    expect(await screen.findByText(banglaText("validation.too_big"))).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });
});
