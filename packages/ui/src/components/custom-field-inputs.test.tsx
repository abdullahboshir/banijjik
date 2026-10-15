import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { formFieldMessageId } from "./form.js";
import { CustomFieldInputs } from "./custom-field-inputs.js";
import type { CustomFieldDescriptor, CustomFieldInputKind } from "./custom-field-types.js";

function descriptor(
  inputKind: CustomFieldInputKind,
  extra: Partial<CustomFieldDescriptor> = {},
): CustomFieldDescriptor {
  return {
    fieldKey: "field",
    inputKind,
    label: "Skin type",
    isRequired: false,
    ...extra,
  };
}

function StatefulField({
  field,
  onChange,
  error,
  disabled,
}: {
  field: CustomFieldDescriptor;
  onChange: (fieldKey: string, value: unknown) => void;
  error?: string | undefined;
  disabled?: boolean | undefined;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return (
    <CustomFieldInputs
      fields={[field]}
      values={values}
      errors={{ field: error }}
      onChange={(fieldKey, value) => {
        setValues((current) => ({ ...current, [fieldKey]: value }));
        onChange(fieldKey, value);
      }}
      idPrefix="contact"
      disabled={disabled}
      currencySymbol="৳"
      chooseLabel="Choose"
      notEditableText="Not editable here"
    />
  );
}

function renderField(
  field: CustomFieldDescriptor,
  options: { error?: string; disabled?: boolean } = {},
) {
  const onChange = vi.fn();
  render(
    <StatefulField
      field={field}
      onChange={onChange}
      error={options.error}
      disabled={options.disabled}
    />,
  );
  return onChange;
}

function setNativeValue(input: HTMLElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("custom field inputs", () => {
  const textKinds: { kind: CustomFieldInputKind; typed: string; value: unknown }[] = [
    { kind: "TEXT", typed: "hello", value: "hello" },
    { kind: "LONG_TEXT", typed: "a long note", value: "a long note" },
    { kind: "PHONE", typed: "01712345678", value: "01712345678" },
    { kind: "EMAIL", typed: "ada@example.com", value: "ada@example.com" },
    { kind: "URL", typed: "https://example.com", value: "https://example.com" },
    { kind: "INTEGER", typed: "30", value: 30 },
    { kind: "DECIMAL", typed: "70.5", value: "70.5" },
    { kind: "MONEY", typed: "12.50", value: 1250 },
  ];

  it.each(textKinds)(
    "renders $kind with its label and reports the typed value",
    async ({ kind, typed, value }) => {
      const onChange = renderField(descriptor(kind));
      const input = screen.getByRole("textbox", { name: "Skin type" });
      await userEvent.type(input, typed);
      expect(onChange).toHaveBeenLastCalledWith("field", value);
    },
  );

  it("keeps an integer that is not a whole number as text", async () => {
    const onChange = renderField(descriptor("INTEGER"));
    await userEvent.type(screen.getByRole("textbox", { name: "Skin type" }), "30.5");
    expect(onChange).toHaveBeenLastCalledWith("field", "30.5");
  });

  it("reports a calendar day from the date input", () => {
    const onChange = renderField(descriptor("DATE"));
    setNativeValue(screen.getByLabelText("Skin type"), "2026-10-15");
    expect(onChange).toHaveBeenLastCalledWith("field", "2026-10-15");
  });

  it("turns a datetime into an ISO string with the browser offset", () => {
    const onChange = renderField(descriptor("DATETIME"));
    setNativeValue(screen.getByLabelText("Skin type"), "2026-10-14T16:00");
    const reported = onChange.mock.calls.at(-1)?.[1];
    expect(reported).toMatch(/^2026-10-14T16:00:00[+-]\d{2}:\d{2}$/);
  });

  it("reports a boolean from the checkbox", async () => {
    const onChange = renderField(descriptor("BOOLEAN"));
    await userEvent.click(screen.getByRole("checkbox", { name: "Skin type" }));
    expect(onChange).toHaveBeenCalledWith("field", true);
  });

  it("reports the chosen select option", async () => {
    const onChange = renderField(
      descriptor("SELECT", {
        options: [
          { value: "OILY", label: "Oily" },
          { value: "DRY", label: "Dry" },
        ],
      }),
    );
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Skin type" }), "OILY");
    expect(onChange).toHaveBeenCalledWith("field", "OILY");
  });

  it("reports multi-select values in option order", async () => {
    const onChange = renderField(
      descriptor("MULTI_SELECT", {
        options: [
          { value: "A", label: "Alpha" },
          { value: "B", label: "Beta" },
        ],
      }),
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Beta" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    expect(onChange).toHaveBeenLastCalledWith("field", ["A", "B"]);
  });

  function labelledControl(kind: CustomFieldInputKind): HTMLElement {
    if (kind === "BOOLEAN") return screen.getByRole("checkbox", { name: "Skin type" });
    if (kind === "SELECT") return screen.getByRole("combobox", { name: "Skin type" });
    if (kind === "MULTI_SELECT") return screen.getByRole("group", { name: "Skin type" });
    if (kind === "DATE" || kind === "DATETIME")
      return screen.getByLabelText("Skin type", { exact: false });
    return screen.getByRole("textbox", { name: "Skin type" });
  }

  const everyKind: CustomFieldInputKind[] = [
    "TEXT",
    "LONG_TEXT",
    "INTEGER",
    "DECIMAL",
    "MONEY",
    "BOOLEAN",
    "DATE",
    "DATETIME",
    "SELECT",
    "MULTI_SELECT",
    "PHONE",
    "EMAIL",
    "URL",
  ];

  it.each(everyKind)(
    "links the %s error, shows the required marker and disables the control",
    (kind) => {
      const options =
        kind === "SELECT" || kind === "MULTI_SELECT"
          ? { options: [{ value: "A", label: "Alpha" }] }
          : {};
      renderField(descriptor(kind, { ...options, isRequired: true }), {
        error: "This value is not valid",
        disabled: true,
      });
      const errorId = formFieldMessageId("contact-field", "error");
      const message = screen.getByRole("alert");
      expect(message.id).toBe(errorId);
      expect(message.textContent).toBe("This value is not valid");
      const control = labelledControl(kind);
      expect(control.getAttribute("aria-describedby")).toContain(errorId);
      expect(document.querySelector("[aria-hidden='true']")?.textContent).toBe("*");
      if (kind === "MULTI_SELECT") {
        expect((screen.getByRole("checkbox", { name: "Alpha" }) as HTMLInputElement).disabled).toBe(
          true,
        );
        return;
      }
      expect((control as HTMLInputElement | HTMLSelectElement).disabled).toBe(true);
    },
  );

  it("shows one line for a field this card cannot edit", () => {
    render(
      <CustomFieldInputs
        fields={[]}
        pendingFields={[{ fieldKey: "photo", label: "Photo" }]}
        values={{}}
        errors={{}}
        onChange={vi.fn()}
        idPrefix="contact"
        currencySymbol="৳"
        chooseLabel="Choose"
        notEditableText="Not editable here"
      />,
    );
    expect(screen.getByText("Photo")).not.toBeNull();
    expect(screen.getByText("Not editable here")).not.toBeNull();
  });
});
