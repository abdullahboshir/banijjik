// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { banglaTranslator, renderInBangla } from "../test-support/render-helpers";
import { emptyCustomField } from "./empty-custom-field";
import { FieldEditorSheet } from "./field-editor-sheet";
import { buildIndustryLabels } from "./industry-labels";

const labels = buildIndustryLabels(banglaTranslator().t);

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
});
