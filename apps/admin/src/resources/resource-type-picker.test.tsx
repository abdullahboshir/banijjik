// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ResourceFormIdentityFields } from "./resource-form-identity-fields";
import { emptyResourceForm } from "./resource-form";
afterEach(cleanup);
function ConfiguredPicker() {
  const [form, setForm] = useState(() =>
    emptyResourceForm({ locationId: "location", resourceTypeKey: "ROOM" }),
  );
  return (
    <ResourceFormIdentityFields
      form={form}
      onFormChange={setForm}
      nameLabel="Name"
      capacityLabel="Capacity"
      resourceTypeLabel="Type"
      resourceTypes={[
        { value: "ROOM", label: "Room" },
        { value: "CHAIR", label: "Chair" },
      ]}
    />
  );
}
describe("template resource type choices", () => {
  it("offers configured types and keeps the selected key in the form", () => {
    render(<ConfiguredPicker />);
    const picker = screen.getByLabelText("Type", { exact: false }) as HTMLSelectElement;
    expect(Array.from(picker.options, (option) => option.value)).toEqual(["ROOM", "CHAIR"]);
    fireEvent.change(picker, { target: { value: "CHAIR" } });
    expect(picker.value).toBe("CHAIR");
  });
});
