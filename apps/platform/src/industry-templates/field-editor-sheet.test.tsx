// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../test-support/render-helpers";
import { emptyCustomField } from "./empty-custom-field";
import { FieldEditorSheet } from "./field-editor-sheet";
import { buildIndustryLabels, labelsTranslator } from "./industry-labels";

const labels = buildIndustryLabels(banglaTranslator().t);
const t = labelsTranslator(labels);
const ROLES = ["CUSTOMER", "RELATED"] as const;

describe("FieldEditorSheet", () => {
  it("disables the field type when the template is locked", () => {
    renderInBangla(
      <FieldEditorSheet
        field={{
          ...emptyCustomField(),
          fieldKey: "nid_number",
          label: { bn: "এনআইডি", en: "NID" },
        }}
        isExisting
        isTypeLocked
        contactRoleKeys={ROLES}
        labels={labels}
        onApply={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(
      (screen.getByRole("combobox", { name: "ফিল্ডের ধরন" }) as HTMLSelectElement).disabled,
    ).toBe(true);
    expect((screen.getByLabelText("ফিল্ড চাবি") as HTMLInputElement).disabled).toBe(true);
  });

  it("keeps the type editable on a draft", () => {
    renderInBangla(
      <FieldEditorSheet
        field={emptyCustomField()}
        isExisting={false}
        isTypeLocked={false}
        contactRoleKeys={ROLES}
        labels={labels}
        onApply={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(
      (screen.getByRole("combobox", { name: "ফিল্ডের ধরন" }) as HTMLSelectElement).disabled,
    ).toBe(false);
    expect((screen.getByLabelText("ফিল্ড চাবি") as HTMLInputElement).disabled).toBe(false);
  });

  it("offers the template's roles on a contact field and applies the chosen ones", async () => {
    const onApply = vi.fn();
    renderInBangla(
      <FieldEditorSheet
        field={{
          ...emptyCustomField(),
          fieldKey: "school_name",
          label: { bn: "স্কুল", en: "School" },
        }}
        isExisting={false}
        isTypeLocked={false}
        contactRoleKeys={ROLES}
        labels={labels}
        onApply={onApply}
        onClose={() => undefined}
      />,
    );

    await userEvent.click(
      screen.getByRole("checkbox", { name: t("platform.contactRole.RELATED") }),
    );
    await userEvent.click(screen.getByRole("button", { name: t("platform.industry.action.save") }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ fieldKey: "school_name", appliesToContactRoles: ["RELATED"] }),
    );
    expect(screen.queryByRole("checkbox", { name: t("platform.contactRole.SUPPLIER") })).toBeNull();
  });

  it("leaves the roles out when none is chosen, and shows none on another record type", () => {
    renderInBangla(
      <FieldEditorSheet
        field={{ ...emptyCustomField(), entityType: "member" }}
        isExisting={false}
        isTypeLocked={false}
        contactRoleKeys={ROLES}
        labels={labels}
        onApply={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.queryByRole("checkbox", { name: t("platform.contactRole.RELATED") })).toBeNull();
  });
});
